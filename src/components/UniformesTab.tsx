import React, { useEffect, useMemo, useState } from 'react';
import {
  Shirt, Plus, Link2, MessageCircle, Lock, Unlock, Loader2, Search, Printer, Download, Trash2, X,
  CheckCircle2, Truck, Ban, RotateCcw, AlertTriangle, PackageCheck, Save, Receipt, ListChecks, Settings2, FileSpreadsheet, Users, Upload, Inbox,
} from 'lucide-react';
import { deleteDocument, getCollectionData, getDocumentById } from '../firebase';
import { moeda } from '../situacao/situacao';
import type { Student, Guardian, Enrollment, ContraturnoSegment, RegularClass, ContraturnoPrice } from '../types';
import type { ContratoContexto } from '../contratos/montarDados';
import {
  COL_CATALOGO, ROTULO_SITUACAO, situacaoDoEnvio, listaFornecedor, juntarItens, totalItens, qtdPecas, novoCodigo,
  novoIdCampanha, linkPublicoUniformes, mensagemDivulgacao, telefoneZap, dataHoraBR, separarLista, slug, compararTamanho,
  parcelasDe, valoresParcelas, valorPago, comParcelasPagas, textoPagamento, compararPagamentos, type MudancaPagamento,
  COL_PEDIDOS, type PecaCatalogo, type CampanhaUniforme, type PedidoUniformeDoc, type EnvioUniforme, type SituacaoEnvio,
} from '../uniformes/uniformes';
import {
  carregarCatalogo, carregarCampanhas, carregarPedidos, semearCatalogo, alterarEnvio, acrescentarEnvio,
  salvarPedidoAvulso, salvarCampanha, salvarPeca, carregarFamilias, publicarFamilias,
} from '../uniformes/uniformesDb';
import { montarFamilias, type FamiliaUniforme } from '../uniformes/familias';
import { baixarPlanilhaUniformes, lerPagamentosDaPlanilha } from '../uniformes/planilha';
import {
  COL_PROPOSTAS, diferencas, aplicarProposta, descartarProposta, linkFormularioCatalogo, mensagemFormularioCatalogo,
  type PropostaCatalogo,
} from '../uniformes/catalogoPropostas';
import SeletorUniformes, { EscolhaPagamento, itensDaSelecao, selecaoIncompleta, type SelecaoUniformes, type CriancaUniforme } from './SeletorUniformes';

type ShowToast = (title: string, description?: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
type Aba = 'pedidos' | 'fornecedor' | 'recibos' | 'catalogo';

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const inputCls = 'w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none';
const labelCls = 'text-[11px] font-bold text-slate-500';
const btnCls = 'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-50';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface LinhaEnvio { pedido: PedidoUniformeDoc; envio: EnvioUniforme }

async function copiar(texto: string, showToast: ShowToast, oque: string) {
  try { await navigator.clipboard.writeText(texto); showToast(oque, texto.length < 120 ? texto : undefined, 'success'); }
  catch { window.prompt('Copie:', texto); }
}

function abrirImpressao(html: string, showToast: ShowToast) {
  const w = window.open('', '_blank');
  if (!w) { showToast('O navegador bloqueou a janela de impressão', 'Permita pop-ups para este site e tente de novo.', 'error', 8000); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function baixarCsv(nome: string, cab: string[], linhas: unknown[][]) {
  const cel = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const num = (x: unknown) => (typeof x === 'number' ? String(x).replace('.', ',') : x);
  const csv = '﻿' + [cab.map(cel).join(';'), ...linhas.map(l => l.map(v => cel(num(v))).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

interface UniformesTabProps {
  students: Student[];
  guardians: Guardian[];
  enrollments: Enrollment[];
  contraturnos: ContraturnoSegment[];
  classPrices: RegularClass[];
  contraturnoPrices: ContraturnoPrice[];
  showToast: ShowToast;
}

const pagou = (e: EnvioUniforme) => parcelasDe(e).pagas > 0;
const ehAvulso = (p: PedidoUniformeDoc) => !p.grupo && !p.cpfHash;

export default function UniformesTab({ students, guardians, enrollments, contraturnos, classPrices, contraturnoPrices, showToast }: UniformesTabProps) {
  const [carregando, setCarregando] = useState(true);
  const [catalogo, setCatalogo] = useState<PecaCatalogo[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaUniforme[]>([]);
  const [pedidos, setPedidos] = useState<PedidoUniformeDoc[]>([]);
  const [propostas, setPropostas] = useState<PropostaCatalogo[]>([]);
  const [campanhaId, setCampanhaId] = useState('');
  const [aba, setAba] = useState<Aba>('pedidos');
  const [novoAberto, setNovoAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [familias, setFamilias] = useState<{ total: number; semCpf: string[]; quando: string; erro?: boolean } | null>(null);
  const [verSemCpf, setVerSemCpf] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [importacao, setImportacao] = useState<{ arquivo: string; mudancas: MudancaPagamento[]; avisos: string[]; iguais: number } | null>(null);
  const arquivoRef = React.useRef<HTMLInputElement>(null);

  const lerPlanilhaDePagamentos = async (f: File) => {
    try {
      const lidas = await lerPagamentosDaPlanilha(f);
      const r = compararPagamentos(pedidos, lidas);
      setImportacao({ arquivo: f.name, ...r });
    } catch (e: any) {
      showToast('Não foi possível ler a planilha', String(e?.message || e), 'error', 10000);
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const aplicarPagamentos = async () => {
    if (!importacao) return;
    setOcupado(true);
    let ok = 0, falhas = 0;
    for (const m of importacao.mudancas) {
      try { await alterarEnvio(m.pedidoId, m.codigo, x => comParcelasPagas(x, m.depois)); ok++; }
      catch { falhas++; }
    }
    const alterados = importacao.mudancas.map(m => m.pedidoId);
    setImportacao(null);
    await recarregarPedidos(alterados);
    setOcupado(false);
    showToast(falhas ? 'Pagamentos atualizados com falhas' : 'Pagamentos atualizados',
      `${ok} ${ok === 1 ? 'pedido atualizado' : 'pedidos atualizados'}${falhas ? ` · ${falhas} não foram gravados, tente de novo` : ''}`, falhas ? 'error' : 'success', 8000);
  };

  /**
   * Publica sozinho o resumo das famílias (CPF de qualquer responsável → nome, telefone, crianças e turma).
   * Roda ao abrir a aba e grava só o que mudou. Sem alunos carregados não faz nada (para não apagar tudo).
   */
  const atualizarFamilias = async (avisar = false) => {
    if (students.length === 0) return;
    try {
      const ctxs = students.map(aluno => ({ student: aluno, guardians, enrollments, classPrices, contraturnoPrices, contraturnos } as ContratoContexto));
      const { docs, semCpf } = await montarFamilias(ctxs);
      const r = await publicarFamilias(docs);
      setFamilias({ total: docs.length, semCpf, quando: new Date().toISOString() });
      if (avisar) showToast('Famílias atualizadas', `${docs.length} responsáveis · ${r.gravados} alterados · ${r.removidos} removidos`, 'success');
    } catch {
      setFamilias(f => ({ total: f?.total || 0, semCpf: f?.semCpf || [], quando: new Date().toISOString(), erro: true }));
      if (avisar) showToast('Não foi possível atualizar as famílias', 'Confira se as regras do Firestore (bloco UNIFORMES) foram publicadas.', 'error', 9000);
    }
  };
  useEffect(() => { atualizarFamilias(); }, [students, guardians, enrollments, classPrices]);

  const carregar = async () => {
    try {
      const [cat, camp, ped] = await Promise.all([carregarCatalogo(), carregarCampanhas(), carregarPedidos()]);
      setCatalogo(cat); setCampanhas(camp); setPedidos(ped);
      // Propostas do formulário de catálogo (se as regras ainda não foram publicadas, só não aparecem).
      getCollectionData<PropostaCatalogo>(COL_PROPOSTAS)
        .then(ps => setPropostas(ps.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))))
        .catch(() => setPropostas([]));
      setCampanhaId(atual => (atual && camp.some(c => c.id === atual)) ? atual : (camp.find(c => c.aberta)?.id || camp[0]?.id || ''));
    } catch {
      showToast('Não foi possível carregar os uniformes', 'Confira se as regras do Firestore com o bloco UNIFORMES foram publicadas no Firebase Console.', 'error', 10000);
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const campanha = campanhas.find(c => c.id === campanhaId) || null;
  const linhas: LinhaEnvio[] = useMemo(() => pedidos
    .filter(p => p.campanhaId === campanhaId)
    .flatMap(p => p.envios.map(envio => ({ pedido: p, envio })))
    .sort((a, b) => b.envio.criadoEm.localeCompare(a.envio.criadoEm)), [pedidos, campanhaId]);

  const kpi = useMemo(() => {
    const validos = linhas.filter(l => !l.envio.cancelado);
    return {
      pedidos: validos.length,
      familias: new Set(validos.map(l => l.pedido.id)).size,
      pecas: validos.reduce((s, l) => s + qtdPecas(l.envio.itens), 0),
      total: validos.reduce((s, l) => s + l.envio.total, 0),
      pago: validos.reduce((s, l) => s + valorPago(l.envio), 0),
      entregues: validos.filter(l => l.envio.entregue).length,
    };
  }, [linhas]);

  /* ---------- lotes ---------- */
  const abrirNovoLote = async () => {
    const sugestao = `Uniformes 2027 · ${campanhas.length + 1}º pedido`;
    const nome = window.prompt('Nome do novo pedido (aparece para as famílias):', sugestao);
    if (!nome?.trim()) return;
    const abertas = campanhas.filter(c => c.aberta);
    if (abertas.length && !window.confirm(`"${abertas.map(c => c.nome).join('", "')}" está aberto e será encerrado. Continuar?`)) return;
    setOcupado(true);
    try {
      const agora = new Date().toISOString();
      for (const c of abertas) await salvarCampanha({ ...c, aberta: false, encerradaEm: agora });
      const nova: CampanhaUniforme = { id: novoIdCampanha(), nome: nome.trim(), aberta: true, criadaEm: agora };
      await salvarCampanha(nova);
      setCampanhaId(nova.id);
      await carregar();
      showToast('Pedido aberto', 'As famílias já podem pedir pelo link.', 'success');
    } catch { showToast('Não foi possível abrir o pedido', undefined, 'error'); }
    finally { setOcupado(false); }
  };

  const alternarLote = async () => {
    if (!campanha) return;
    if (campanha.aberta) {
      if (!window.confirm(`Encerrar "${campanha.nome}"? As famílias deixam de conseguir pedir, mas continuam consultando os pedidos.`)) return;
    } else {
      const outra = campanhas.find(c => c.aberta && c.id !== campanha.id);
      if (outra && !window.confirm(`"${outra.nome}" está aberto e será encerrado para reabrir este. Continuar?`)) return;
    }
    setOcupado(true);
    try {
      const agora = new Date().toISOString();
      if (!campanha.aberta) for (const c of campanhas.filter(c => c.aberta)) await salvarCampanha({ ...c, aberta: false, encerradaEm: agora });
      await salvarCampanha(campanha.aberta ? { ...campanha, aberta: false, encerradaEm: agora } : { ...campanha, aberta: true });
      await carregar();
      showToast(campanha.aberta ? 'Pedido encerrado' : 'Pedido reaberto', undefined, 'success');
    } catch { showToast('Não foi possível salvar', undefined, 'error'); }
    finally { setOcupado(false); }
  };

  const editarAviso = async () => {
    if (!campanha) return;
    const aviso = window.prompt('Aviso no topo da página das famílias (ex.: prazo, data de entrega). Deixe em branco para tirar:', campanha.aviso || '');
    if (aviso === null) return;
    const { aviso: _, ...resto } = campanha;
    await salvarCampanha(aviso.trim() ? { ...resto, aviso: aviso.trim() } : resto);
    await carregar();
  };

  /* ---------- envios ---------- */
  // Relê só os pedidos que mudaram (antes cada clique relia todos os pedidos, o catálogo e os lotes).
  const recarregarPedidos = async (ids: string[]) => {
    const unicos = [...new Set(ids)];
    const lidos = await Promise.all(unicos.map(id => getDocumentById<PedidoUniformeDoc>(COL_PEDIDOS, id).catch(() => undefined)));
    setPedidos(prev => {
      let lista = [...prev];
      unicos.forEach((id, i) => {
        const novo = lidos[i];
        if (novo === undefined) return; // falhou a leitura: mantém o que estava
        lista = lista.filter(p => p.id !== id);
        if (novo) lista.push(novo);
      });
      return lista;
    });
  };

  const mudarEnvio = async (l: LinhaEnvio, mudar: (e: EnvioUniforme) => EnvioUniforme | null, ok?: string) => {
    try {
      await alterarEnvio(l.pedido.id, l.envio.codigo, mudar);
      await recarregarPedidos([l.pedido.id]);
      if (ok) showToast(ok, undefined, 'success');
    } catch { showToast('Não foi possível salvar', undefined, 'error'); }
  };

  if (carregando) return <div className="py-20 flex justify-center text-slate-500 gap-2 text-sm"><Loader2 className="animate-spin" size={18} /> Carregando uniformes…</div>;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl text-brand-green-dark flex items-center gap-2"><Shirt size={20} /> Uniformes</h2>
            <p className="text-xs text-slate-500 mt-1">As famílias pedem pelo link com o CPF de qualquer responsável cadastrado; nome, telefone e crianças vêm do cadastro.</p>
            {familias && (
              <p className={`text-xs mt-1 flex flex-wrap items-center gap-x-2 ${familias.erro ? 'text-rose-700' : 'text-slate-600'}`}>
                <Users size={13} className="inline" />
                {familias.erro ? 'Não foi possível atualizar as famílias (confira as regras do Firestore).' : `${familias.total} responsáveis com CPF liberados para pedir · atualizado ${dataHoraBR(familias.quando)}`}
                {familias.semCpf.length > 0 && (
                  <button onClick={() => setVerSemCpf(v => !v)} className="text-amber-800 font-bold underline">
                    {familias.semCpf.length} {familias.semCpf.length === 1 ? 'criança sem' : 'crianças sem'} CPF de responsável
                  </button>
                )}
                <button onClick={() => atualizarFamilias(true)} className="text-brand-green-light font-bold underline">atualizar agora</button>
              </p>
            )}
            {verSemCpf && familias && familias.semCpf.length > 0 && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 max-w-2xl">
                Estas famílias não conseguem pedir pelo link (nenhum responsável com CPF válido): {familias.semCpf.join(', ')}. Cadastre o CPF na ficha do aluno ou faça o pedido pela equipe.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copiar(linkPublicoUniformes(), showToast, 'Link copiado')} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><Link2 size={14} /> Copiar link</button>
            <button onClick={() => copiar(mensagemDivulgacao(linkPublicoUniformes()), showToast, 'Mensagem copiada')} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><MessageCircle size={14} /> Mensagem para o WhatsApp</button>
            <button onClick={abrirNovoLote} disabled={ocupado} className={`${btnCls} bg-brand-orange border-brand-orange text-white hover:bg-brand-orange-hover`}><Plus size={14} /> Abrir novo pedido</button>
          </div>
        </div>

        {campanhas.length === 0 ? (
          <div className="bg-brand-cream border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
            Nenhum pedido aberto ainda. Clique em <strong>Abrir novo pedido</strong> para começar. Quando quiser parar de receber, encerre o pedido; depois é só abrir outro.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select value={campanhaId} onChange={e => setCampanhaId(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold">
              {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.aberta ? ' (aberto)' : ''}</option>)}
            </select>
            {campanha && <>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${campanha.aberta ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {campanha.aberta ? 'Recebendo pedidos' : `Encerrado${campanha.encerradaEm ? ' em ' + dataHoraBR(campanha.encerradaEm) : ''}`}
              </span>
              <button onClick={alternarLote} disabled={ocupado} className={`${btnCls} ${campanha.aberta ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                {campanha.aberta ? <><Lock size={14} /> Encerrar pedido</> : <><Unlock size={14} /> Reabrir</>}
              </button>
              <button onClick={editarAviso} className={`${btnCls} border-slate-200 text-slate-600 hover:bg-slate-50`}>{campanha.aviso ? 'Editar aviso' : 'Pôr aviso para as famílias'}</button>
            </>}
          </div>
        )}

        {catalogo.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <span>O catálogo está vazio. Carregue a lista de 2027 (10 peças, mesmos preços da planilha) e ajuste o que precisar.</span>
            <button onClick={async () => { const n = await semearCatalogo(catalogo); await carregar(); showToast(`${n} peças carregadas`, undefined, 'success'); }}
              className={`${btnCls} bg-amber-600 border-amber-600 text-white`}>Carregar lista 2027</button>
          </div>
        )}
      </div>

      {campanha && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['Famílias', String(kpi.familias)], ['Pedidos', String(kpi.pedidos)], ['Peças', String(kpi.pecas)],
              ['Total', moeda(kpi.total)], ['Pago', moeda(kpi.pago)], ['Entregues', `${kpi.entregues} de ${kpi.pedidos}`],
            ].map(([r, v]) => (
              <div key={r} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{r}</div>
                <div className="text-lg font-black text-brand-green-dark">{v}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-1 border-b border-slate-200">
            {([
              ['pedidos', 'Pedidos', ListChecks], ['fornecedor', 'Lista para a fornecedora', Truck],
              ['recibos', 'Recibos de entrega', Receipt], ['catalogo', 'Catálogo e preços', Settings2],
            ] as [Aba, string, typeof Truck][]).map(([id, rot, Ic]) => (
              <button key={id} onClick={() => setAba(id)}
                className={`px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px ${aba === id ? 'border-brand-orange text-brand-green-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Ic size={14} /> {rot}
                {id === 'catalogo' && propostas.some(p => p.status === 'nova') && (
                  <span className="ml-1 text-[10px] font-black bg-brand-orange text-white rounded-full px-1.5 py-0.5">{propostas.filter(p => p.status === 'nova').length}</span>
                )}
              </button>
            ))}
            <button onClick={async () => {
              setBaixando(true);
              try {
                await baixarPlanilhaUniformes({
                  campanha, pedidos: pedidos.filter(p => p.campanhaId === campanha.id),
                  ordemPeca: nome => catalogo.find(p => p.nome === nome)?.ordem ?? 999,
                });
              } catch { showToast('Não foi possível gerar a planilha', undefined, 'error'); }
              finally { setBaixando(false); }
            }} disabled={baixando || linhas.length === 0}
              title="Uma planilha com três abas: Pedidos, Fornecedora e Recibos"
              className={`${btnCls} ml-auto mb-1.5 bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800`}>
              {baixando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Baixar planilha (.xlsx)
            </button>
            <input ref={arquivoRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) lerPlanilhaDePagamentos(f); }} />
            <button onClick={() => arquivoRef.current?.click()} disabled={ocupado}
              title="Lê a aba Pagamentos da planilha (SIM/NÃO) e mostra o que vai mudar antes de gravar"
              className={`${btnCls} mb-1.5 border-emerald-700 text-emerald-800 hover:bg-emerald-50`}>
              <Upload size={14} /> Atualizar pagamentos
            </button>
          </div>

          {aba === 'pedidos' && <AbaPedidos linhas={linhas} catalogo={catalogo} campanha={campanha} onMudar={mudarEnvio} onNovo={() => setNovoAberto(true)} />}
          {aba === 'fornecedor' && <AbaFornecedor linhas={linhas} catalogo={catalogo} campanha={campanha} showToast={showToast} />}
          {aba === 'recibos' && <AbaRecibos linhas={linhas} campanha={campanha} showToast={showToast} onMudar={mudarEnvio} />}
        </>
      )}
      {aba === 'catalogo' && <AbaCatalogo catalogo={catalogo} propostas={propostas} onSalvo={carregar} showToast={showToast} />}
      {!campanha && campanhas.length === 0 && catalogo.length > 0 && aba !== 'catalogo' && (
        <button onClick={() => setAba('catalogo')} className="text-xs font-bold text-brand-green-light underline">Ver catálogo e preços</button>
      )}

      {importacao && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Atualizar pagamentos">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-6 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-bold text-lg text-brand-green-dark">Atualizar pagamentos</h3>
                <p className="text-xs text-slate-500">{importacao.arquivo} · {importacao.iguais} {importacao.iguais === 1 ? 'pedido igual' : 'pedidos iguais'} ao sistema</p>
              </div>
              <button onClick={() => setImportacao(null)} aria-label="Fechar" className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {importacao.mudancas.length === 0 ? (
                <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">Nada para mudar: a planilha está igual ao sistema.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500 text-left">
                    <tr><th className="py-1.5">Pedido</th><th className="py-1.5">Responsável</th><th className="py-1.5 text-center">No sistema</th><th className="py-1.5 text-center">Na planilha</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importacao.mudancas.map(m => (
                      <tr key={m.codigo}>
                        <td className="py-1.5 font-mono text-xs font-bold text-slate-600">{m.codigo}</td>
                        <td className="py-1.5 text-slate-800">{m.responsavel}</td>
                        <td className="py-1.5 text-center text-slate-500">{m.antes} de {m.n}</td>
                        <td className={`py-1.5 text-center font-bold ${m.depois > m.antes ? 'text-emerald-700' : 'text-rose-700'}`}>{m.depois} de {m.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {importacao.avisos.length > 0 && (
                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="font-bold flex items-center gap-1"><AlertTriangle size={13} /> Atenção</div>
                  {importacao.avisos.map((a, i) => <div key={i}>{a}</div>)}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setImportacao(null)} className={`${btnCls} border-slate-200 text-slate-600`}>Cancelar</button>
              <button onClick={aplicarPagamentos} disabled={ocupado || importacao.mudancas.length === 0} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}>
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aplicar {importacao.mudancas.length} {importacao.mudancas.length === 1 ? 'mudança' : 'mudanças'}
              </button>
            </div>
          </div>
        </div>
      )}

      {novoAberto && campanha && (
        <NovoPedidoEquipe campanha={campanha} catalogo={catalogo} showToast={showToast}
          onFechar={() => setNovoAberto(false)} onSalvo={async () => { setNovoAberto(false); await carregar(); }} />
      )}
    </div>
  );
}

/* ================================================================== */
/* Pedidos                                                             */
/* ================================================================== */

function AbaPedidos({ linhas, catalogo, campanha, onMudar, onNovo }: {
  linhas: LinhaEnvio[]; catalogo: PecaCatalogo[]; campanha: CampanhaUniforme;
  onMudar: (l: LinhaEnvio, mudar: (e: EnvioUniforme) => EnvioUniforme | null, ok?: string) => Promise<void>;
  onNovo: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'' | SituacaoEnvio>('');

  const precoDe = useMemo(() => new Map(catalogo.map(p => [p.nome, p.preco])), [catalogo]);
  const filtradas = linhas.filter(l => {
    if (filtro && situacaoDoEnvio(l.envio) !== filtro) return false;
    if (!busca.trim()) return true;
    const alvo = norm([l.envio.codigo, l.envio.responsavel, l.envio.telefone, ...l.envio.itens.map(i => i.crianca)].join(' '));
    return alvo.includes(norm(busca.trim()));
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por responsável, criança ou nº do pedido" className={`${inputCls} pl-8`} />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value as '' | SituacaoEnvio)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white">
          <option value="">Todas as situações</option>
          {(Object.keys(ROTULO_SITUACAO) as SituacaoEnvio[]).map(s => <option key={s} value={s}>{ROTULO_SITUACAO[s].rot}</option>)}
        </select>
        <button onClick={onNovo} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}><Plus size={14} /> Novo pedido pela equipe</button>
      </div>

      {filtradas.length === 0 && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6 text-center">
          {linhas.length === 0 ? 'Nenhum pedido neste lote ainda.' : 'Nenhum pedido com esse filtro.'}
        </p>
      )}

      {filtradas.map(l => {
        const e = l.envio;
        const s = situacaoDoEnvio(e);
        const somaItens = totalItens(e.itens);
        const precoEstranho = e.itens.some(i => precoDe.has(i.peca) && Math.abs((precoDe.get(i.peca) || 0) - i.preco) > 0.001);
        const zap = telefoneZap(e.telefone);
        return (
          <div key={`${l.pedido.id}-${e.codigo}`} className={`bg-white rounded-xl border p-4 space-y-3 ${e.cancelado ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{e.codigo}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ROTULO_SITUACAO[s].chip}`}>{ROTULO_SITUACAO[s].rot}</span>
                  {e.origem === 'equipe' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">feito pela equipe</span>}
                  {ehAvulso(l.pedido) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">avulso</span>}
                </div>
                <div className="font-bold text-slate-800">{e.responsavel}</div>
                <div className="text-xs text-slate-500">
                  {dataHoraBR(e.criadoEm)} · {zap ? <a href={`https://wa.me/${zap}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold underline">{e.telefone}</a> : 'sem telefone'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-brand-green-dark">{moeda(e.total)}</div>
                <div className="text-[11px] text-slate-500">{qtdPecas(e.itens)} {qtdPecas(e.itens) === 1 ? "peça" : "peças"} · {textoPagamento(e)}</div>
              </div>
            </div>

            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {e.itens.map((i, n) => (
                  <tr key={n}>
                    <td className="py-1 pr-2"><span className="font-semibold text-slate-700">{i.crianca}</span> <span className="text-slate-400">· {i.turma}</span></td>
                    <td className="py-1 pr-2 text-slate-800">{i.peca}</td>
                    <td className="py-1 pr-2 text-slate-600">{i.cor}</td>
                    <td className="py-1 pr-2 text-slate-600">Tam. {i.tamanho}</td>
                    <td className="py-1 pr-2 text-center">{i.qtd}×</td>
                    <td className="py-1 text-right">{moeda(i.preco * i.qtd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {e.obs && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2"><strong>Obs.:</strong> {e.obs}</p>}
            {(precoEstranho || Math.abs(somaItens - e.total) > 0.001) && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-1.5">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {Math.abs(somaItens - e.total) > 0.001 ? `O total gravado (${moeda(e.total)}) não bate com a soma das peças (${moeda(somaItens)}). ` : ''}
                {precoEstranho ? 'Alguma peça está com preço diferente do catálogo atual. Confira antes de confirmar o pagamento.' : ''}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!e.cancelado && <>
                <ControleParcelas e={e} onMarcar={(pagas, ok) => onMudar(l, x => comParcelasPagas(x, pagas), ok)} />
                <button onClick={() => onMudar(l, x => ({ ...x, entregue: !x.entregue }), e.entregue ? 'Entrega desmarcada' : 'Marcado como entregue')}
                  className={`${btnCls} ${e.entregue ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'}`}>
                  <PackageCheck size={14} /> {e.entregue ? 'Entregue' : 'Marcar entregue'}
                </button>
              </>}
              <button onClick={() => { if (e.cancelado || window.confirm(`Cancelar o pedido ${e.codigo}? Ele sai da lista da fornecedora e dos recibos.`)) onMudar(l, x => ({ ...x, cancelado: !x.cancelado }), e.cancelado ? 'Pedido reativado' : 'Pedido cancelado'); }}
                className={`${btnCls} border-slate-200 text-slate-600 hover:bg-slate-50`}>
                {e.cancelado ? <><RotateCcw size={14} /> Reativar</> : <><Ban size={14} /> Cancelar</>}
              </button>
              {e.cancelado && (
                <button onClick={() => { if (window.confirm(`Apagar de vez o pedido ${e.codigo}? Não dá para desfazer.`)) onMudar(l, () => null, 'Pedido apagado'); }}
                  className={`${btnCls} border-rose-200 text-rose-700 hover:bg-rose-50`}><Trash2 size={14} /> Apagar</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Botões das parcelas: clicar numa parcela marca até ela como paga; clicar de novo na última paga desmarca. */
function ControleParcelas({ e, onMarcar }: { e: EnvioUniforme; onMarcar: (pagas: number, ok: string) => void }) {
  const { n, pagas } = parcelasDe(e);
  const vals = valoresParcelas(e.total, n);
  if (n === 1) {
    return (
      <button onClick={() => onMarcar(pagas ? 0 : 1, pagas ? 'Pagamento desmarcado' : 'Marcado como pago')}
        className={`${btnCls} ${pagas ? 'bg-sky-600 border-sky-600 text-white' : 'border-sky-200 text-sky-800 hover:bg-sky-50'}`}>
        <CheckCircle2 size={14} /> {pagas ? 'Pago à vista' : 'Marcar pago (à vista)'}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-sky-200 p-1" role="group" aria-label="Parcelas pagas">
      <span className="text-[11px] font-bold text-sky-800 px-1.5">Parcelas pagas:</span>
      {vals.map((v, i) => {
        const paga = i < pagas;
        const alvo = paga && i === pagas - 1 ? i : i + 1;
        return (
          <button key={i} onClick={() => onMarcar(alvo, `${alvo} de ${n} parcelas pagas`)} title={`${i + 1}ª parcela · ${moeda(v)}`}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-md border ${paga ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-sky-50'}`}>
            {paga ? '✓ ' : ''}{i + 1}ª
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* Lista para a fornecedora                                            */
/* ================================================================== */

function AbaFornecedor({ linhas, catalogo, campanha, showToast }: {
  linhas: LinhaEnvio[]; catalogo: PecaCatalogo[]; campanha: CampanhaUniforme; showToast: ShowToast;
}) {
  const [soPagos, setSoPagos] = useState(false);
  const envios = linhas.map(l => l.envio).filter(e => !soPagos || pagou(e));
  const ordem = (nome: string) => catalogo.find(p => p.nome === nome)?.ordem ?? 999;
  const lista = listaFornecedor(envios, ordem);
  const total = lista.reduce((s, l) => s + l.qtd, 0);

  // Grade: uma tabela por peça e cor, com os tamanhos em colunas.
  const grupos = useMemo(() => {
    const g = new Map<string, { peca: string; cor: string; porTam: Map<string, number>; total: number }>();
    for (const l of lista) {
      const k = `${l.peca}|${l.cor}`;
      if (!g.has(k)) g.set(k, { peca: l.peca, cor: l.cor, porTam: new Map(), total: 0 });
      const x = g.get(k)!;
      x.porTam.set(l.tamanho, (x.porTam.get(l.tamanho) || 0) + l.qtd);
      x.total += l.qtd;
    }
    return [...g.values()];
  }, [lista]);
  const tamanhos = [...new Set(lista.map(l => l.tamanho))].sort(compararTamanho);

  const imprimir = () => {
    const cab = tamanhos.map(t => `<th class="c">${esc(t)}</th>`).join('');
    const corpo = grupos.map(g => `<tr><td><b>${esc(g.peca)}</b></td><td>${esc(g.cor)}</td>${tamanhos.map(t => `<td class="c">${g.porTam.get(t) || ''}</td>`).join('')}<td class="c"><b>${g.total}</b></td></tr>`).join('');
    const totTam = tamanhos.map(t => `<td class="c"><b>${grupos.reduce((s, g) => s + (g.porTam.get(t) || 0), 0) || ''}</b></td>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista para a fornecedora — ${esc(campanha.nome)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Inter, Arial, sans-serif; color: #1f2937; margin: 0; font-size: 12px; }
        .topo { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1F3F24; padding-bottom: 8px; margin-bottom: 12px; }
        .topo img { height: 46px; } h1 { font-size: 18px; margin: 0; color: #1F3F24; } .sub { color: #4b5563; font-size: 12px; }
        .tot { margin-left: auto; text-align: right; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F5F1E6; text-align: left; font-size: 11px; padding: 6px; border: 1px solid #cbd5e1; }
        td { padding: 6px; border: 1px solid #cbd5e1; } .c { text-align: center; width: 44px; }
        tfoot td { background: #F5F1E6; }
      </style></head><body>
      <div class="topo"><img src="${LOGO}" alt="Sítio-Escola Geranium">
        <div><h1>Pedido de uniformes · Sítio-Escola Geranium</h1><div class="sub">${esc(campanha.nome)}${soPagos ? ' · só pedidos pagos' : ''} · gerado em ${esc(dataHoraBR(new Date().toISOString()))}</div></div>
        <div class="tot"><b>${total}</b> peças</div></div>
      <table><thead><tr><th>Peça</th><th>Cor</th>${cab}<th class="c">Total</th></tr></thead>
      <tbody>${corpo}</tbody><tfoot><tr><td colspan="2"><b>Total por tamanho</b></td>${totTam}<td class="c"><b>${total}</b></td></tr></tfoot></table>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script></body></html>`;
    abrirImpressao(html, showToast);
  };

  const exportar = () => baixarCsv(`uniformes-fornecedora-${slug(campanha.nome)}.csv`, ['Peça', 'Cor', 'Tamanho', 'Quantidade'], lista.map(l => [l.peca, l.cor, l.tamanho, l.qtd]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={soPagos} onChange={e => setSoPagos(e.target.checked)} /> Só pedidos com pagamento (à vista ou 1ª parcela)</label>
        <span className="text-xs text-slate-500">Pedidos cancelados não entram.</span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportar} disabled={lista.length === 0} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><Download size={14} /> CSV</button>
          <button onClick={imprimir} disabled={lista.length === 0} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}><Printer size={14} /> Imprimir / PDF</button>
        </div>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6 text-center">Nada para encomendar ainda.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-sand text-[11px] uppercase tracking-wide text-slate-600">
              <tr><th className="text-left px-3 py-2">Peça</th><th className="text-left px-3 py-2">Cor</th>
                {tamanhos.map(t => <th key={t} className="px-2 py-2 text-center">{t}</th>)}<th className="px-3 py-2 text-center">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupos.map(g => (
                <tr key={`${g.peca}|${g.cor}`}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{g.peca}</td>
                  <td className="px-3 py-2 text-slate-600">{g.cor}</td>
                  {tamanhos.map(t => <td key={t} className="px-2 py-2 text-center">{g.porTam.get(t) || <span className="text-slate-300">·</span>}</td>)}
                  <td className="px-3 py-2 text-center font-black text-brand-green-dark">{g.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-brand-sand/60 font-bold">
              <tr><td className="px-3 py-2" colSpan={2}>Total por tamanho</td>
                {tamanhos.map(t => <td key={t} className="px-2 py-2 text-center">{grupos.reduce((s, g) => s + (g.porTam.get(t) || 0), 0) || ''}</td>)}
                <td className="px-3 py-2 text-center text-brand-green-dark">{total}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Recibos de entrega                                                  */
/* ================================================================== */

interface ReciboFamilia { pedido: PedidoUniformeDoc; envios: EnvioUniforme[]; linhas: LinhaEnvio[] }

function AbaRecibos({ linhas, campanha, showToast, onMudar }: {
  linhas: LinhaEnvio[]; campanha: CampanhaUniforme; showToast: ShowToast;
  onMudar: (l: LinhaEnvio, mudar: (e: EnvioUniforme) => EnvioUniforme | null, ok?: string) => Promise<void>;
}) {
  const [soPagos, setSoPagos] = useState(false);
  const [ocultarEntregues, setOcultarEntregues] = useState(true);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const recibos: ReciboFamilia[] = useMemo(() => {
    const m = new Map<string, ReciboFamilia>();
    for (const l of [...linhas].reverse()) {
      const e = l.envio;
      if (e.cancelado || (soPagos && !pagou(e)) || (ocultarEntregues && e.entregue)) continue;
      if (!m.has(l.pedido.id)) m.set(l.pedido.id, { pedido: l.pedido, envios: [], linhas: [] });
      m.get(l.pedido.id)!.envios.push(e);
      m.get(l.pedido.id)!.linhas.push(l);
    }
    return [...m.values()].sort((a, b) => a.envios[0].responsavel.localeCompare(b.envios[0].responsavel, 'pt-BR'));
  }, [linhas, soPagos, ocultarEntregues]);

  useEffect(() => { setMarcados(new Set(recibos.map(r => r.pedido.id))); }, [recibos]);
  const escolhidos = recibos.filter(r => marcados.has(r.pedido.id));

  const htmlRecibo = (r: ReciboFamilia) => {
    const itens = r.envios.flatMap(e => e.itens);
    const total = r.envios.reduce((s, e) => s + e.total, 0);
    const resp = r.envios[r.envios.length - 1];
    const criancas = [...new Set(itens.map(i => i.crianca))].join(', ');
    const corpo = itens.map(i => `<tr><td>${esc(i.crianca)}</td><td>${esc(i.peca)}</td><td>${esc(i.cor)}</td><td class="c">${esc(i.tamanho)}</td><td class="c">${i.qtd}</td><td class="r">${esc(moeda(i.preco * i.qtd))}</td></tr>`).join('');
    return `<div class="recibo">
      <div class="cab"><img src="${LOGO}" alt=""><div><div class="tit">RECIBO DE ENTREGA DE UNIFORMES</div><div class="sub">Sítio-Escola Geranium · ${esc(campanha.nome)}</div></div>
        <div class="ped">Pedido${r.envios.length > 1 ? 's' : ''}<br><b>${r.envios.map(e => esc(e.codigo)).join(', ')}</b></div></div>
      <div class="dados"><div><span>Responsável:</span> <b>${esc(resp.responsavel)}</b></div><div><span>Telefone:</span> ${esc(resp.telefone)}</div><div class="full"><span>Aluno(a):</span> <b>${esc(criancas)}</b></div></div>
      <table><thead><tr><th>Criança</th><th>Peça</th><th>Cor</th><th class="c">Tam.</th><th class="c">Qtd</th><th class="r">Valor</th></tr></thead><tbody>${corpo}</tbody>
      <tfoot><tr><td colspan="5" class="r"><b>TOTAL</b></td><td class="r"><b>${esc(moeda(total))}</b></td></tr></tfoot></table>
      <div class="pag">Pagamento: ${esc(r.envios.map(e => (r.envios.length > 1 ? e.codigo + ': ' : '') + textoPagamento(e)).join(' · '))}</div>
      <div class="ass"><div>Recebido em ____/____/________</div><div class="linha">Assinatura do responsável</div></div>
    </div>`;
  };

  const imprimir = (lista: ReciboFamilia[]) => {
    if (lista.length === 0) return;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibos de entrega — ${esc(campanha.nome)}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Inter, Arial, sans-serif; color: #1f2937; margin: 0; font-size: 11px; }
        .recibo { border: 1px solid #94a3b8; border-radius: 8px; padding: 10px 12px; page-break-inside: avoid; break-inside: avoid; }
        .corte { text-align: center; color: #94a3b8; margin: 8px 0; font-size: 10px; letter-spacing: 2px; }
        .cab { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #1F3F24; padding-bottom: 6px; margin-bottom: 6px; }
        .cab img { height: 34px; } .tit { font-weight: 800; color: #1F3F24; font-size: 13px; } .sub { color: #4b5563; font-size: 10px; }
        .ped { margin-left: auto; text-align: right; font-size: 10px; color: #4b5563; }
        .dados { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin-bottom: 6px; } .dados .full { grid-column: 1 / -1; } .dados span { color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F5F1E6; text-align: left; font-size: 10px; padding: 3px 5px; border: 1px solid #cbd5e1; }
        td { padding: 3px 5px; border: 1px solid #cbd5e1; } .c { text-align: center; width: 40px; } .r { text-align: right; width: 80px; }
        tfoot td { background: #FFF8E1; }
        .pag { text-align: right; font-style: italic; margin-top: 4px; }
        .ass { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; gap: 20px; }
        .ass .linha { border-top: 1px solid #1f2937; width: 55%; text-align: center; padding-top: 2px; font-size: 9px; }
      </style></head><body>
      ${lista.map(htmlRecibo).join('<div class="corte">- - - - - - - - - - ✂ - - - - - - - - - - ✂ - - - - - - - - - -</div>')}
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script></body></html>`;
    abrirImpressao(html, showToast);
  };

  const marcarEntregue = async (r: ReciboFamilia) => {
    if (!window.confirm(`Marcar como entregue o pedido de ${r.envios[0].responsavel}?`)) return;
    for (const l of r.linhas) await onMudar(l, x => ({ ...x, entregue: true }));
    showToast('Marcado como entregue', undefined, 'success');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={soPagos} onChange={e => setSoPagos(e.target.checked)} /> Só pedidos com pagamento</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={ocultarEntregues} onChange={e => setOcultarEntregues(e.target.checked)} /> Esconder os já entregues</label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => imprimir(escolhidos)} disabled={escolhidos.length === 0} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}>
            <Printer size={14} /> Imprimir {escolhidos.length} {escolhidos.length === 1 ? 'recibo' : 'recibos'}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">Um recibo por família, juntando todos os pedidos dela neste lote (cancelados não entram).</p>

      {recibos.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6 text-center">Nenhum recibo com esse filtro.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          <label className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50">
            <input type="checkbox" checked={escolhidos.length === recibos.length}
              onChange={e => setMarcados(e.target.checked ? new Set(recibos.map(r => r.pedido.id)) : new Set())} /> Marcar todos
          </label>
          {recibos.map(r => {
            const itens = r.envios.flatMap(e => e.itens);
            const total = r.envios.reduce((s, e) => s + e.total, 0);
            const pago = r.envios.every(e => e.pago);
            const algum = r.envios.some(pagou);
            return (
              <div key={r.pedido.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <input type="checkbox" checked={marcados.has(r.pedido.id)} aria-label={`Incluir ${r.envios[0].responsavel}`}
                  onChange={e => { const s = new Set(marcados); if (e.target.checked) s.add(r.pedido.id); else s.delete(r.pedido.id); setMarcados(s); }} />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-slate-800 text-sm">{r.envios[r.envios.length - 1].responsavel}</div>
                  <div className="text-xs text-slate-500">{[...new Set(itens.map(i => i.crianca))].join(', ')} · {qtdPecas(itens)} peças · {r.envios.map(e => e.codigo).join(', ')}</div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${pago ? ROTULO_SITUACAO.pago.chip : algum ? ROTULO_SITUACAO.parcial.chip : ROTULO_SITUACAO.aguardando.chip}`}>{r.envios.map(textoPagamento).join(' · ')}</span>
                <span className="font-black text-brand-green-dark text-sm w-24 text-right">{moeda(total)}</span>
                <button onClick={() => imprimir([r])} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><Printer size={14} /> Recibo</button>
                {r.envios.some(e => !e.entregue) && (
                  <button onClick={() => marcarEntregue(r)} className={`${btnCls} border-emerald-200 text-emerald-800 hover:bg-emerald-50`}><PackageCheck size={14} /> Entregue</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Catálogo                                                            */
/* ================================================================== */

interface PecaEdit { id: string; nome: string; cores: string; tamanhos: string; preco: string; ativo: boolean; ordem: number; obs: string; novo?: boolean }

const paraEdit = (p: PecaCatalogo): PecaEdit => ({
  id: p.id, nome: p.nome, cores: p.cores.join(', '), tamanhos: p.tamanhos.join(', '),
  preco: String(p.preco).replace('.', ','), ativo: p.ativo, ordem: p.ordem, obs: p.obs || '',
});

function AbaCatalogo({ catalogo, propostas, onSalvo, showToast }: { catalogo: PecaCatalogo[]; propostas: PropostaCatalogo[]; onSalvo: () => Promise<void>; showToast: ShowToast }) {
  const [linhas, setLinhas] = useState<PecaEdit[]>(() => catalogo.map(paraEdit));
  const [salvando, setSalvando] = useState<string>('');
  useEffect(() => { setLinhas(catalogo.map(paraEdit)); }, [catalogo]);

  const mudar = (id: string, campo: keyof PecaEdit, v: string | boolean) => setLinhas(ls => ls.map(l => (l.id === id ? { ...l, [campo]: v } : l)));

  const salvar = async (l: PecaEdit) => {
    const preco = Number(l.preco.replace(/\./g, '').replace(',', '.'));
    const cores = separarLista(l.cores), tamanhos = separarLista(l.tamanhos);
    if (!l.nome.trim() || !(preco > 0) || cores.length === 0 || tamanhos.length === 0) {
      showToast('Confira a peça', 'Nome, preço, pelo menos uma cor e um tamanho são obrigatórios.', 'error'); return;
    }
    const id = l.novo ? (slug(l.nome) || `peca-${Date.now()}`) : l.id;
    if (l.novo && catalogo.some(p => p.id === id)) { showToast('Já existe uma peça com esse nome', undefined, 'error'); return; }
    setSalvando(l.id);
    try {
      await salvarPeca({ id, nome: l.nome.trim(), cores, tamanhos, preco, ativo: l.ativo, ordem: Number(l.ordem) || 0, ...(l.obs.trim() ? { obs: l.obs.trim() } : {}) });
      await onSalvo();
      showToast('Peça salva', 'O preço novo vale para os próximos pedidos.', 'success');
    } catch { showToast('Não foi possível salvar', undefined, 'error'); }
    finally { setSalvando(''); }
  };

  const apagar = async (l: PecaEdit) => {
    if (l.novo) { setLinhas(ls => ls.filter(x => x.id !== l.id)); return; }
    if (!window.confirm(`Apagar "${l.nome}" do catálogo? Os pedidos já feitos não mudam. Se for só tirar de venda, desmarque "À venda".`)) return;
    await deleteDocument(COL_CATALOGO, l.id);
    await onSalvo();
  };

  const nova = () => setLinhas(ls => [...ls, {
    id: `novo-${Date.now()}`, nome: '', cores: '', tamanhos: '2, 4, 6, 8, 10, 12, 14, P', preco: '', ativo: true,
    ordem: Math.max(0, ...ls.map(x => x.ordem)) + 1, obs: '', novo: true,
  }]);

  return (
    <div className="space-y-4">
      <PropostasCatalogo catalogo={catalogo} propostas={propostas} onSalvo={onSalvo} showToast={showToast} />
      <p className="text-xs text-slate-500">Cores e tamanhos separados por vírgula. Mudar o preço vale só para os pedidos novos; os já feitos ficam com o preço da época.</p>
      <div className="space-y-2">
        {linhas.map(l => (
          <div key={l.id} className={`bg-white rounded-xl border p-3 grid grid-cols-12 gap-2 items-end ${l.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
            <div className="col-span-12 sm:col-span-3 space-y-1"><label className={labelCls}>Peça</label><input className={inputCls} value={l.nome} onChange={e => mudar(l.id, 'nome', e.target.value)} disabled={!l.novo} title={l.novo ? '' : 'Para trocar o nome, crie uma peça nova e tire esta de venda'} /></div>
            <div className="col-span-6 sm:col-span-3 space-y-1"><label className={labelCls}>Cores</label><input className={inputCls} value={l.cores} onChange={e => mudar(l.id, 'cores', e.target.value)} /></div>
            <div className="col-span-6 sm:col-span-3 space-y-1"><label className={labelCls}>Tamanhos</label><input className={inputCls} value={l.tamanhos} onChange={e => mudar(l.id, 'tamanhos', e.target.value)} /></div>
            <div className="col-span-4 sm:col-span-1 space-y-1"><label className={labelCls}>Preço (R$)</label><input className={inputCls} value={l.preco} onChange={e => mudar(l.id, 'preco', e.target.value)} inputMode="decimal" /></div>
            <div className="col-span-3 sm:col-span-1 space-y-1"><label className={labelCls}>Ordem</label><input className={inputCls} type="number" value={l.ordem} onChange={e => mudar(l.id, 'ordem', e.target.value)} /></div>
            <label className="col-span-5 sm:col-span-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2"><input type="checkbox" checked={l.ativo} onChange={e => mudar(l.id, 'ativo', e.target.checked)} /> À venda</label>
            <div className="col-span-12 sm:col-span-9 space-y-1"><label className={labelCls}>Observação para as famílias (opcional)</label><input className={inputCls} value={l.obs} onChange={e => mudar(l.id, 'obs', e.target.value)} /></div>
            <div className="col-span-12 sm:col-span-3 flex gap-2 justify-end">
              <button onClick={() => apagar(l)} className={`${btnCls} border-rose-200 text-rose-700 hover:bg-rose-50`}><Trash2 size={14} /></button>
              <button onClick={() => salvar(l)} disabled={salvando === l.id} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}>
                {salvando === l.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={nova} className={`${btnCls} border-slate-300 text-slate-700 hover:bg-slate-50`}><Plus size={14} /> Nova peça</button>
    </div>
  );
}

/** Formulário para mandar a quem cuida dos uniformes + propostas recebidas por ele. */
function PropostasCatalogo({ catalogo, propostas, onSalvo, showToast }: {
  catalogo: PecaCatalogo[]; propostas: PropostaCatalogo[]; onSalvo: () => Promise<void>; showToast: ShowToast;
}) {
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const novas = propostas.filter(p => p.status === 'nova');
  const resolvidas = propostas.filter(p => p.status !== 'nova');
  const visiveis = verResolvidas ? propostas : novas;

  const aplicar = async (p: PropostaCatalogo) => {
    if (!window.confirm(`Aplicar no catálogo as mudanças enviadas por ${p.nome}? Os pedidos já feitos não mudam.`)) return;
    setOcupado(p.id);
    try { const n = await aplicarProposta(catalogo, p); await onSalvo(); showToast('Catálogo atualizado', `${n} ${n === 1 ? 'peça alterada' : 'peças alteradas'}`, 'success'); }
    catch { showToast('Não foi possível aplicar', undefined, 'error'); }
    finally { setOcupado(''); }
  };
  const descartar = async (p: PropostaCatalogo) => {
    if (!window.confirm(`Descartar a proposta de ${p.nome}? O catálogo não muda.`)) return;
    setOcupado(p.id);
    try { await descartarProposta(p); await onSalvo(); } catch { showToast('Não foi possível descartar', undefined, 'error'); }
    finally { setOcupado(''); }
  };

  const ROT_TIPO = { nova: ['Peça nova', 'bg-emerald-100 text-emerald-800'], alterada: ['Alterada', 'bg-sky-100 text-sky-800'], retirada: ['Sai de venda', 'bg-rose-100 text-rose-800'], volta: ['Volta a vender', 'bg-emerald-100 text-emerald-800'] } as const;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Inbox size={15} /> Formulário de atualização do catálogo</h3>
          <p className="text-xs text-slate-500 mt-0.5">Mande o link para quem cuida dos uniformes (ex.: a fornecedora). O que for enviado aparece aqui para conferir antes de entrar no catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => copiar(linkFormularioCatalogo(), showToast, 'Link do formulário copiado')} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><Link2 size={14} /> Copiar link</button>
          <button onClick={() => copiar(mensagemFormularioCatalogo(linkFormularioCatalogo()), showToast, 'Mensagem copiada')} className={`${btnCls} border-slate-200 text-slate-700 hover:bg-slate-50`}><MessageCircle size={14} /> Mensagem para o WhatsApp</button>
        </div>
      </div>

      {novas.length === 0 && !verResolvidas && <p className="text-xs text-slate-500">Nenhuma proposta nova.</p>}

      {visiveis.map(p => {
        const difs = diferencas(catalogo, p);
        return (
          <div key={p.id} className={`rounded-lg border p-3 space-y-2 ${p.status === 'nova' ? 'border-brand-orange/50 bg-orange-50/40' : 'border-slate-200 opacity-70'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-800">{p.nome}{p.contato ? <span className="font-normal text-slate-500"> · {p.contato}</span> : null}</div>
                <div className="text-[11px] text-slate-500">Enviada em {dataHoraBR(p.criadaEm)}{p.status !== 'nova' ? ` · ${p.status === 'aplicada' ? 'aplicada' : 'descartada'} em ${dataHoraBR(p.resolvidaEm)}` : ''}</div>
              </div>
              {p.status === 'nova' && (
                <div className="flex gap-2">
                  <button onClick={() => descartar(p)} disabled={!!ocupado} className={`${btnCls} border-slate-200 text-slate-600 hover:bg-slate-50`}><X size={14} /> Descartar</button>
                  <button onClick={() => aplicar(p)} disabled={!!ocupado || difs.length === 0} className={`${btnCls} bg-brand-green-dark border-brand-green-dark text-white`}>
                    {ocupado === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aplicar no catálogo
                  </button>
                </div>
              )}
            </div>
            {p.obsGeral && <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded p-2 whitespace-pre-line"><strong>Observações:</strong> {p.obsGeral}</p>}
            {difs.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma diferença em relação ao catálogo atual.</p>
            ) : (
              <ul className="space-y-1.5">
                {difs.map(d => (
                  <li key={d.pecaId} className="text-xs bg-white border border-slate-200 rounded p-2">
                    <div className="flex items-center gap-2"><strong className="text-slate-800">{d.nome}</strong><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROT_TIPO[d.tipo][1]}`}>{ROT_TIPO[d.tipo][0]}</span></div>
                    {d.itens.map((it, i) => (
                      <div key={i} className="text-slate-600 mt-0.5">
                        <span className="text-slate-500">{it.campo}:</span>{' '}
                        {it.antes && <><span className="line-through text-slate-400">{it.antes}</span> → </>}
                        <span className="font-semibold text-slate-800">{it.depois || '(vazio)'}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {resolvidas.length > 0 && (
        <button onClick={() => setVerResolvidas(v => !v)} className="text-xs font-bold text-brand-green-light underline">
          {verResolvidas ? 'Esconder propostas já resolvidas' : `Ver ${resolvidas.length} ${resolvidas.length === 1 ? 'proposta já resolvida' : 'propostas já resolvidas'}`}
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/* Novo pedido pela equipe                                             */
/* ================================================================== */

function NovoPedidoEquipe({ campanha, catalogo, showToast, onFechar, onSalvo }: {
  campanha: CampanhaUniforme; catalogo: PecaCatalogo[]; showToast: ShowToast; onFechar: () => void; onSalvo: () => Promise<void>;
}) {
  const [lista, setLista] = useState<FamiliaUniforme[] | null>(null);
  const [busca, setBusca] = useState('');
  const [familia, setFamilia] = useState<FamiliaUniforme | null>(null);
  const [avulso, setAvulso] = useState(false);
  const [avulsoNome, setAvulsoNome] = useState('');
  const [avulsoTurma, setAvulsoTurma] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [obs, setObs] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [pagas, setPagas] = useState(0);
  const [selecao, setSelecao] = useState<SelecaoUniformes>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregarFamilias().then(setLista).catch(() => setLista([])); }, []);

  const criancas: CriancaUniforme[] = avulso
    ? (avulsoNome.trim() ? [{ nome: avulsoNome.trim(), turma: avulsoTurma.trim() || 'Não informada' }] : [])
    : (familia?.criancas || []);

  const resultados = useMemo(() => {
    if (!lista || busca.trim().length < 2) return [];
    const q = norm(busca.trim());
    return lista
      .filter(f => norm(f.responsavel).includes(q) || f.criancas.some(c => norm(c.nome).includes(q)))
      .sort((a, b) => a.responsavel.localeCompare(b.responsavel, 'pt-BR'))
      .slice(0, 10);
  }, [lista, busca]);

  const escolher = (f: FamiliaUniforme) => {
    setFamilia(f); setSelecao({}); setResponsavel(f.responsavel); setTelefone(f.telefone);
  };

  const itens = itensDaSelecao(selecao, catalogo, criancas);
  const total = totalItens(itens);

  const salvar = async () => {
    if (!responsavel.trim()) { showToast('Escreva o nome do responsável', undefined, 'error'); return; }
    if (itens.length === 0) { showToast('Escolha pelo menos uma peça', undefined, 'error'); return; }
    if (selecaoIncompleta(selecao)) { showToast('Falta tamanho ou cor em alguma peça', undefined, 'error'); return; }
    const juntos = juntarItens(itens);
    const base: EnvioUniforme = {
      codigo: novoCodigo(), criadoEm: new Date().toISOString(), responsavel: responsavel.trim(), telefone: telefone.trim(),
      itens: juntos, total: totalItens(juntos), pago: false, entregue: false, cancelado: false, origem: 'equipe',
      parcelas, parcelasPagas: 0,
      ...(obs.trim() ? { obs: obs.trim() } : {}),
    };
    const envio = comParcelasPagas(base, pagas);
    setSalvando(true);
    try {
      if (familia && !avulso) await acrescentarEnvio(campanha.id, familia.grupo, envio);
      else await salvarPedidoAvulso(campanha.id, envio);
      showToast('Pedido registrado', `${envio.codigo} · ${moeda(envio.total)}`, 'success');
      await onSalvo();
    } catch { showToast('Não foi possível salvar o pedido', undefined, 'error'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Novo pedido pela equipe">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-6 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-display font-bold text-lg text-brand-green-dark">Novo pedido · {campanha.nome}</h3>
          <button onClick={onFechar} aria-label="Fechar" className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          {!campanha.aberta && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">Este lote está encerrado para as famílias, mas a equipe ainda pode lançar pedidos nele.</p>}

          <div className="flex gap-2">
            <button onClick={() => { setAvulso(false); setSelecao({}); }} className={`${btnCls} ${!avulso ? 'bg-brand-green-dark border-brand-green-dark text-white' : 'border-slate-200 text-slate-600'}`}>Família cadastrada</button>
            <button onClick={() => { setAvulso(true); setFamilia(null); setSelecao({}); setResponsavel(''); setTelefone(''); }} className={`${btnCls} ${avulso ? 'bg-brand-green-dark border-brand-green-dark text-white' : 'border-slate-200 text-slate-600'}`}>Outra pessoa (sem CPF no sistema)</button>
          </div>

          {!avulso && !familia && (
            <div className="space-y-2">
              <label className={labelCls}>Procure pelo nome da criança ou do responsável</label>
              <input className={inputCls} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Digite ao menos 2 letras" autoFocus />
              {lista === null && <p className="text-xs text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Carregando famílias…</p>}
              {lista && lista.length === 0 && <p className="text-xs text-amber-800">Nenhuma família publicada ainda. Clique em "atualizar agora" no topo da aba, ou use "Outra pessoa".</p>}
              <div className="space-y-1">
                {resultados.map(f => (
                  <button key={f.id} onClick={() => escolher(f)} className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-brand-cream text-sm">
                    <span className="block font-bold text-slate-800">{f.responsavel} <span className="font-normal text-slate-500">· {f.parentesco}{f.telefone ? ` · ${f.telefone}` : ''}</span></span>
                    <span className="block text-xs text-slate-600">{f.criancas.map(c => `${c.nome} (${c.turma})`).join(', ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!avulso && familia && (
            <div className="bg-brand-cream border border-slate-200 rounded-lg p-3 text-sm flex items-start justify-between gap-3">
              <div>{familia.criancas.map(c => <div key={c.nome}><strong>{c.nome}</strong> <span className="text-slate-500">· {c.turma}</span></div>)}</div>
              <button onClick={() => { setFamilia(null); setSelecao({}); }} className="text-xs font-bold text-brand-green-light underline">trocar</button>
            </div>
          )}

          {avulso && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1"><label className={labelCls}>Nome da criança (ou de quem vai usar)</label><input className={inputCls} value={avulsoNome} onChange={e => setAvulsoNome(e.target.value)} /></div>
              <div className="space-y-1"><label className={labelCls}>Turma</label><input className={inputCls} value={avulsoTurma} onChange={e => setAvulsoTurma(e.target.value)} placeholder="Ex.: Fundamental 2º ano, Funcionário" /></div>
            </div>
          )}

          {(familia || avulso) && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><label className={labelCls}>Responsável</label><input className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} /></div>
                <div className="space-y-1"><label className={labelCls}>Telefone</label><input className={inputCls} value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
              </div>
              {criancas.length > 0
                ? <SeletorUniformes catalogo={catalogo} criancas={criancas} selecao={selecao} onChange={setSelecao} />
                : <p className="text-xs text-slate-500">Escreva o nome para escolher as peças.</p>}
              {itens.length > 0 && (
                <div className="space-y-2">
                  <label className={labelCls}>Forma de pagamento</label>
                  <EscolhaPagamento total={total} parcelas={parcelas} onChange={n => { setParcelas(n); setPagas(p => Math.min(p, n)); }} />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Já pagas:
                    <select value={pagas} onChange={e => setPagas(Number(e.target.value))} className="text-sm px-2 py-1 rounded-lg border border-slate-200">
                      {Array.from({ length: parcelas + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'nenhuma' : parcelas === 1 ? 'pago' : `${i} de ${parcelas}`}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <div className="space-y-1"><label className={labelCls}>Observação</label><input className={inputCls} value={obs} onChange={e => setObs(e.target.value)} /></div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <div><div className="text-[10px] font-bold uppercase text-slate-500">{qtdPecas(itens)} peças{parcelas > 1 ? ` · ${parcelas}x` : ''}</div><div className="text-lg font-black text-brand-green-dark">{moeda(total)}</div></div>
          <div className="flex gap-2">
            <button onClick={onFechar} className={`${btnCls} border-slate-200 text-slate-600`}>Cancelar</button>
            <button onClick={salvar} disabled={salvando || itens.length === 0} className={`${btnCls} bg-brand-orange border-brand-orange text-white`}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registrar pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
