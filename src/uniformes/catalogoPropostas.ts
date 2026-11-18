/**
 * Propostas de atualização do catálogo de uniformes (coleção uniformeCatalogoPropostas).
 *
 * A escola manda o link do formulário (?catalogoUniformes=1 ou /uniformes-catalogo/) para quem
 * cuida dos uniformes (ex.: a fornecedora). A pessoa vê o catálogo atual, ajusta e envia.
 * Nada muda direto no catálogo: a proposta aparece na aba Uniformes → Catálogo e preços,
 * com as diferenças, e a equipe aplica ou descarta.
 */
import { saveDocument } from '../firebase';
import { slug, type PecaCatalogo } from './uniformes';
import { salvarPeca } from './uniformesDb';

export const COL_PROPOSTAS = 'uniformeCatalogoPropostas';

export interface PecaProposta {
  /** id da peça no catálogo; peças novas começam com "novo-". */
  id: string;
  nome: string;
  cores: string[];
  tamanhos: string[];
  preco: number;
  obs: string;
  ativo: boolean;
}

export interface PropostaCatalogo {
  id: string;
  criadaEm: string;
  nome: string;
  contato: string;
  obsGeral: string;
  pecas: PecaProposta[];
  status: 'nova' | 'aplicada' | 'descartada';
  resolvidaEm?: string;
}

export const ehNova = (p: PecaProposta) => p.id.startsWith('novo-');

export function novoIdProposta(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return `prop-${Date.now().toString(36)}-${Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 8)}`;
}

export const enviarProposta = (p: PropostaCatalogo) => saveDocument(COL_PROPOSTAS, p);

/* ---------------- Diferenças ---------------- */

export interface Diferenca {
  pecaId: string;
  nome: string;
  tipo: 'nova' | 'alterada' | 'retirada' | 'volta';
  itens: { campo: string; antes: string; depois: string }[];
}

const lista = (xs: string[]) => xs.join(', ');
const moedaBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function diferencas(catalogo: PecaCatalogo[], proposta: PropostaCatalogo): Diferenca[] {
  const out: Diferenca[] = [];
  for (const p of proposta.pecas) {
    if (ehNova(p)) {
      if (!p.ativo || !p.nome.trim()) continue;
      out.push({ pecaId: p.id, nome: p.nome, tipo: 'nova', itens: [
        { campo: 'Preço', antes: '', depois: moedaBR(p.preco) },
        { campo: 'Cores', antes: '', depois: lista(p.cores) },
        { campo: 'Tamanhos', antes: '', depois: lista(p.tamanhos) },
        ...(p.obs ? [{ campo: 'Observação', antes: '', depois: p.obs }] : []),
      ] });
      continue;
    }
    const a = catalogo.find(x => x.id === p.id);
    if (!a) continue; // peça apagada do catálogo depois que o formulário foi aberto
    const itens: Diferenca['itens'] = [];
    if (a.nome !== p.nome) itens.push({ campo: 'Nome', antes: a.nome, depois: p.nome });
    if (Math.abs(a.preco - p.preco) > 0.001) itens.push({ campo: 'Preço', antes: moedaBR(a.preco), depois: moedaBR(p.preco) });
    if (lista(a.cores) !== lista(p.cores)) itens.push({ campo: 'Cores', antes: lista(a.cores), depois: lista(p.cores) });
    if (lista(a.tamanhos) !== lista(p.tamanhos)) itens.push({ campo: 'Tamanhos', antes: lista(a.tamanhos), depois: lista(p.tamanhos) });
    if ((a.obs || '') !== (p.obs || '')) itens.push({ campo: 'Observação', antes: a.obs || '', depois: p.obs || '' });
    const tipo: Diferenca['tipo'] = a.ativo && !p.ativo ? 'retirada' : !a.ativo && p.ativo ? 'volta' : 'alterada';
    if (itens.length || tipo !== 'alterada') out.push({ pecaId: p.id, nome: p.nome || a.nome, tipo, itens });
  }
  return out;
}

/** Grava no catálogo o que a proposta muda. Devolve quantas peças foram gravadas. */
export async function aplicarProposta(catalogo: PecaCatalogo[], proposta: PropostaCatalogo): Promise<number> {
  const difs = diferencas(catalogo, proposta);
  const usados = new Set(catalogo.map(p => p.id));
  let ordem = Math.max(0, ...catalogo.map(p => p.ordem || 0));
  let n = 0;
  for (const d of difs) {
    const p = proposta.pecas.find(x => x.id === d.pecaId)!;
    const obs = p.obs.trim();
    if (d.tipo === 'nova') {
      let id = slug(p.nome) || `peca-${Date.now()}`;
      while (usados.has(id)) id = `${id}-2`;
      usados.add(id);
      await salvarPeca({ id, nome: p.nome.trim(), cores: p.cores, tamanhos: p.tamanhos, preco: p.preco, ativo: true, ordem: ++ordem, ...(obs ? { obs } : {}) });
    } else {
      const a = catalogo.find(x => x.id === p.id)!;
      const { obs: _o, ...resto } = a;
      await salvarPeca({ ...resto, nome: p.nome.trim() || a.nome, cores: p.cores, tamanhos: p.tamanhos, preco: p.preco, ativo: p.ativo, ...(obs ? { obs } : {}) });
    }
    n++;
  }
  await saveDocument(COL_PROPOSTAS, { ...proposta, status: 'aplicada', resolvidaEm: new Date().toISOString() });
  return n;
}

export const descartarProposta = (p: PropostaCatalogo) =>
  saveDocument(COL_PROPOSTAS, { ...p, status: 'descartada', resolvidaEm: new Date().toISOString() });

export function linkFormularioCatalogo(): string {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return `${base}uniformes-catalogo/`;
}

export const mensagemFormularioCatalogo = (link: string) =>
  `Olá! Segue o formulário de uniformes do Sítio-Escola Geranium.\n\n` +
  `Nele estão as peças que vendemos hoje, com cores, tamanhos e preços. ` +
  `Pode ajustar o que mudou, incluir peças novas ou marcar as que saíram, e depois é só clicar em Enviar.\n\n` +
  `👉 ${link}\n\nObrigado!`;

