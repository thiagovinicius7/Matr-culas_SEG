/**
 * Pedidos de uniformes do Sítio-Escola Geranium (substitui o antigo Apps Script + planilha).
 *
 * Coleções no Firestore:
 *  - uniformeCatalogo/{id}   → peças à venda (nome, cores, tamanhos, preço). Só a equipe grava.
 *  - uniformeCampanhas/{id}  → cada "pedido" (lote) que a escola abre e encerra à mão.
 *  - uniformeFamilias/{hashDoCpf} → resumo por CPF de responsável (publicado pela aba da equipe).
 *  - uniformePedidos/{campanhaId}_{grupo} → tudo o que uma família pediu naquele lote.
 *    Cada envio do formulário vira um item de `envios`. A família só lê pelo id exato
 *    (precisa saber o CPF) e só consegue ACRESCENTAR envios; a equipe lê e altera tudo.
 *
 * A família é reconhecida pelo resumo da coleção uniformeFamilias (ver familias.ts): o CPF de qualquer
 * responsável cadastrado leva ao nome, ao telefone, às crianças e às turmas de 2027.
 *
 * Este módulo é PURO: tipos, catálogo padrão, contas e textos. O acesso ao banco fica em uniformesDb.ts.
 */
import { ZAP_FINANCEIRO, moeda } from '../situacao/situacao';

export const COL_CATALOGO = 'uniformeCatalogo';
export const COL_CAMPANHAS = 'uniformeCampanhas';
export const COL_PEDIDOS = 'uniformePedidos';
export const COL_FAMILIAS = 'uniformeFamilias';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface PecaCatalogo {
  id: string;
  nome: string;
  cores: string[];
  tamanhos: string[];
  preco: number;
  ativo: boolean;
  ordem: number;
  /** Observação curta mostrada às famílias (ex.: "Amarela só para o contraturno"). */
  obs?: string;
}

export interface CampanhaUniforme {
  id: string;
  nome: string;
  aberta: boolean;
  criadaEm: string;
  encerradaEm?: string;
  /** Aviso opcional mostrado no topo da página das famílias. */
  aviso?: string;
}

export interface ItemPedido {
  crianca: string;
  turma: string;
  peca: string;
  cor: string;
  tamanho: string;
  preco: number;
  qtd: number;
}

export interface EnvioUniforme {
  codigo: string;
  criadoEm: string;
  responsavel: string;
  telefone: string;
  itens: ItemPedido[];
  total: number;
  pago: boolean;
  entregue: boolean;
  cancelado: boolean;
  origem: 'link' | 'equipe';
  obs?: string;
  /** Em quantas parcelas a família escolheu pagar (1 = à vista; até 4). Pedidos antigos: ausente = 1. */
  parcelas?: number;
  /** Quantas parcelas a equipe já confirmou. Ausente = 0 (ou todas, se `pago`). */
  parcelasPagas?: number;
}

export interface PedidoUniformeDoc {
  id: string;
  campanhaId: string;
  /** Grupo da família (ver familias.ts): todos os responsáveis das mesmas crianças caem no mesmo pedido.
   *  Vazio em pedidos avulsos da equipe. */
  grupo?: string;
  /** Formato antigo (primeira versão): hash do CPF do responsável financeiro. */
  cpfHash?: string;
  envios: EnvioUniforme[];
  atualizadoEm: string;
}

/* ------------------------------------------------------------------ */
/* Catálogo padrão 2027 (o da planilha LISTA DE UNIFORMES DISPONÍVEIS) */
/* ------------------------------------------------------------------ */

const TAMANHOS = ['2', '4', '6', '8', '10', '12', '14', 'P'];

export const CATALOGO_PADRAO: PecaCatalogo[] = [
  { id: 'camiseta', nome: 'Camiseta', cores: ['Laranja', 'Verde', 'Amarelo (só para contraturno)'], tamanhos: TAMANHOS, preco: 45, ativo: true, ordem: 1, obs: 'A amarela é só para o contraturno.' },
  { id: 'short-tactel', nome: 'Short tactel', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 45, ativo: true, ordem: 2 },
  { id: 'short-suplex', nome: 'Short suplex', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 45, ativo: true, ordem: 3 },
  { id: 'short-saia-tactel', nome: 'Short saia tactel', cores: ['Laranja'], tamanhos: TAMANHOS, preco: 45, ativo: true, ordem: 4 },
  { id: 'calca-tactel', nome: 'Calça tactel', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 55, ativo: true, ordem: 5 },
  { id: 'calca-moletom', nome: 'Calça moletom', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 75, ativo: true, ordem: 6 },
  { id: 'calca-legging-suplex', nome: 'Calça legging suplex', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 55, ativo: true, ordem: 7 },
  { id: 'vestido-suplex', nome: 'Vestido suplex com short', cores: ['Laranja', 'Verde'], tamanhos: TAMANHOS, preco: 100, ativo: true, ordem: 8 },
  { id: 'agasalho-tactel', nome: 'Agasalho tactel', cores: ['Laranja'], tamanhos: TAMANHOS, preco: 100, ativo: true, ordem: 9 },
  { id: 'agasalho-moletom', nome: 'Agasalho moletom', cores: ['Cinza'], tamanhos: TAMANHOS, preco: 110, ativo: true, ordem: 10 },
];

/* ------------------------------------------------------------------ */
/* Contas                                                              */
/* ------------------------------------------------------------------ */

const centavos = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100);

export const totalItens = (itens: ItemPedido[]) =>
  itens.reduce((s, i) => s + centavos(i.preco) * (Number(i.qtd) || 0), 0) / 100;

export const qtdPecas = (itens: ItemPedido[]) => itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);

/** Junta itens iguais (mesma criança, peça, cor e tamanho) somando a quantidade. */
export function juntarItens(itens: ItemPedido[]): ItemPedido[] {
  const mapa = new Map<string, ItemPedido>();
  for (const i of itens) {
    if (!i.peca || !i.cor || !i.tamanho || !(i.qtd > 0)) continue;
    const k = [i.crianca, i.turma, i.peca, i.cor, i.tamanho, i.preco].join('|');
    const atual = mapa.get(k);
    if (atual) atual.qtd += i.qtd;
    else mapa.set(k, { ...i });
  }
  return [...mapa.values()];
}

/* ---------------- Pagamento em parcelas ---------------- */

export const MAX_PARCELAS = 4;

/** Parcelas do envio, já normalizadas (pedidos antigos não tinham esses campos). */
export function parcelasDe(e: Pick<EnvioUniforme, 'parcelas' | 'parcelasPagas' | 'pago'>): { n: number; pagas: number } {
  const n = Math.min(MAX_PARCELAS, Math.max(1, Math.round(Number(e.parcelas) || 1)));
  const pagas = e.parcelasPagas === undefined ? (e.pago ? n : 0) : Math.min(n, Math.max(0, Math.round(Number(e.parcelasPagas) || 0)));
  return { n, pagas };
}

/** Valores de cada parcela; o centavo que sobrar vai para a última. */
export function valoresParcelas(total: number, n: number): number[] {
  const c = centavos(total);
  const base = Math.floor(c / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? c - base * (n - 1) : base) / 100);
}

export const valorPago = (e: EnvioUniforme) => {
  const { n, pagas } = parcelasDe(e);
  return valoresParcelas(e.total, n).slice(0, pagas).reduce((s, v) => s + v, 0);
};

export const formaPagamento = (e: EnvioUniforme) => {
  const { n } = parcelasDe(e);
  return n === 1 ? 'Pix à vista' : `Pix em ${n}x`;
};

/** Grava quantas parcelas foram pagas, mantendo `pago` coerente. */
export function comParcelasPagas(e: EnvioUniforme, pagas: number): EnvioUniforme {
  const { n } = parcelasDe(e);
  const p = Math.min(n, Math.max(0, pagas));
  return { ...e, parcelas: n, parcelasPagas: p, pago: p >= n };
}

export type SituacaoEnvio = 'cancelado' | 'entregue' | 'pago' | 'parcial' | 'aguardando';

export function situacaoDoEnvio(e: EnvioUniforme): SituacaoEnvio {
  if (e.cancelado) return 'cancelado';
  if (e.entregue) return 'entregue';
  const { n, pagas } = parcelasDe(e);
  if (pagas >= n) return 'pago';
  if (pagas > 0) return 'parcial';
  return 'aguardando';
}

/** Texto curto do pagamento: "À vista · pago", "4x · 2 de 4 pagas"… */
export function textoPagamento(e: EnvioUniforme): string {
  const { n, pagas } = parcelasDe(e);
  if (n === 1) return pagas ? 'À vista · pago' : 'À vista · pendente';
  return `${n}x · ${pagas} de ${n} ${pagas === 1 ? 'paga' : 'pagas'}`;
}

export const ROTULO_SITUACAO: Record<SituacaoEnvio, { rot: string; familia: string; chip: string }> = {
  aguardando: { rot: 'Aguardando pagamento', familia: 'Aguardando o pagamento', chip: 'bg-amber-100 text-amber-900 border-amber-200' },
  parcial: { rot: 'Pago em parte', familia: 'Parcelas em andamento', chip: 'bg-orange-100 text-orange-900 border-orange-200' },
  pago: { rot: 'Pago', familia: 'Pagamento confirmado · aguardando a entrega', chip: 'bg-sky-100 text-sky-800 border-sky-200' },
  entregue: { rot: 'Entregue', familia: 'Entregue', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelado: { rot: 'Cancelado', familia: 'Cancelado', chip: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** Linha da lista para a fornecedora. */
export interface LinhaFornecedor { peca: string; cor: string; tamanho: string; qtd: number }

/** Ordem natural dos tamanhos: números primeiro (2, 4, 6…), depois letras (PP, P, M, G, GG). */
const ORDEM_LETRAS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'EXG'];
export function compararTamanho(a: string, b: string): number {
  const na = Number(a), nb = Number(b);
  const ea = !isNaN(na) && a.trim() !== '', eb = !isNaN(nb) && b.trim() !== '';
  if (ea && eb) return na - nb;
  if (ea) return -1;
  if (eb) return 1;
  const ia = ORDEM_LETRAS.indexOf(a.toUpperCase()), ib = ORDEM_LETRAS.indexOf(b.toUpperCase());
  if (ia >= 0 && ib >= 0) return ia - ib;
  return a.localeCompare(b, 'pt-BR');
}

/** Soma as peças de todos os envios (menos os cancelados), agrupando por peça, cor e tamanho. */
export function listaFornecedor(envios: EnvioUniforme[], ordemPeca: (nome: string) => number = () => 0): LinhaFornecedor[] {
  const mapa = new Map<string, LinhaFornecedor>();
  for (const e of envios) {
    if (e.cancelado) continue;
    for (const i of e.itens) {
      const k = `${i.peca}|${i.cor}|${i.tamanho}`;
      const atual = mapa.get(k);
      if (atual) atual.qtd += i.qtd;
      else mapa.set(k, { peca: i.peca, cor: i.cor, tamanho: i.tamanho, qtd: i.qtd });
    }
  }
  return [...mapa.values()].sort((a, b) =>
    ordemPeca(a.peca) - ordemPeca(b.peca) || a.peca.localeCompare(b.peca, 'pt-BR') ||
    a.cor.localeCompare(b.cor, 'pt-BR') || compararTamanho(a.tamanho, b.tamanho));
}

/* ------------------------------------------------------------------ */
/* Identificadores                                                     */
/* ------------------------------------------------------------------ */

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I

/** Código curto do envio, para a família citar no comprovante (ex.: U-7KQ2M). */
export function novoCodigo(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return 'U-' + Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join('');
}

export const idPedido = (campanhaId: string, grupo: string) => `${campanhaId}_${grupo}`;

export function novoIdCampanha(): string {
  return `uni-${Date.now().toString(36)}`;
}

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const separarLista = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */

/** O que está sendo pago agora: a próxima parcela ou o restante de uma vez. */
export interface PagamentoAgora { valor: number; descricao: string }

export function pagamentoAgora(e: EnvioUniforme, restante = false): PagamentoAgora | null {
  const { n, pagas } = parcelasDe(e);
  if (pagas >= n) return null;
  const vals = valoresParcelas(e.total, n);
  if (n === 1) return { valor: vals[0], descricao: 'Pagamento à vista' };
  if (restante && n - pagas > 1) {
    const valor = vals.slice(pagas).reduce((s, v) => s + v, 0);
    return { valor: Math.round(valor * 100) / 100, descricao: `Parcelas ${pagas + 1} a ${n} de ${n} (restante)` };
  }
  return { valor: vals[pagas], descricao: `Parcela ${pagas + 1} de ${n}` };
}

export function mensagemComprovanteUniforme(e: Pick<EnvioUniforme, 'codigo' | 'responsavel' | 'itens'>, p: PagamentoAgora): string {
  const criancas = [...new Set(e.itens.map(i => i.crianca))].join(', ');
  return (
    `Olá! Segue o comprovante do Pix do pedido de uniformes.\n\n` +
    `Pedido: ${e.codigo}\n` +
    `Responsável: ${e.responsavel}\n` +
    `Criança(s): ${criancas}\n` +
    `${p.descricao}\n` +
    `Valor pago: ${moeda(p.valor)}\n\n` +
    `(comprovante em anexo)`
  );
}

export const linkZapComprovanteUniforme = (e: Pick<EnvioUniforme, 'codigo' | 'responsavel' | 'itens'>, p: PagamentoAgora) =>
  `https://wa.me/${ZAP_FINANCEIRO}?text=${encodeURIComponent(mensagemComprovanteUniforme(e, p))}`;

export const linkZapDuvidaUniforme = (texto?: string) =>
  `https://wa.me/${ZAP_FINANCEIRO}?text=${encodeURIComponent(texto || 'Olá! Tenho uma dúvida sobre o pedido de uniformes.')}`;

/** Endereço público da página das famílias (link curto, com prévia bonita no WhatsApp). */
export function linkPublicoUniformes(): string {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return `${base}uniformes/`;
}

export function mensagemDivulgacao(link: string): string {
  return (
    `Olá, famílias! 🌱\n\n` +
    `Está aberto o pedido de uniformes do Sítio-Escola Geranium.\n\n` +
    `É só abrir o link, digitar o CPF de um dos responsáveis cadastrados na escola e escolher as peças de cada criança. ` +
    `O pagamento é por Pix, à vista ou em até 4 vezes, e o comprovante vai direto para o financeiro.\n\n` +
    `👉 ${link}\n\n` +
    `Qualquer dúvida, estamos por aqui.`
  );
}

export const telefoneZap = (t: string) => {
  const d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
};

export const dataHoraBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
