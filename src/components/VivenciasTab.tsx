import React, { useEffect, useMemo, useState } from 'react';
import {
  Sprout, Plus, Link2, Pencil, Users, ArrowLeft, Printer, Download, Search, Trash2, X, Loader2,
  CalendarDays, Clock, MessageCircle, Check, UserPlus, Lock, Unlock,
} from 'lucide-react';
import { getCollectionData, saveDocument, deleteDocument } from '../firebase';
import type { Vivencia, VivenciaInscricao, PresencaVivencia, RegularClass } from '../types';
import {
  COL_VIVENCIAS, COL_INSCRICOES, COMO_CONHECEU_OPCOES, PARENTESCO_VIVENCIA,
  dataPorExtenso, dataBR, horario, faixaEtaria, textoIdade, numeroWhatsApp, hojeISO, novoId, linkPublico,
  turmaDeInteresse, ANO_INTERESSE,
} from '../vivencias';

type ShowToast = (title: string, description?: string, type?: 'success' | 'error' | 'info', duration?: number) => void;

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const inputCls = 'w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none';
const labelCls = 'text-[11px] font-bold text-slate-500';

const PRESENCA_INFO: Record<PresencaVivencia, { rot: string; cls: string }> = {
  pendente: { rot: 'Aguardando', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  presente: { rot: 'Presente', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  faltou: { rot: 'Faltou', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};
const PROXIMA_PRESENCA: Record<PresencaVivencia, PresencaVivencia> = { pendente: 'presente', presente: 'faltou', faltou: 'pendente' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

async function copiar(texto: string, showToast: ShowToast, oque = 'Link copiado') {
  try {
    await navigator.clipboard.writeText(texto);
    showToast(oque, texto.length < 120 ? texto : undefined, 'success');
  } catch {
    window.prompt('Copie o link:', texto);
  }
}

export default function VivenciasTab({ showToast }: { showToast: ShowToast }) {
  const [carregando, setCarregando] = useState(true);
  const [vivencias, setVivencias] = useState<Vivencia[]>([]);
  const [inscricoes, setInscricoes] = useState<VivenciaInscricao[]>([]);
  const [turmas, setTurmas] = useState<RegularClass[]>([]);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Vivencia | null>(null);

  const carregar = async () => {
    try {
      const [vs, is] = await Promise.all([
        getCollectionData<Vivencia>(COL_VIVENCIAS),
        getCollectionData<VivenciaInscricao>(COL_INSCRICOES),
      ]);
      setVivencias(vs);
      setInscricoes(is);
      // Turmas configuradas no sistema (para a turma de interesse pela data de corte). Se falhar, usa o catálogo padrão.
      getCollectionData<RegularClass>('classPrices').then(setTurmas).catch(() => {});
    } catch {
      showToast('Não foi possível carregar as vivências', 'Confira se as regras de segurança das vivências foram publicadas no Firebase Console.', 'error', 9000);
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const porVivencia = useMemo(() => {
    const m = new Map<string, VivenciaInscricao[]>();
    inscricoes.forEach(i => { const l = m.get(i.vivenciaId) || []; l.push(i); m.set(i.vivenciaId, l); });
    return m;
  }, [inscricoes]);

  /** Mantém o contador da vivência (usado pela página pública para controlar vagas) igual ao número real de inscritos. */
  const sincronizarContador = async (vivenciaId: string, lista: VivenciaInscricao[]) => {
    const v = vivencias.find(x => x.id === vivenciaId);
    if (!v) return;
    const total = lista.filter(i => i.vivenciaId === vivenciaId).length;
    if ((v.inscritos || 0) === total) return;
    const nv = { ...v, inscritos: total };
    await saveDocument(COL_VIVENCIAS, nv);
    setVivencias(vs => vs.map(x => (x.id === vivenciaId ? nv : x)));
  };

  const salvarVivencia = async (v: Vivencia) => {
    try {
      await saveDocument(COL_VIVENCIAS, v);
      setVivencias(vs => (vs.some(x => x.id === v.id) ? vs.map(x => (x.id === v.id ? v : x)) : [...vs, v]));
      setEditando(null);
      showToast('Vivência salva', v.titulo, 'success');
    } catch {
      showToast('Não foi possível salvar', 'Tente de novo em instantes.', 'error');
    }
  };

  const excluirVivencia = async (v: Vivencia) => {
    const lista = porVivencia.get(v.id) || [];
    const msg = lista.length
      ? `Excluir "${v.titulo}" e as ${lista.length} inscrições dela? Isso não pode ser desfeito.`
      : `Excluir "${v.titulo}"?`;
    if (!window.confirm(msg)) return;
    try {
      for (const i of lista) await deleteDocument(COL_INSCRICOES, i.id);
      await deleteDocument(COL_VIVENCIAS, v.id);
      setInscricoes(is => is.filter(i => i.vivenciaId !== v.id));
      setVivencias(vs => vs.filter(x => x.id !== v.id));
      setEditando(null);
      setAbertaId(null);
      showToast('Vivência excluída', v.titulo, 'success');
    } catch {
      showToast('Não foi possível excluir', 'Tente de novo em instantes.', 'error');
    }
  };

  const alternarAberta = async (v: Vivencia) => {
    const nv = { ...v, aberta: !v.aberta };
    try {
      await saveDocument(COL_VIVENCIAS, nv);
      setVivencias(vs => vs.map(x => (x.id === v.id ? nv : x)));
      showToast(nv.aberta ? 'Inscrições abertas' : 'Inscrições encerradas', v.titulo, 'success');
    } catch {
      showToast('Não foi possível alterar', 'Tente de novo em instantes.', 'error');
    }
  };

  const salvarInscricao = async (i: VivenciaInscricao) => {
    try {
      await saveDocument(COL_INSCRICOES, i);
      const nova = inscricoes.some(x => x.id === i.id) ? inscricoes.map(x => (x.id === i.id ? i : x)) : [...inscricoes, i];
      setInscricoes(nova);
      await sincronizarContador(i.vivenciaId, nova);
      return true;
    } catch {
      showToast('Não foi possível salvar', 'Tente de novo em instantes.', 'error');
      return false;
    }
  };

  const excluirInscricao = async (i: VivenciaInscricao) => {
    if (!window.confirm(`Tirar ${i.criancaNome} da lista desta vivência?`)) return;
    try {
      await deleteDocument(COL_INSCRICOES, i.id);
      const nova = inscricoes.filter(x => x.id !== i.id);
      setInscricoes(nova);
      await sincronizarContador(i.vivenciaId, nova);
      showToast('Inscrição removida', i.criancaNome, 'success');
    } catch {
      showToast('Não foi possível remover', 'Tente de novo em instantes.', 'error');
    }
  };

  if (carregando) {
    return <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando vivências…</div>;
  }

  const aberta = vivencias.find(v => v.id === abertaId);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {aberta ? (
        <ListaInscritos
          v={aberta}
          inscricoes={porVivencia.get(aberta.id) || []}
          turmas={turmas}
          onVoltar={() => setAbertaId(null)}
          onEditar={() => setEditando(aberta)}
          onAlternarAberta={() => alternarAberta(aberta)}
          onSalvar={salvarInscricao}
          onExcluir={excluirInscricao}
          onSincronizar={() => sincronizarContador(aberta.id, inscricoes)}
          showToast={showToast}
        />
      ) : (
        <ListaVivencias
          vivencias={vivencias}
          porVivencia={porVivencia}
          onNova={() => setEditando({ id: novoId('viv'), titulo: '', data: '', horaInicio: '', horaFim: '', descricao: '', vagas: 0, aberta: true, inscritos: 0, criadoEm: new Date().toISOString() })}
          onAbrir={setAbertaId}
          onEditar={setEditando}
          onAlternarAberta={alternarAberta}
          showToast={showToast}
        />
      )}

      {editando && (
        <EditorVivencia
          v={editando}
          ehNova={!vivencias.some(x => x.id === editando.id)}
          onCancelar={() => setEditando(null)}
          onSalvar={salvarVivencia}
          onExcluir={() => excluirVivencia(editando)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ListaVivencias({ vivencias, porVivencia, onNova, onAbrir, onEditar, onAlternarAberta, showToast }: {
  vivencias: Vivencia[];
  porVivencia: Map<string, VivenciaInscricao[]>;
  onNova: () => void;
  onAbrir: (id: string) => void;
  onEditar: (v: Vivencia) => void;
  onAlternarAberta: (v: Vivencia) => void;
  showToast: ShowToast;
}) {
  const hoje = hojeISO();
  const ordenadas = [...vivencias].sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')));
  const proximas = ordenadas.filter(v => v.data >= hoje);
  const anteriores = ordenadas.filter(v => v.data < hoje).reverse();

  const card = (v: Vivencia, passada: boolean) => {
    const n = (porVivencia.get(v.id) || []).length;
    const presentes = (porVivencia.get(v.id) || []).filter(i => i.presenca === 'presente').length;
    const lotada = v.vagas > 0 && n >= v.vagas;
    return (
      <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
        <button type="button" onClick={() => onAbrir(v.id)} className="text-left space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-bold text-brand-green-dark leading-tight">{v.titulo || 'Sem título'}</h3>
            {!passada && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${v.aberta ? (lotada ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') : 'bg-slate-100 text-slate-600'}`}>
                {v.aberta ? (lotada ? 'Lotada' : 'Inscrições abertas') : 'Encerradas'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 flex items-center gap-1.5"><CalendarDays size={13} className="text-brand-green-light" /> <span className="first-letter:uppercase">{dataPorExtenso(v.data)}</span>{horario(v) && <><Clock size={13} className="text-brand-green-light ml-1" /> {horario(v)}</>}</p>
          <p className="text-xs text-slate-600 flex items-center gap-1.5"><Users size={13} className="text-brand-green-light" />
            <b className="text-slate-800">{n}</b> {n === 1 ? 'inscrito' : 'inscritos'}{v.vagas > 0 ? ` de ${v.vagas} vagas` : ''}{passada && n ? ` · ${presentes} presentes` : ''}{faixaEtaria(v) ? ` · ${faixaEtaria(v)}` : ''}
          </p>
        </button>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onAbrir(v.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-green-dark text-white flex items-center gap-1.5"><Users size={13} /> Inscritos</button>
          {!passada && <button type="button" onClick={() => copiar(linkPublico(v.id), showToast)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><Link2 size={13} /> Copiar link</button>}
          <button type="button" onClick={() => onEditar(v)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><Pencil size={13} /> Editar</button>
          {!passada && (
            <button type="button" onClick={() => onAlternarAberta(v)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50">
              {v.aberta ? <><Lock size={13} /> Encerrar</> : <><Unlock size={13} /> Reabrir</>}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-brand-green-dark flex items-center gap-2"><Sprout size={20} className="text-brand-orange" /> Vivências</h2>
          <p className="text-xs text-slate-500 mt-0.5">Inscrições de famílias interessadas. Ficam separadas dos alunos matriculados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copiar(linkPublico(), showToast, 'Link de todas as vivências copiado')} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center gap-1.5 hover:bg-slate-50" title="Página com todas as vivências que estão com inscrição aberta">
            <Link2 size={14} /> Link de todas
          </button>
          <button type="button" onClick={onNova} className="text-xs font-bold px-3 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white flex items-center gap-1.5">
            <Plus size={14} /> Nova vivência
          </button>
        </div>
      </div>

      {vivencias.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2">
          <p className="font-display font-bold text-brand-green-dark">Nenhuma vivência cadastrada</p>
          <p className="text-sm text-slate-500">Crie a primeira vivência e mande o link de inscrição para as famílias.</p>
          <button type="button" onClick={onNova} className="mt-2 text-sm font-bold px-4 py-2 rounded-lg bg-brand-orange text-white inline-flex items-center gap-1.5"><Plus size={15} /> Nova vivência</button>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Próximas</h3>
            {proximas.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{proximas.map(v => card(v, false))}</div>
              : <p className="text-sm text-slate-500">Nenhuma vivência marcada.</p>}
          </section>
          {anteriores.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Já aconteceram</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{anteriores.map(v => card(v, true))}</div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function EditorVivencia({ v, ehNova, onCancelar, onSalvar, onExcluir }: {
  v: Vivencia; ehNova: boolean; onCancelar: () => void; onSalvar: (v: Vivencia) => void; onExcluir: () => void;
}) {
  const [f, setF] = useState<Vivencia>(v);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Vivencia>(k: K, val: Vivencia[K]) => setF(x => ({ ...x, [k]: val }));
  const numOuUndef = (s: string) => (s === '' ? undefined : Math.max(0, Math.round(Number(s))));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    await onSalvar({
      ...f,
      titulo: f.titulo.trim(),
      descricao: f.descricao?.trim() || undefined,
      horaInicio: f.horaInicio || undefined,
      horaFim: f.horaFim || undefined,
      vagas: Number(f.vagas) || 0,
    });
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancelar}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-brand-green-dark text-lg">{ehNova ? 'Nova vivência' : 'Editar vivência'}</h3>
          <button type="button" onClick={onCancelar} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="space-y-1">
          <label className={labelCls} htmlFor="v-tit">Nome da vivência</label>
          <input id="v-tit" required className={inputCls} placeholder="Ex.: Manhã na horta" value={f.titulo} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 col-span-3 sm:col-span-1">
            <label className={labelCls} htmlFor="v-data">Data</label>
            <input id="v-data" type="date" required className={inputCls} value={f.data} onChange={e => set('data', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="v-hi">Início</label>
            <input id="v-hi" type="time" className={inputCls} value={f.horaInicio || ''} onChange={e => set('horaInicio', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="v-hf">Fim</label>
            <input id="v-hf" type="time" className={inputCls} value={f.horaFim || ''} onChange={e => set('horaFim', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="v-vagas">Vagas (crianças)</label>
            <input id="v-vagas" type="number" min={0} className={inputCls} value={f.vagas || ''} placeholder="Sem limite" onChange={e => set('vagas', Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="v-imin">Idade mínima</label>
            <input id="v-imin" type="number" min={0} max={18} className={inputCls} value={f.idadeMin ?? ''} onChange={e => set('idadeMin', numOuUndef(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="v-imax">Idade máxima</label>
            <input id="v-imax" type="number" min={0} max={18} className={inputCls} value={f.idadeMax ?? ''} onChange={e => set('idadeMax', numOuUndef(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1">
          <label className={labelCls} htmlFor="v-desc">Descrição para as famílias (aparece no link)</label>
          <textarea id="v-desc" rows={4} className={inputCls} placeholder="O que vai acontecer, o que levar, se os pais participam…" value={f.descricao || ''} onChange={e => set('descricao', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="v-aberta">
          <input id="v-aberta" type="checkbox" checked={f.aberta} onChange={e => set('aberta', e.target.checked)} className="w-4 h-4 accent-emerald-700" />
          Inscrições abertas no link
        </label>
        <div className="flex items-center justify-between gap-2 pt-2">
          {!ehNova ? (
            <button type="button" onClick={onExcluir} className="text-xs font-bold text-rose-600 flex items-center gap-1"><Trash2 size={14} /> Excluir</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onCancelar} className="text-sm font-bold px-4 py-2 rounded-lg border border-slate-200 text-slate-700">Cancelar</button>
            <button type="submit" disabled={salvando} className="text-sm font-bold px-4 py-2 rounded-lg bg-brand-green-dark text-white disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ListaInscritos({ v, inscricoes, turmas, onVoltar, onEditar, onAlternarAberta, onSalvar, onExcluir, onSincronizar, showToast }: {
  v: Vivencia;
  inscricoes: VivenciaInscricao[];
  turmas: RegularClass[];
  onVoltar: () => void;
  onEditar: () => void;
  onAlternarAberta: () => void;
  onSalvar: (i: VivenciaInscricao) => Promise<boolean>;
  onExcluir: (i: VivenciaInscricao) => void;
  onSincronizar: () => void;
  showToast: ShowToast;
}) {
  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const turmaDe = (i: VivenciaInscricao) => turmaDeInteresse(i.criancaNascimento, turmas);
  const [editandoInsc, setEditandoInsc] = useState<VivenciaInscricao | null>(null);
  const passada = v.data < hojeISO();

  // Corrige o contador se alguém excluiu/lançou por fora (mantém as vagas do link certas).
  useEffect(() => { if ((v.inscritos || 0) !== inscricoes.length) onSincronizar(); }, [v.id]);

  const ordenadas = useMemo(
    () => [...inscricoes].sort((a, b) => a.criancaNome.localeCompare(b.criancaNome, 'pt-BR')),
    [inscricoes]
  );
  const filtradas = ordenadas.filter(i => {
    if (filtroTurma && turmaDe(i).texto !== filtroTurma) return false;
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return [i.criancaNome, i.responsavelNome, i.telefone, i.email].some(x => (x || '').toLowerCase().includes(t));
  });
  const presentes = inscricoes.filter(i => i.presenca === 'presente').length;
  const faltas = inscricoes.filter(i => i.presenca === 'faltou').length;
  const familias = new Set(inscricoes.map(i => i.grupoId)).size;
  const porTurma = useMemo(() => {
    const m = new Map<string, { n: number; idade: number }>();
    inscricoes.forEach(i => {
      const t = turmaDe(i);
      if (!t.texto) return;
      const atual = m.get(t.texto) || { n: 0, idade: t.idadeCorte ?? 99 };
      m.set(t.texto, { n: atual.n + 1, idade: atual.idade });
    });
    return [...m.entries()].sort((a, b) => a[1].idade - b[1].idade);
  }, [inscricoes, turmas]);

  const marcarPresenca = (i: VivenciaInscricao) => onSalvar({ ...i, presenca: PROXIMA_PRESENCA[i.presenca || 'pendente'] });

  const imprimir = () => {
    const linhas = ordenadas.map((i, n) => `
      <tr>
        <td class="n">${n + 1}</td>
        <td><b>${esc(i.criancaNome)}</b></td>
        <td class="c">${esc(textoIdade(i.criancaNascimento, v.data))}</td>
        <td class="t">${esc(turmaDe(i).texto)}</td>
        <td>${esc(i.responsavelNome)}<div class="s">${esc(i.parentesco)}</div></td>
        <td class="nw">${esc(i.telefone)}</td>
        <td class="obs">${esc(i.observacoes || '')}</td>
        <td class="box">${i.presenca === 'presente' ? '✔' : ''}</td>
        <td class="ass"></td>
      </tr>`).join('');
    const extras = Array.from({ length: 4 }, () => '<tr class="vazia"><td class="n"></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="box"></td><td class="ass"></td></tr>').join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista de presença — ${esc(v.titulo)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: Inter, Arial, sans-serif; color: #1f2937; margin: 0; font-size: 11px; }
        .topo { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1F3F24; padding-bottom: 8px; margin-bottom: 10px; }
        .topo img { height: 46px; }
        h1 { font-size: 17px; margin: 0; color: #1F3F24; }
        .sub { color: #4b5563; margin-top: 2px; font-size: 12px; }
        .tot { margin-left: auto; text-align: right; font-size: 11px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F5F1E6; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 6px; border: 1px solid #cbd5e1; }
        td { padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }
        tr { page-break-inside: avoid; }
        .n { width: 26px; text-align: center; color: #6b7280; }
        .c { width: 56px; text-align: center; }
        .nw { white-space: nowrap; width: 110px; }
        .t { width: 92px; font-size: 10px; }
        .obs { width: 18%; font-size: 10px; color: #374151; }
        .box { width: 54px; text-align: center; font-size: 14px; }
        th.box { font-size: 10px; }
        .ass { width: 18%; }
        .s { font-size: 10px; color: #6b7280; }
        .vazia td { height: 26px; }
      </style></head><body>
      <div class="topo">
        <img src="${LOGO}" alt="Sítio-Escola Geranium">
        <div><h1>Lista de presença · ${esc(v.titulo)}</h1>
          <div class="sub">${esc(dataPorExtenso(v.data, true))}${horario(v) ? ' · ' + esc(horario(v)) : ''}</div></div>
        <div class="tot">${inscricoes.length} ${inscricoes.length === 1 ? 'criança inscrita' : 'crianças inscritas'}<br>${familias} ${familias === 1 ? 'família' : 'famílias'}</div>
      </div>
      <table><thead><tr><th class="n">Nº</th><th>Criança</th><th class="c">Idade</th><th class="t">Turma ${ANO_INTERESSE}</th><th>Responsável</th><th>Telefone</th><th>Observações</th><th class="box">Presença</th><th>Assinatura do responsável</th></tr></thead>
      <tbody>${linhas}${extras}</tbody></table>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showToast('O navegador bloqueou a janela de impressão', 'Permita pop-ups para este site e tente de novo.', 'error', 8000); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const baixarPlanilha = () => {
    const cab = ['Criança', 'Nascimento', `Idade em ${dataBR(v.data)}`, `Turma ${ANO_INTERESSE} (corte 31/03)`, 'Responsável', 'Parentesco', 'Telefone', 'E-mail', 'Escola atual', 'Como conheceu', 'Observações', 'Presença', 'Inscrito em', 'Origem'];
    const cel = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const linhas = ordenadas.map(i => [
      i.criancaNome, dataBR(i.criancaNascimento), textoIdade(i.criancaNascimento, v.data), turmaDe(i).texto, i.responsavelNome, i.parentesco,
      i.telefone, i.email, i.escolaAtual, i.comoConheceu, i.observacoes, PRESENCA_INFO[i.presenca || 'pendente'].rot,
      i.criadoEm ? new Date(i.criadoEm).toLocaleString('pt-BR') : '', i.origem === 'equipe' ? 'Equipe' : 'Link',
    ].map(cel).join(';'));
    const csv = '﻿' + [cab.map(cel).join(';'), ...linhas].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `vivencia-${v.data}-${v.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  const novaInscricaoEquipe = (): VivenciaInscricao => ({
    id: novoId('insc'), vivenciaId: v.id, grupoId: novoId('grupo'), criancaNome: '', criancaNascimento: '',
    responsavelNome: '', parentesco: 'Mãe', telefone: '', criadoEm: new Date().toISOString(), presenca: 'pendente', origem: 'equipe',
  });

  return (
    <>
      <button type="button" onClick={onVoltar} className="text-xs font-bold text-slate-500 hover:text-brand-green-dark flex items-center gap-1"><ArrowLeft size={14} /> Todas as vivências</button>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-wrap gap-4 items-start justify-between">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xl font-display font-bold text-brand-green-dark">{v.titulo}</h2>
          <p className="text-sm text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-brand-green-light" /> <span className="first-letter:uppercase">{dataPorExtenso(v.data, true)}</span></span>
            {horario(v) && <span className="flex items-center gap-1.5"><Clock size={14} className="text-brand-green-light" /> {horario(v)}</span>}
            {faixaEtaria(v) && <span>Crianças {faixaEtaria(v)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!passada && <button type="button" onClick={() => copiar(linkPublico(v.id), showToast)} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><Link2 size={14} /> Copiar link</button>}
          {!passada && (
            <button type="button" onClick={onAlternarAberta} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50">
              {v.aberta ? <><Lock size={14} /> Encerrar inscrições</> : <><Unlock size={14} /> Reabrir inscrições</>}
            </button>
          )}
          <button type="button" onClick={onEditar} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><Pencil size={14} /> Editar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Crianças inscritas', `${inscricoes.length}${v.vagas > 0 ? ` / ${v.vagas}` : ''}`],
          ['Famílias', String(familias)],
          ['Presentes', String(presentes)],
          ['Faltas', String(faltas)],
        ].map(([l, n]) => (
          <div key={l} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-[11px] font-bold text-slate-500">{l}</div>
            <div className="text-2xl font-display font-bold text-brand-green-dark tabular-nums">{n}</div>
          </div>
        ))}
      </div>

      {porTurma.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-500">Turma de interesse em {ANO_INTERESSE} <span className="font-normal">(idade em 31/03/{ANO_INTERESSE})</span></p>
          <div className="flex flex-wrap gap-1.5">
            {porTurma.map(([nome, { n }]) => (
              <button key={nome} type="button" onClick={() => setFiltroTurma(f => (f === nome ? '' : nome))}
                aria-pressed={filtroTurma === nome}
                className={`text-xs font-bold px-2.5 py-1 rounded-full border transition ${filtroTurma === nome ? 'bg-brand-green-dark text-white border-brand-green-dark' : 'bg-brand-sand/60 text-slate-700 border-slate-200 hover:border-brand-green-light'}`}>
                {nome} · {n}
              </button>
            ))}
            {filtroTurma && <button type="button" onClick={() => setFiltroTurma('')} className="text-xs font-bold px-2 text-slate-500 hover:text-slate-800">Mostrar todas</button>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar criança, responsável ou telefone" className={`${inputCls} pl-9`} aria-label="Buscar inscrito" />
        </div>
        <button type="button" onClick={imprimir} disabled={!inscricoes.length} className="text-xs font-bold px-3 py-2 rounded-lg bg-brand-green-dark text-white flex items-center gap-1.5 disabled:opacity-50"><Printer size={14} /> Imprimir lista de presença</button>
        <button type="button" onClick={baixarPlanilha} disabled={!inscricoes.length} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center gap-1.5 disabled:opacity-50 hover:bg-slate-50"><Download size={14} /> Baixar planilha</button>
        <button type="button" onClick={() => setEditandoInsc(novaInscricaoEquipe())} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><UserPlus size={14} /> Adicionar inscrito</button>
      </div>

      {inscricoes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
          Ninguém se inscreveu ainda. Copie o link e mande para as famílias pelo WhatsApp ou Instagram.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.3fr_2fr_auto] gap-3 px-4 py-2 bg-brand-sand/70 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Criança</span><span>Responsável</span><span>Contato</span><span>Observações</span><span className="text-right">Presença</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtradas.map(i => {
              const wa = numeroWhatsApp(i.telefone);
              const pres = PRESENCA_INFO[i.presenca || 'pendente'];
              return (
                <li key={i.id} className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.3fr_2fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{i.criancaNome}</p>
                    <p className="text-xs text-slate-500">{textoIdade(i.criancaNascimento, v.data)}{i.escolaAtual ? ` · ${i.escolaAtual}` : ''}</p>
                    {turmaDe(i).texto && (
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${turmaDe(i).foraDaFaixa ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {turmaDe(i).foraDaFaixa ? turmaDe(i).texto : `${turmaDe(i).texto} em ${ANO_INTERESSE}`}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-700">{i.responsavelNome} <span className="text-xs text-slate-500">({i.parentesco})</span></p>
                    {i.comoConheceu && <p className="text-xs text-slate-500">Conheceu por: {i.comoConheceu}</p>}
                  </div>
                  <div className="min-w-0 text-xs">
                    {wa ? (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"><MessageCircle size={13} /> {i.telefone}</a>
                    ) : <span className="text-slate-700">{i.telefone}</span>}
                    {i.email && <p className="text-slate-500 break-all">{i.email}</p>}
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-line min-w-0">{i.observacoes || <span className="text-slate-300">—</span>}</p>
                  <div className="flex items-center gap-1.5 md:justify-end">
                    <button type="button" onClick={() => marcarPresenca(i)} title="Tocar para mudar: Aguardando → Presente → Faltou"
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${pres.cls}`}>
                      {i.presenca === 'presente' && <Check size={12} />}{pres.rot}
                    </button>
                    <button type="button" onClick={() => setEditandoInsc(i)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Editar inscrição de ${i.criancaNome}`}><Pencil size={14} /></button>
                    <button type="button" onClick={() => onExcluir(i)} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Remover ${i.criancaNome}`}><Trash2 size={14} /></button>
                  </div>
                </li>
              );
            })}
            {filtradas.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhum inscrito encontrado para "{busca}".</li>}
          </ul>
        </div>
      )}

      {editandoInsc && (
        <EditorInscricao
          i={editandoInsc}
          v={v}
          ehNova={!inscricoes.some(x => x.id === editandoInsc.id)}
          onCancelar={() => setEditandoInsc(null)}
          onSalvar={async (ni) => { if (await onSalvar(ni)) { setEditandoInsc(null); showToast('Inscrição salva', ni.criancaNome, 'success'); } }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function EditorInscricao({ i, v, ehNova, onCancelar, onSalvar }: {
  i: VivenciaInscricao; v: Vivencia; ehNova: boolean; onCancelar: () => void; onSalvar: (i: VivenciaInscricao) => Promise<void>;
}) {
  const [f, setF] = useState<VivenciaInscricao>(i);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof VivenciaInscricao>(k: K, val: VivenciaInscricao[K]) => setF(x => ({ ...x, [k]: val }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    await onSalvar({
      ...f,
      criancaNome: f.criancaNome.trim(),
      responsavelNome: f.responsavelNome.trim(),
      telefone: f.telefone.trim(),
      email: f.email?.trim() || undefined,
      escolaAtual: f.escolaAtual?.trim() || undefined,
      comoConheceu: f.comoConheceu || undefined,
      observacoes: f.observacoes?.trim() || undefined,
    });
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancelar}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-brand-green-dark text-lg">{ehNova ? 'Adicionar inscrito' : 'Editar inscrição'}</h3>
          <button type="button" onClick={onCancelar} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar"><X size={18} /></button>
        </div>
        {ehNova && v.vagas > 0 && (v.inscritos || 0) >= v.vagas && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">A vivência já está com todas as vagas preenchidas. Você pode incluir mesmo assim.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-nome">Nome da criança</label>
            <input id="i-nome" required className={inputCls} value={f.criancaNome} onChange={e => set('criancaNome', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-nasc">Nascimento</label>
            <input id="i-nasc" type="date" required className={inputCls} value={f.criancaNascimento} onChange={e => set('criancaNascimento', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-resp">Responsável</label>
            <input id="i-resp" required className={inputCls} value={f.responsavelNome} onChange={e => set('responsavelNome', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-par">Parentesco</label>
            <select id="i-par" className={inputCls} value={f.parentesco} onChange={e => set('parentesco', e.target.value)}>
              {PARENTESCO_VIVENCIA.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-tel">Telefone</label>
            <input id="i-tel" required className={inputCls} value={f.telefone} onChange={e => set('telefone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-email">E-mail</label>
            <input id="i-email" type="email" className={inputCls} value={f.email || ''} onChange={e => set('email', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-esc">Escola atual</label>
            <input id="i-esc" className={inputCls} value={f.escolaAtual || ''} onChange={e => set('escolaAtual', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="i-como">Como conheceu</label>
            <select id="i-como" className={inputCls} value={f.comoConheceu || ''} onChange={e => set('comoConheceu', e.target.value)}>
              <option value="">—</option>
              {COMO_CONHECEU_OPCOES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className={labelCls} htmlFor="i-obs">Observações</label>
          <textarea id="i-obs" rows={2} className={inputCls} value={f.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancelar} className="text-sm font-bold px-4 py-2 rounded-lg border border-slate-200 text-slate-700">Cancelar</button>
          <button type="submit" disabled={salvando} className="text-sm font-bold px-4 py-2 rounded-lg bg-brand-green-dark text-white disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}
