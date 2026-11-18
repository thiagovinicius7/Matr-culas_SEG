import React, { useState } from 'react';
import { Minus, Plus, ChevronDown, Shirt } from 'lucide-react';
import type { PecaCatalogo, ItemPedido } from '../uniformes/uniformes';
import { moeda } from '../situacao/situacao';

/**
 * Escolha das peças por criança (usado na página das famílias e no "novo pedido" da equipe).
 * Para cada peça a pessoa escolhe a quantidade e, para cada unidade, o tamanho e a cor —
 * do mesmo jeito do formulário antigo, que as famílias já conhecem.
 */

export interface CriancaUniforme { nome: string; turma: string }

export interface UnidadeEscolhida { cor: string; tamanho: string }
/** criança (índice) → peça (id) → unidades */
export type SelecaoUniformes = Record<number, Record<string, UnidadeEscolhida[]>>;

export function itensDaSelecao(sel: SelecaoUniformes, catalogo: PecaCatalogo[], criancas: CriancaUniforme[]): ItemPedido[] {
  const out: ItemPedido[] = [];
  for (const [idx, porPeca] of Object.entries(sel)) {
    const c = criancas[Number(idx)];
    if (!c) continue;
    for (const [pecaId, unidades] of Object.entries(porPeca)) {
      const p = catalogo.find(x => x.id === pecaId);
      if (!p) continue;
      for (const u of unidades) out.push({ crianca: c.nome, turma: c.turma, peca: p.nome, cor: u.cor, tamanho: u.tamanho, preco: p.preco, qtd: 1 });
    }
  }
  return out;
}

export const selecaoIncompleta = (sel: SelecaoUniformes) =>
  Object.values(sel).some(porPeca => Object.values(porPeca).some(us => us.some(u => !u.cor || !u.tamanho)));

const selectCls = 'flex-1 min-w-0 text-sm px-2.5 py-2 rounded-lg border border-orange-200 bg-white focus:border-brand-orange focus:outline-none';

export default function SeletorUniformes({
  catalogo, criancas, selecao, onChange,
}: {
  catalogo: PecaCatalogo[];
  criancas: CriancaUniforme[];
  selecao: SelecaoUniformes;
  onChange: (s: SelecaoUniformes) => void;
}) {
  const [aberta, setAberta] = useState<number>(0);
  const pecas = catalogo.filter(p => p.ativo);

  const unidades = (ci: number, pecaId: string) => selecao[ci]?.[pecaId] || [];

  const mudarQtd = (ci: number, p: PecaCatalogo, qtd: number) => {
    qtd = Math.max(0, Math.min(10, qtd));
    const atuais = unidades(ci, p.id);
    let novas = atuais.slice(0, qtd);
    while (novas.length < qtd) {
      const anterior = novas[novas.length - 1];
      novas = [...novas, {
        // Uma opção só (ex.: cor Cinza) já vem marcada; senão repete a escolha da unidade anterior.
        cor: p.cores.length === 1 ? p.cores[0] : anterior?.cor || '',
        tamanho: p.tamanhos.length === 1 ? p.tamanhos[0] : anterior?.tamanho || '',
      }];
    }
    const porPeca = { ...(selecao[ci] || {}) };
    if (novas.length) porPeca[p.id] = novas; else delete porPeca[p.id];
    onChange({ ...selecao, [ci]: porPeca });
  };

  const mudarUnidade = (ci: number, pecaId: string, ui: number, campo: keyof UnidadeEscolhida, valor: string) => {
    const novas = unidades(ci, pecaId).map((u, i) => (i === ui ? { ...u, [campo]: valor } : u));
    onChange({ ...selecao, [ci]: { ...(selecao[ci] || {}), [pecaId]: novas } });
  };

  const resumoCrianca = (ci: number) => {
    const porPeca = selecao[ci] || {};
    let n = 0, v = 0;
    for (const [pid, us] of Object.entries(porPeca)) {
      const p = catalogo.find(x => x.id === pid);
      n += us.length; v += (p?.preco || 0) * us.length;
    }
    return { n, v };
  };

  if (pecas.length === 0) return <p className="text-sm text-slate-500 text-center py-6">Nenhuma peça disponível no momento.</p>;

  return (
    <div className="space-y-3">
      {criancas.map((c, ci) => {
        const r = resumoCrianca(ci);
        const estaAberta = aberta === ci || criancas.length === 1;
        return (
          <section key={`${c.nome}-${ci}`} className="border border-slate-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setAberta(estaAberta && criancas.length > 1 ? -1 : ci)} aria-expanded={estaAberta}
              className="w-full text-left bg-brand-cream px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-display font-bold text-brand-green-dark leading-tight">{c.nome}</span>
                <span className="block text-xs text-slate-500">{c.turma}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {r.n > 0 && <span className="text-xs font-bold text-brand-orange bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">{r.n} {r.n === 1 ? 'peça' : 'peças'} · {moeda(r.v)}</span>}
                {criancas.length > 1 && <ChevronDown size={18} className={`text-slate-500 transition-transform ${estaAberta ? 'rotate-180' : ''}`} />}
              </span>
            </button>

            {estaAberta && (
              <ul className="divide-y divide-dashed divide-slate-200">
                {pecas.map(p => {
                  const us = unidades(ci, p.id);
                  return (
                    <li key={p.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5"><Shirt size={14} className="text-brand-green-light shrink-0" />{p.nome}</div>
                          <div className="text-xs text-brand-green-dark font-bold">{moeda(p.preco)}</div>
                          {p.obs && <div className="text-[11px] text-slate-500">{p.obs}</div>}
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
                          <button type="button" aria-label={`Menos ${p.nome}`} onClick={() => mudarQtd(ci, p, us.length - 1)} disabled={us.length === 0}
                            className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center disabled:opacity-40"><Minus size={14} /></button>
                          <span className="w-7 text-center font-bold text-slate-800" aria-live="polite">{us.length}</span>
                          <button type="button" aria-label={`Mais ${p.nome}`} onClick={() => mudarQtd(ci, p, us.length + 1)}
                            className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center"><Plus size={14} /></button>
                        </div>
                      </div>
                      {us.length > 0 && (
                        <div className="bg-orange-50 rounded-lg p-2.5 space-y-2">
                          {us.map((u, ui) => (
                            <div key={ui} className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-brand-orange w-6 shrink-0">#{ui + 1}</span>
                              <select aria-label={`Tamanho da ${p.nome} ${ui + 1}`} value={u.tamanho} onChange={e => mudarUnidade(ci, p.id, ui, 'tamanho', e.target.value)}
                                className={`${selectCls} ${!u.tamanho ? 'text-slate-400' : ''}`}>
                                <option value="" disabled>Tamanho</option>
                                {p.tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <select aria-label={`Cor da ${p.nome} ${ui + 1}`} value={u.cor} onChange={e => mudarUnidade(ci, p.id, ui, 'cor', e.target.value)}
                                className={`${selectCls} ${!u.cor ? 'text-slate-400' : ''}`}>
                                <option value="" disabled>Cor</option>
                                {p.cores.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
