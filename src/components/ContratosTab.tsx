import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Student, Guardian, Enrollment, ContraturnoSegment, RegularClass, ContraturnoPrice, ContratoDoc, ContratoModelo, StatusContrato } from '../types';
import { ANO_CARTA_INTENCAO, TAXA_MATERIAL_2027 } from '../data';
import { getCollectionData, saveDocument, proximoNumeroContrato } from '../firebase';
import {
  TipoContrato, ORDEM_TIPOS, NOMES_DOCS, NOMES_PERFIL, PerfilContrato, ContratoContexto, CartaResolvida, NumerosContrato,
  elegivelParaContrato, resolverCarta, documentosDoAluno, perfilDoAluno, validarParaContrato, montarDadosDoContrato,
  numeroDoTermoDeImagem, responsavelFinanceiro, formatarNumeroDoc, dataBR, diasPorExtenso,
} from '../contratos/montarDados';
import { formatarMoeda, formatarPercentual } from '../contratos/extenso';
import {
  preencherModelo, validarModelo, nomeDoArquivo, zipar, baixarArquivo, base64ParaBytes, bytesParaBase64,
} from '../contratos/gerarDocx';
import { FileText, Search, X, Download, Upload, Settings2, Copy, MessageCircle, ChevronRight, Loader2, AlertTriangle, Send } from 'lucide-react';

const ANO = ANO_CARTA_INTENCAO;
const TAMANHO_MAX_MODELO = 650_000; // bytes — o modelo vai como texto (base64) num documento do Firestore (limite ~1 MB)

type ShowToast = (title: string, description?: string, type?: 'success' | 'error' | 'info', duration?: number) => void;

interface ContratosTabProps {
  students: Student[];
  guardians: Guardian[];
  enrollments: Enrollment[];
  contraturnos: ContraturnoSegment[];
  classPrices: RegularClass[];
  contraturnoPrices: ContraturnoPrice[];
  showToast: ShowToast;
}

interface Linha {
  aluno: Student;
  ctx: ContratoContexto;
  carta: CartaResolvida;
  perfil: PerfilContrato;
  tipos: TipoContrato[];
  faltas: string[];
  avisos: string[];
  turmaNome: string;
  turmaOrdem: number;
}

const STATUS_INFO: Record<StatusContrato, { rot: string; ic: string; kpi: string; chip: string }> = {
  nao_gerado: { rot: 'Não gerado', ic: '○', kpi: 'Por gerar', chip: 'bg-slate-100 text-slate-600' },
  gerado: { rot: 'Gerado', ic: '✎', kpi: 'Gerados, falta enviar', chip: 'bg-sky-100 text-sky-800' },
  enviado: { rot: 'Enviado para assinatura', ic: '➤', kpi: 'Aguardando assinatura', chip: 'bg-amber-100 text-amber-800' },
  assinado: { rot: 'Assinado', ic: '✔', kpi: 'Assinados', chip: 'bg-emerald-100 text-emerald-800' },
  correcao: { rot: 'Precisa de correção', ic: '⚠', kpi: 'Para corrigir', chip: 'bg-rose-100 text-rose-800' },
};
const ORDEM_STATUS: StatusContrato[] = ['nao_gerado', 'gerado', 'enviado', 'assinado', 'correcao'];

const idDoc = (alunoId: string, tipo: TipoContrato) => `${alunoId}_${ANO}_${tipo}`;
const isoHoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ddmm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const numTexto = (d?: ContratoDoc) => (d?.numero ? `${d.numero}/${ANO}` : '');
const snapshot = (d: ContratoDoc) => ({ status: d.status as StatusContrato, versao: d.versao, geradoEm: d.geradoEm, enviadoEm: d.enviadoEm, assinadoEm: d.assinadoEm });

export default function ContratosTab({ students, guardians, enrollments, contraturnos, classPrices, contraturnoPrices, showToast }: ContratosTabProps) {
  const [docs, setDocs] = useState<ContratoDoc[]>([]);
  const docsRef = useRef<ContratoDoc[]>([]);
  const [modelos, setModelos] = useState<ContratoModelo[]>([]);
  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [erroCarga, setErroCarga] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<'' | PerfilContrato>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusContrato | null>(null);
  const [soIncompletos, setSoIncompletos] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [painelModelos, setPainelModelos] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [errosModelo, setErrosModelo] = useState<{ tipo: TipoContrato; erros: string[] } | null>(null);

  // ---------- carga ----------
  const carregar = async () => {
    setCarga('carregando'); setErroCarga('');
    try {
      const [d, m] = await Promise.all([getCollectionData<ContratoDoc>('contratos'), getCollectionData<ContratoModelo>('contratoModelos')]);
      docsRef.current = d; setDocs(d); setModelos(m); setCarga('ok');
      if (m.length === 0) setPainelModelos(true);
    } catch (e: any) {
      setErroCarga(String(e?.message || e)); setCarga('erro');
    }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const gravarDoc = async (novo: ContratoDoc) => {
    await saveDocument('contratos', novo);
    const lista = [...docsRef.current.filter(d => d.id !== novo.id), novo];
    docsRef.current = lista; setDocs(lista);
  };
  const docDe = (alunoId: string, tipo: TipoContrato) => docs.find(d => d.id === idDoc(alunoId, tipo));
  const statusDe = (alunoId: string, tipo: TipoContrato): StatusContrato => docDe(alunoId, tipo)?.status || 'nao_gerado';

  // ---------- linhas da lista ----------
  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const aluno of students) {
      const ctx: ContratoContexto = { student: aluno, guardians, enrollments, classPrices, contraturnoPrices, contraturnos };
      if (!elegivelParaContrato(ctx).ok) continue;
      const carta = resolverCarta(ctx);
      if (!carta) continue;
      const v = validarParaContrato(ctx, carta);
      out.push({
        aluno, ctx, carta, perfil: perfilDoAluno(carta), tipos: documentosDoAluno(carta), faltas: v.faltas, avisos: v.avisos,
        turmaNome: carta.somenteContraturno ? 'Somente Contraturno' : carta.turma.nome,
        turmaOrdem: carta.somenteContraturno ? 999 : carta.turma.idadeRef,
      });
    }
    return out.sort((a, b) => a.turmaOrdem - b.turmaOrdem || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
  }, [students, guardians, enrollments, classPrices, contraturnoPrices, contraturnos]);

  const contagem = useMemo(() => {
    const c: Record<StatusContrato, number> = { nao_gerado: 0, gerado: 0, enviado: 0, assinado: 0, correcao: 0 };
    linhas.forEach(l => l.tipos.forEach(t => { c[statusDe(l.aluno.id, t)]++; }));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, docs]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(l => {
      if (filtroPerfil && l.perfil !== filtroPerfil) return false;
      if (soIncompletos && l.faltas.length === 0) return false;
      if (q) {
        const r = responsavelFinanceiro(guardians, l.aluno.id);
        if (!(l.aluno.nome.toLowerCase().includes(q) || (r?.nome || '').toLowerCase().includes(q))) return false;
      }
      if (filtroStatus && !l.tipos.some(t => statusDe(l.aluno.id, t) === filtroStatus)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, busca, filtroPerfil, filtroStatus, soIncompletos, docs, guardians]);

  const grupos = useMemo(() => {
    const m = new Map<string, Linha[]>();
    visiveis.forEach(l => { m.set(l.turmaNome, [...(m.get(l.turmaNome) || []), l]); });
    return [...m.entries()];
  }, [visiveis]);

  const incompletos = linhas.filter(l => l.faltas.length > 0).length;
  // quantos documentos "gerados, falta enviar" os alunos selecionados têm (alimenta o botão de marcar como enviados)
  const geradosSelecionados = linhas.filter(l => sel.has(l.aluno.id)).reduce((n, l) => n + l.tipos.filter(t => statusDe(l.aluno.id, t) === 'gerado').length, 0);
  const modelosFaltando = ORDEM_TIPOS.filter(t => !modelos.find(m => m.id === t));
  const linhaAberta = abertoId ? linhas.find(l => l.aluno.id === abertoId) : undefined;

  // ---------- geração ----------
  const numerosDoAluno = (alunoId: string): NumerosContrato => {
    const n = (t: TipoContrato) => { const d = docsRef.current.find(x => x.id === idDoc(alunoId, t)); return d?.numero ? parseInt(d.numero, 10) : undefined; };
    return { contrato: n('contrato'), contraturno: n('contraturno'), aditivo: n('aditivo') };
  };

  /** Gera o Word de UM documento, registra o andamento e devolve o arquivo (sem baixar). */
  const gerarDocumento = async (l: Linha, tipo: TipoContrato): Promise<{ ok: true; nome: string; bytes: Uint8Array } | { ok: false; motivo: string }> => {
    if (l.faltas.length) return { ok: false, motivo: `Faltam dados do responsável: ${l.faltas.join(', ')}.` };
    const modelo = modelos.find(m => m.id === tipo);
    if (!modelo) return { ok: false, motivo: `Falta enviar o modelo "${NOMES_DOCS[tipo].nome}" (botão Modelos).` };

    const existente = docsRef.current.find(d => d.id === idDoc(l.aluno.id, tipo));
    const nums = numerosDoAluno(l.aluno.id);
    if (tipo === 'aditivo' && nums.contrato === undefined) return { ok: false, motivo: 'Gere antes o contrato: o aditivo cita o número dele.' };

    let numero = existente?.numero ? parseInt(existente.numero, 10) : undefined;
    if (numero === undefined) {
      if (tipo === 'imagem') {
        numero = numeroDoTermoDeImagem(nums);
        if (numero === undefined) return { ok: false, motivo: 'Gere antes o contrato: o termo de imagem usa o mesmo número dele.' };
      } else {
        numero = await proximoNumeroContrato(tipo, ANO);
      }
    }
    const numeros: NumerosContrato = tipo === 'imagem' ? { ...nums, contrato: numero } : { ...nums, [tipo]: numero };
    let bytes: Uint8Array;
    try {
      bytes = preencherModelo(base64ParaBytes(modelo.base64), montarDadosDoContrato(l.ctx, l.carta, numeros));
    } catch (e: any) {
      return { ok: false, motivo: String(e?.message || e) };
    }

    const versao = (existente?.versao || 0) + 1;
    const novo: ContratoDoc = {
      id: idDoc(l.aluno.id, tipo), alunoId: l.aluno.id, ano: ANO, tipo, status: 'gerado',
      numero: formatarNumeroDoc(numero), versao, geradoEm: isoHoje(),
      ...(existente?.link ? { link: existente.link } : {}),
      historico: existente ? [...(existente.historico || []), snapshot(existente)].slice(-10) : [],
    };
    await gravarDoc(novo);
    return { ok: true, nome: nomeDoArquivo(tipo, novo.numero!, ANO, l.aluno.nome, versao), bytes };
  };

  const aoGerar = async (l: Linha, tipo: TipoContrato) => {
    setOcupado(`${l.aluno.id}_${tipo}`);
    try {
      const r = await gerarDocumento(l, tipo);
      if (r.ok === false) { showToast('Não foi possível gerar', r.motivo, 'error', 7000); return; }
      baixarArquivo(r.nome, r.bytes);
      showToast(`${NOMES_DOCS[tipo].nome} pronto`, `${r.nome} foi baixado. Envie para a plataforma de assinatura.`, 'success');
    } catch (e: any) {
      showToast('Erro ao gerar', String(e?.message || e), 'error', 8000);
    } finally { setOcupado(null); }
  };

  /** Baixa de novo o mesmo documento (mesmo número e versão), refeito com os dados de hoje. */
  const aoBaixarDeNovo = async (l: Linha, tipo: TipoContrato) => {
    const modelo = modelos.find(m => m.id === tipo); const d = docDe(l.aluno.id, tipo);
    if (!modelo || !d?.numero) { showToast('Não foi possível baixar', 'Falta o modelo ou o registro do documento.', 'error'); return; }
    try {
      const nums = numerosDoAluno(l.aluno.id);
      const numero = parseInt(d.numero, 10);
      const numeros: NumerosContrato = tipo === 'imagem' ? { ...nums, contrato: numero } : { ...nums, [tipo]: numero };
      const bytes = preencherModelo(base64ParaBytes(modelo.base64), montarDadosDoContrato(l.ctx, l.carta, numeros));
      baixarArquivo(nomeDoArquivo(tipo, d.numero, ANO, l.aluno.nome, d.versao), bytes);
    } catch (e: any) { showToast('Erro ao baixar', String(e?.message || e), 'error'); }
  };

  const aoGerarLote = async () => {
    const alvo = linhas.filter(l => sel.has(l.aluno.id));
    if (!alvo.length) return;
    setOcupado('lote');
    const arquivos: { nome: string; bytes: Uint8Array }[] = [];
    let deFora = 0; const motivos = new Set<string>();
    try {
      for (const l of alvo) {
        if (l.faltas.length) { deFora++; continue; }
        for (const tipo of l.tipos) {
          // só o que ainda não foi gerado (correções a equipe refaz documento por documento); lê da fonte atualizada
          if (docsRef.current.some(d => d.id === idDoc(l.aluno.id, tipo))) continue;
          const r = await gerarDocumento(l, tipo);
          if (r.ok === false) motivos.add(r.motivo); else arquivos.push({ nome: r.nome, bytes: r.bytes });
        }
      }
      if (arquivos.length) {
        const d = new Date();
        baixarArquivo(`Contratos_${ANO}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.zip`, zipar(arquivos), 'application/zip');
      }
      setSel(new Set());
      const partes = [`${arquivos.length} ${arquivos.length === 1 ? 'documento gerado' : 'documentos gerados'}`];
      if (deFora) partes.push(`${deFora} ${deFora === 1 ? 'aluno ficou' : 'alunos ficaram'} de fora por falta de dados`);
      if (motivos.size) partes.push([...motivos].join(' '));
      showToast(arquivos.length ? 'Lote gerado' : 'Nada foi gerado', partes.join('. ') + '.', arquivos.length ? 'success' : 'error', 9000);
    } catch (e: any) {
      showToast('Erro ao gerar o lote', String(e?.message || e), 'error', 9000);
    } finally { setOcupado(null); }
  };

  // ---------- andamento ----------
  const muda = async (l: Linha, tipo: TipoContrato, status: StatusContrato) => {
    const d = docsRef.current.find(x => x.id === idDoc(l.aluno.id, tipo)); if (!d) return;
    const hoje = isoHoje();
    try {
      await gravarDoc({
        ...d, status: status as ContratoDoc['status'],
        ...(status === 'enviado' ? { enviadoEm: hoje } : {}), ...(status === 'assinado' ? { assinadoEm: hoje } : {}),
        historico: [...(d.historico || []), snapshot(d)].slice(-10),
      });
    } catch (e: any) { showToast('Não foi possível salvar', String(e?.message || e), 'error'); }
  };
  /** Marca vários documentos de uma vez (um por um, na ordem) — é o que a equipe faz ao mandar um grupo pra plataforma de assinatura. */
  const marcarVarios = async (itens: { l: Linha; t: TipoContrato }[], status: StatusContrato) => {
    for (const { l, t } of itens) await muda(l, t, status);
  };
  const aoMarcarEnviados = async () => {
    const itens = linhas.filter(l => sel.has(l.aluno.id)).flatMap(l => l.tipos.filter(t => statusDe(l.aluno.id, t) === 'gerado').map(t => ({ l, t })));
    if (!itens.length) return;
    setOcupado('lote');
    try {
      await marcarVarios(itens, 'enviado');
      setSel(new Set());
      showToast('Marcados como enviados', `${itens.length} ${itens.length === 1 ? 'documento' : 'documentos'} de ${new Set(itens.map(i => i.l.aluno.id)).size} ${new Set(itens.map(i => i.l.aluno.id)).size === 1 ? 'aluno' : 'alunos'}.`, 'success');
    } finally { setOcupado(null); }
  };
  const desfazer = async (l: Linha, tipo: TipoContrato) => {
    const d = docDe(l.aluno.id, tipo); const h = d?.historico?.[d.historico.length - 1];
    if (!d || !h || h.status === 'nao_gerado') return;
    try {
      await gravarDoc({ ...d, status: h.status as ContratoDoc['status'], versao: h.versao, geradoEm: h.geradoEm, enviadoEm: h.enviadoEm, assinadoEm: h.assinadoEm, historico: d.historico!.slice(0, -1) });
    } catch (e: any) { showToast('Não foi possível desfazer', String(e?.message || e), 'error'); }
  };
  const salvaCampo = async (l: Linha, tipo: TipoContrato, campo: 'link' | 'nota', valor: string) => {
    const d = docDe(l.aluno.id, tipo); if (!d || (d[campo] || '') === valor) return;
    try { await gravarDoc({ ...d, [campo]: valor }); } catch (e: any) { showToast('Não foi possível salvar', String(e?.message || e), 'error'); }
  };

  // ---------- modelos ----------
  const aoEscolherModelo = async (tipo: TipoContrato, arquivo: File | undefined) => {
    if (!arquivo) return;
    setErrosModelo(null);
    if (arquivo.size > TAMANHO_MAX_MODELO) { setErrosModelo({ tipo, erros: [`O arquivo tem ${Math.round(arquivo.size / 1024)} KB; o limite é ${Math.round(TAMANHO_MAX_MODELO / 1024)} KB. Reduza imagens do modelo.`] }); return; }
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const r = validarModelo(bytes);
    if (!r.ok) { setErrosModelo({ tipo, erros: r.erros }); return; }
    const novo: ContratoModelo = { id: tipo, nome: arquivo.name, base64: bytesParaBase64(bytes), tamanho: bytes.length, atualizadoEm: isoHoje(), marcadores: r.marcadores };
    try {
      await saveDocument('contratoModelos', novo);
      setModelos(prev => [...prev.filter(m => m.id !== tipo), novo]);
      showToast('Modelo salvo', `${NOMES_DOCS[tipo].nome}: ${arquivo.name} (${r.marcadores.length} marcadores reconhecidos).`, 'success');
    } catch (e: any) { showToast('Não foi possível salvar o modelo', String(e?.message || e), 'error', 8000); }
  };

  // ---------- recado pra família completar a ficha ----------
  const linkFicha = (alunoId: string) => `${window.location.origin}${window.location.pathname}?dadosGerais=${alunoId}`;
  const mensagemFicha = (l: Linha) => {
    const r = responsavelFinanceiro(guardians, l.aluno.id);
    const primeiro = (r?.nome || '').split(' ')[0] || 'tudo bem';
    return `Olá, ${primeiro}! Tudo bem?\n\nPara preparar o contrato de ${ANO} do(a) ${l.aluno.nome}, precisamos de algumas informações a mais na Ficha de Dados Gerais (${l.faltas.join(', ')}). Leva só um minutinho:\n\n${linkFicha(l.aluno.id)}\n\nObrigado!\nSítio-Escola Geranium`;
  };

  // =====================================================================
  const chip = (l: Linha, tipo: TipoContrato) => {
    const s = statusDe(l.aluno.id, tipo);
    return (
      <span key={tipo} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_INFO[s].chip}`} title={`${NOMES_DOCS[tipo].nome}: ${STATUS_INFO[s].rot}`}>
        <span aria-hidden="true">{STATUS_INFO[s].ic}</span>{NOMES_DOCS[tipo].curto}
        <span className="sr-only">, {STATUS_INFO[s].rot}</span>
      </span>
    );
  };

  if (carga === 'carregando') {
    return <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando contratos…</div>;
  }
  if (carga === 'erro') {
    return (
      <div className="max-w-xl mx-auto mt-10 p-5 bg-white border border-rose-200 rounded-xl space-y-3">
        <h3 className="font-bold text-rose-700 flex items-center gap-2"><AlertTriangle size={16} /> Não foi possível carregar os contratos</h3>
        <p className="text-xs text-slate-600">Se esta é a primeira vez que a aba é aberta, provavelmente as regras novas do banco de dados ainda não foram publicadas: copie o arquivo <strong>firestore.rules</strong> atualizado para o Firebase Console (Firestore → Regras → Publicar).</p>
        <p className="text-[11px] text-slate-400 break-words">Detalhe técnico: {erroCarga}</p>
        <button onClick={carregar} className="px-3 py-1.5 bg-brand-green-dark text-white text-xs font-bold rounded-lg cursor-pointer">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-brand-green-dark flex items-center gap-2"><FileText size={20} /> Contratos {ANO}</h2>
          <p className="text-xs text-slate-500 max-w-xl mt-0.5">Gere o Word preenchido, envie para a plataforma de assinatura e marque aqui o andamento. Aparecem só alunos com rematrícula confirmada.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar aluno ou responsável" aria-label="Buscar aluno ou responsável"
              className="text-xs pl-8 pr-3 py-2 w-56 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400" />
          </div>
          <button onClick={() => setPainelModelos(v => !v)} className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:border-slate-400 cursor-pointer">
            <Settings2 size={13} /> Modelos
            {modelosFaltando.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{modelosFaltando.length}</span>}
          </button>
        </div>
      </div>

      {/* Painel dos modelos Word */}
      {painelModelos && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Modelos dos documentos (Word)</h3>
            <p className="text-[11px] text-slate-500">Envie o arquivo .docx com os marcadores {'{{assim}}'}. Para alterar uma cláusula, baixe o modelo, edite no Word e envie de novo — vale para os próximos documentos gerados.</p>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {ORDEM_TIPOS.map(tipo => {
              const m = modelos.find(x => x.id === tipo);
              return (
                <div key={tipo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{NOMES_DOCS[tipo].nome}</p>
                    <p className="text-[10px] text-slate-400">{m ? `${m.nome} · ${Math.round(m.tamanho / 1024)} KB · enviado em ${dataBR(m.atualizadoEm)}` : 'Nenhum modelo enviado ainda'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m && (
                      <button onClick={() => baixarArquivo(m.nome, base64ParaBytes(m.base64))} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"><Download size={11} /> Baixar modelo</button>
                    )}
                    <label className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-md cursor-pointer ${m ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-brand-green-dark text-white hover:bg-emerald-900'}`}>
                      <Upload size={11} /> {m ? 'Substituir' : 'Enviar'}
                      <input type="file" accept=".docx" className="hidden" onChange={e => { aoEscolherModelo(tipo, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          {errosModelo && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
              <p className="font-bold">O modelo "{NOMES_DOCS[errosModelo.tipo].nome}" não foi salvo:</p>
              {errosModelo.erros.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {modelosFaltando.length > 0 && !painelModelos && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          Faltam modelos para gerar: {modelosFaltando.map(t => NOMES_DOCS[t].nome).join(', ')}. Abra <strong>Modelos</strong> e envie os arquivos Word.
        </div>
      )}

      {incompletos > 0 && (
        <button onClick={() => setSoIncompletos(v => !v)} className={`w-full text-left p-3 rounded-lg border text-xs cursor-pointer ${soIncompletos ? 'bg-amber-100 border-amber-400' : 'bg-amber-50 border-amber-200 hover:border-amber-400'} text-amber-900`}>
          <strong>{incompletos} {incompletos === 1 ? 'família ainda não completou' : 'famílias ainda não completaram'} os dados do responsável.</strong>{' '}
          O contrato só é gerado depois que estiverem preenchidos. {soIncompletos ? 'Mostrando só essas — toque para ver todas.' : 'Toque para ver quais.'}
        </button>
      )}

      {/* Filtros por andamento */}
      <nav className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0" aria-label="Filtrar por andamento">
        {ORDEM_STATUS.map(s => (
          <button key={s} onClick={() => setFiltroStatus(filtroStatus === s ? null : s)} aria-pressed={filtroStatus === s}
            className={`shrink-0 w-40 sm:w-auto text-left bg-white border rounded-lg px-3 py-2 cursor-pointer ${filtroStatus === s ? 'border-brand-orange ring-1 ring-brand-orange' : 'border-slate-200 hover:border-slate-400'}`}>
            <span className="block font-display font-bold text-xl text-brand-green-dark leading-tight">{contagem[s]}</span>
            <span className="text-[11px] text-slate-500"><span aria-hidden="true">{STATUS_INFO[s].ic}</span> {STATUS_INFO[s].kpi}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">Perfil
          <select value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value as any)} className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white">
            <option value="">Todos</option>
            {(Object.keys(NOMES_PERFIL) as PerfilContrato[]).map(p => <option key={p} value={p}>{NOMES_PERFIL[p][0].toUpperCase() + NOMES_PERFIL[p].slice(1)}</option>)}
          </select>
        </label>
        <span className="flex-1" />
        <button disabled={geradosSelecionados === 0 || ocupado !== null} onClick={aoMarcarEnviados}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          <Send size={13} /> Marcar como enviados ({geradosSelecionados})
        </button>
        <button disabled={sel.size === 0 || ocupado !== null} onClick={aoGerarLote}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {ocupado === 'lote' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Gerar selecionados ({sel.size})
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Clique no aluno para abrir os documentos e marcar <strong>enviado</strong> ou <strong>assinado</strong>. Para marcar vários de uma vez, selecione os alunos e use <strong>Marcar como enviados</strong>.
      </p>

      {/* Lista agrupada por turma de 2027 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {grupos.length === 0 && <p className="p-8 text-center text-sm text-slate-400">{linhas.length === 0 ? 'Ninguém com rematrícula confirmada ainda.' : 'Nenhum aluno com esse filtro. Limpe a busca ou escolha outro andamento.'}</p>}
        {grupos.map(([turma, itens]) => (
          <div key={turma}>
            <div className="px-4 py-2 bg-brand-green-dark/5 border-t border-slate-200 first:border-t-0 text-[11px] font-extrabold text-brand-green-dark">
              {turma} <span className="ml-1 font-medium text-slate-400">{itens.length} {itens.length === 1 ? 'aluno' : 'alunos'}</span>
            </div>
            {itens.map(l => {
              const r = responsavelFinanceiro(guardians, l.aluno.id);
              return (
                <div key={l.aluno.id} onClick={() => setAbertoId(l.aluno.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={sel.has(l.aluno.id)} aria-label={`Selecionar ${l.aluno.nome}`} onClick={e => e.stopPropagation()}
                    onChange={e => setSel(prev => { const n = new Set(prev); e.target.checked ? n.add(l.aluno.id) : n.delete(l.aluno.id); return n; })} className="w-3.5 h-3.5 cursor-pointer" />
                  <div className="w-64 min-w-0">
                    <button className="font-bold text-xs text-slate-800 text-left cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); setAbertoId(l.aluno.id); }}>{l.aluno.nome}</button>
                    <span className="block text-[11px] text-slate-500 truncate">{r?.nome || 'sem responsável'}, {NOMES_PERFIL[l.perfil]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-[240px]">{l.tipos.map(t => chip(l, t))}</div>
                  <div className="w-44 text-[11px] font-semibold">
                    {l.faltas.length ? <span className="text-rose-700">Faltam: {l.faltas.join(', ')}</span> : <span className="text-emerald-700">✔ Dados completos</span>}
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Gaveta do aluno */}
      {linhaAberta && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setAbertoId(null)} />
          <aside className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-brand-cream z-50 overflow-y-auto border-l border-slate-200 p-5 space-y-4" role="dialog" aria-label={`Documentos de ${linhaAberta.aluno.nome}`}>
            <GavetaAluno
              l={linhaAberta} guardians={guardians} docDe={docDe} ocupado={ocupado}
              onFechar={() => setAbertoId(null)} onGerar={aoGerar} onBaixar={aoBaixarDeNovo}
              onMuda={muda} onMudaVarios={(l, tipos, st) => marcarVarios(tipos.map(t => ({ l, t })), st)} onDesfazer={desfazer} onCampo={salvaCampo}
              mensagem={mensagemFicha(linhaAberta)} link={linkFicha(linhaAberta.aluno.id)} showToast={showToast}
            />
          </aside>
        </>
      )}
    </div>
  );
}

// ======================================================================
// Gaveta com os documentos e os dados de UM aluno
// ======================================================================
interface GavetaProps {
  l: Linha; guardians: Guardian[];
  docDe: (alunoId: string, tipo: TipoContrato) => ContratoDoc | undefined;
  ocupado: string | null;
  onFechar: () => void;
  onGerar: (l: Linha, t: TipoContrato) => void;
  onBaixar: (l: Linha, t: TipoContrato) => void;
  onMuda: (l: Linha, t: TipoContrato, s: StatusContrato) => void;
  onMudaVarios: (l: Linha, tipos: TipoContrato[], s: StatusContrato) => void;
  onDesfazer: (l: Linha, t: TipoContrato) => void;
  onCampo: (l: Linha, t: TipoContrato, campo: 'link' | 'nota', valor: string) => void;
  mensagem: string; link: string; showToast: ShowToast;
}

function GavetaAluno({ l, guardians, docDe, ocupado, onFechar, onGerar, onBaixar, onMuda, onMudaVarios, onDesfazer, onCampo, mensagem, link, showToast }: GavetaProps) {
  const r = responsavelFinanceiro(guardians, l.aluno.id);
  const c = l.carta;
  const falta = (campo: string) => l.faltas.includes(campo);
  const cel = (rotulo: string, valor: string | undefined, campo?: string) => (
    <div className={campo && falta(campo) ? 'text-rose-700 font-semibold' : ''}>
      <span className="block text-[10px] text-slate-400">{rotulo}</span>{campo && falta(campo) ? 'faltando' : (valor || '—')}
    </div>
  );
  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensagem); showToast('Mensagem copiada', 'Cole no WhatsApp da família.', 'success'); }
    catch { showToast('Não foi possível copiar', 'Copie o link manualmente: ' + link, 'error', 9000); }
  };
  const telefone = (r?.telefone || r?.contato || '').replace(/\D/g, '');
  const gerados = l.tipos.filter(t => docDe(l.aluno.id, t)?.status === 'gerado');

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg text-brand-green-dark">{l.aluno.nome}</h3>
          <p className="text-xs text-slate-500">{l.turmaNome} em {ANO}. Responsável financeiro: {r?.nome || '—'}.</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"><X size={16} /></button>
      </header>

      {l.faltas.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <p className="text-xs text-amber-900"><strong>Faltam dados do responsável:</strong> {l.faltas.join(', ')}. O contrato só é gerado depois que a família completar a ficha.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copiar} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"><Copy size={12} /> Copiar mensagem com o link</button>
            {telefone && (
              <a href={`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"><MessageCircle size={12} /> Abrir WhatsApp</a>
            )}
          </div>
        </div>
      )}

      {l.avisos.length > 0 && (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-900 space-y-1">
          {l.avisos.map((a, i) => <p key={i}>{a}</p>)}
        </div>
      )}

      <details className="bg-white border border-slate-200 rounded-lg p-3" open={l.faltas.length > 0}>
        <summary className="cursor-pointer text-xs font-bold text-slate-700">Dados que entram nos documentos</summary>
        <div className="mt-3 space-y-3 text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {cel('Responsável', r?.nome)}{cel('CPF', r?.cpf, 'CPF')}
            {cel('RG', r?.rg, 'RG')}{cel('Estado civil', r?.estadoCivil, 'estado civil')}
            {cel('Nacionalidade', r?.nacionalidade, 'nacionalidade')}{cel('Profissão', r?.profissao, 'profissão')}
            <div className="col-span-2">{cel('Endereço', r?.endereco, 'endereço')}</div>
            {cel('E-mail', r?.email, 'e-mail')}{cel('Telefone', r?.telefone || r?.contato, 'telefone')}
            {cel('Aluno(a)', l.aluno.nome)}{cel('Nascimento', dataBR(l.aluno.nascimento), 'data de nascimento do aluno')}
          </div>
          <div className="border-t border-slate-100 pt-2 space-y-1">
            <p className="text-[10px] font-bold text-slate-400">VALORES DA CARTA DE INTENÇÃO</p>
            {!c.somenteContraturno && (
              <>
                <p>Mensalidade combinada: <strong>R$ {formatarMoeda(c.mensalidade)}</strong>{c.temDesconto && <> (desconto de {formatarPercentual(c.descontoPercentual)}% sobre a tabela)</>}; 12 parcelas = R$ {formatarMoeda(c.mensalidade * 12)}.</p>
                {c.pontualidadeAtiva && <p>Pontualidade: mensalidade de R$ {formatarMoeda(c.mensalidadePontualidade)} pagando até 5 dias antes do vencimento.</p>}
                <p>Taxa de material: R$ {formatarMoeda(TAXA_MATERIAL_2027[c.natureza!])} em até {TAXA_MATERIAL_2027.parcelas}x. Lanche: {c.lancheAdiciona ? `aderiu, R$ ${formatarMoeda(c.lancheValor)}` : `não aderiu (valor de referência R$ ${formatarMoeda(c.lancheValor)})`}.</p>
              </>
            )}
            {c.contraturno && (
              <p>Contraturno: {c.contraturno.frequencia}x por semana ({diasPorExtenso(c.contraturno.dias)}), {c.contraturno.periodo === 'Completo' ? 'das 12h às 18h' : 'das 12h às 15h'}; valor combinado <strong>R$ {formatarMoeda(c.contraturno.valor)}</strong>{c.contraturno.temDesconto && <> (desconto de {formatarPercentual(c.contraturno.descontoPercentual)}% sobre R$ {formatarMoeda(c.contraturno.valorTabela)})</>}.</p>
            )}
            <p>Vencimento: dia {c.diaVencimento}.</p>
          </div>
        </div>
      </details>

      {gerados.length >= 2 && (
        <button onClick={() => onMudaVarios(l, gerados, 'enviado')} disabled={ocupado !== null}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-orange-700 disabled:opacity-50 cursor-pointer">
          <Send size={13} /> Marcar os {gerados.length} documentos gerados como enviados
        </button>
      )}

      {l.tipos.map(tipo => {
        const d = docDe(l.aluno.id, tipo);
        const s: StatusContrato = d?.status || 'nao_gerado';
        const trabalhando = ocupado === `${l.aluno.id}_${tipo}`;
        const bloqueado = l.faltas.length > 0 || ocupado !== null;
        const tempo = [d?.geradoEm && `Gerado em ${ddmm(d.geradoEm)}`, d?.enviadoEm && `Enviado em ${ddmm(d.enviadoEm)}`, d?.assinadoEm && `Assinado em ${ddmm(d.assinadoEm)}`].filter(Boolean);
        const btn = 'px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
        const pri = `${btn} bg-brand-orange text-white hover:bg-orange-700`;
        const sec = `${btn} bg-white border border-slate-200 hover:border-slate-400`;
        const fan = 'px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer';
        return (
          <article key={tipo} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-800">{NOMES_DOCS[tipo].nome}</h4>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_INFO[s].chip}`}><span aria-hidden="true">{STATUS_INFO[s].ic}</span>{STATUS_INFO[s].rot}</span>
            </div>
            <p className="text-xs text-slate-500">
              {d?.numero
                ? `Nº ${numTexto(d)}${tipo === 'imagem' ? ' (mesmo número do contrato)' : ''}${d.versao > 1 ? `, versão ${d.versao}` : ''}`
                : tipo === 'imagem' ? 'O número é o mesmo do contrato, definido ao gerar.' : 'O número é dado pelo sistema ao gerar (sequência do ano).'}
            </p>
            {tempo.length > 0 && <ul className="text-[11px] text-slate-400">{tempo.map((t, i) => <li key={i}>{t}</li>)}</ul>}

            {s === 'enviado' && (
              <label className="block text-[11px] text-slate-500">Número ou link na plataforma de assinatura (opcional)
                <input defaultValue={d?.link || ''} onBlur={e => onCampo(l, tipo, 'link', e.target.value.trim())} placeholder="Ex.: AUT-8841" className="mt-1 w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50" />
              </label>
            )}
            {s === 'assinado' && d?.link && <p className="text-[11px] text-slate-500">Na plataforma de assinatura: {d.link}</p>}
            {s === 'correcao' && (
              <label className="block text-[11px] text-slate-500">O que precisa mudar
                <textarea defaultValue={d?.nota || ''} onBlur={e => onCampo(l, tipo, 'nota', e.target.value.trim())} placeholder="Descreva a correção" className="mt-1 w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 min-h-[52px]" />
              </label>
            )}
            {s === 'nao_gerado' && l.faltas.length > 0 && <p className="text-[11px] text-rose-700">Complete os dados do responsável para gerar.</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {s === 'nao_gerado' && <button className={pri} disabled={bloqueado} onClick={() => onGerar(l, tipo)}>{trabalhando ? 'Gerando…' : 'Gerar Word'}</button>}
              {s === 'gerado' && (<>
                <button className={pri} onClick={() => onMuda(l, tipo, 'enviado')}>Marcar como enviado para assinatura</button>
                <button className={sec} disabled={ocupado !== null} onClick={() => onBaixar(l, tipo)}>Baixar de novo</button>
                <button className={fan} onClick={() => onMuda(l, tipo, 'correcao')}>Precisa de correção</button>
              </>)}
              {s === 'enviado' && (<>
                <button className={pri} onClick={() => onMuda(l, tipo, 'assinado')}>Marcar como assinado</button>
                <button className={fan} onClick={() => onMuda(l, tipo, 'correcao')}>Precisa de correção</button>
              </>)}
              {s === 'assinado' && <button className={sec} disabled={ocupado !== null} onClick={() => onBaixar(l, tipo)}>Baixar cópia do Word</button>}
              {s === 'correcao' && <button className={pri} disabled={bloqueado} onClick={() => onGerar(l, tipo)}>{trabalhando ? 'Gerando…' : 'Gerar nova versão (mantém o número)'}</button>}
              {d?.historico && d.historico.length > 0 && d.historico[d.historico.length - 1].status !== 'nao_gerado' && (
                <button className={fan} onClick={() => onDesfazer(l, tipo)}>Desfazer último passo</button>
              )}
            </div>
          </article>
        );
      })}
      <p className="text-[11px] text-slate-400">O número é gerado pelo sistema na primeira vez e se mantém nas correções (muda só a versão). Cada tipo de documento tem a sua própria sequência.</p>
    </>
  );
}
