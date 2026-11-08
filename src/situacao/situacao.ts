/**
 * Página pública "Situação da matrícula 2027" (?situacao=1).
 *
 * A família digita o CPF da criança (ou do responsável) e vê a situação do contrato e
 * o Pix da 1ª parcela da mensalidade de janeiro.
 *
 * Como protege os dados: a página NÃO lê alunos, contratos nem responsáveis. A equipe
 * publica, na coleção `situacaoMatricula`, um resumo mínimo por CPF (nome da criança, turma,
 * andamento dos contratos e valores). O documento só pode ser lido pelo identificador exato,
 * que é um hash do CPF — não existe listagem pública. O CPF em si nunca é gravado ali.
 *
 * Este módulo é PURO (não acessa o banco): monta os resumos, o hash, o Pix e a mensagem.
 */
import type { ContratoDoc, Guardian, StatusContrato } from '../types';
import {
  ContratoContexto, CartaResolvida, TipoContrato, NOMES_DOCS,
  elegivelParaContrato, resolverCarta, documentosDoAluno,
} from '../contratos/montarDados';

/* ------------------------------------------------------------------ */
/* Dados fixos da escola                                               */
/* ------------------------------------------------------------------ */

/** Chave Pix da escola (CNPJ, só números). */
export const PIX_CHAVE = '52550248000120';
export const PIX_CHAVE_FORMATADA = '52.550.248/0001-20';
export const PIX_NOME = 'SITIO ESCOLA GERANIUM'; // até 25 caracteres, sem acento
export const PIX_CIDADE = 'BRASILIA'; // até 15 caracteres, sem acento
/** WhatsApp do financeiro (DDI+DDD+número). */
export const ZAP_FINANCEIRO = '556182334410';
export const ZAP_FINANCEIRO_FORMATADO = '+55 61 8233-4410';
/** Quem confirmou a Carta até esta data (inclusive) ganha 50% na mensalidade de janeiro. */
export const DATA_LIMITE_DESCONTO = '2026-10-31';
export const PERCENTUAL_DESCONTO_JANEIRO = 50;
export const COLECAO_SITUACAO = 'situacaoMatricula';

/* ------------------------------------------------------------------ */
/* CPF e identificador (hash)                                          */
/* ------------------------------------------------------------------ */

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Identificador do documento público: SHA-256 do CPF (só números) com um prefixo fixo. */
export async function hashCpf(cpf: string): Promise<string> {
  const bytes = new TextEncoder().encode(`geranium-situacao-2027|${soDigitos(cpf)}`);
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Resumo publicado                                                    */
/* ------------------------------------------------------------------ */

export type AndamentoContrato = 'assinado' | 'aguardando' | 'preparando';

export interface CriancaSituacao {
  nome: string;
  turma: string;
  contratos: { nome: string; status: 'assinado' | 'enviado' | 'preparando' }[];
  andamento: AndamentoContrato;
  /** Pagamento da 1ª parcela liberado (confirmou a Carta até a data limite). */
  liberado: boolean;
  /** Valores em reais; só quando liberado. */
  mensalidade: number;
  desconto: number;
  novembro: number;
  janeiro: number;
  partes: { regular: number; contraturno: number; lanche: number };
}

export interface SituacaoDoc {
  id: string; // hash do CPF
  criancas: CriancaSituacao[];
  atualizadoEm: string;
}

const centavos = (v: number) => Math.round((v + Number.EPSILON) * 100);
const reais = (c: number) => c / 100;

/**
 * Mensalidade de janeiro = ensino regular + contraturno + lanche (se aderiu), pelos valores da Carta.
 * 50% de desconto; o restante (50%) é dividido ao meio: novembro e janeiro (25% e 25% do total).
 */
export function dividirJaneiro(carta: Pick<CartaResolvida, 'mensalidade' | 'contraturno' | 'lancheAdiciona' | 'lancheValor'>) {
  const regular = centavos(carta.mensalidade);
  const contraturno = carta.contraturno ? centavos(carta.contraturno.valor) : 0;
  const lanche = carta.lancheAdiciona ? centavos(carta.lancheValor) : 0;
  const total = regular + contraturno + lanche;
  const desconto = Math.round(total * PERCENTUAL_DESCONTO_JANEIRO / 100);
  const restante = total - desconto;
  const novembro = Math.floor(restante / 2);
  const janeiro = restante - novembro; // se sobrar 1 centavo, fica em janeiro
  return {
    mensalidade: reais(total), desconto: reais(desconto), novembro: reais(novembro), janeiro: reais(janeiro),
    partes: { regular: reais(regular), contraturno: reais(contraturno), lanche: reais(lanche) },
  };
}

/** Tem o desconto de janeiro? Vale para todos, a menos que a equipe desmarque na tela de matrícula. */
export function direitoAoDescontoDeJaneiro(carta: CartaResolvida, _ctx?: ContratoContexto): boolean {
  return carta.base.descontoJaneiro2027 !== false;
}

function andamento(tipos: TipoContrato[], statusDe: (t: TipoContrato) => StatusContrato) {
  const contratos = tipos.map(t => {
    const s = statusDe(t);
    return { nome: NOMES_DOCS[t].nome, status: (s === 'assinado' ? 'assinado' : s === 'enviado' ? 'enviado' : 'preparando') as 'assinado' | 'enviado' | 'preparando' };
  });
  const todos = contratos.length > 0 && contratos.every(c => c.status === 'assinado');
  const algumEnviado = contratos.some(c => c.status === 'enviado' || c.status === 'assinado');
  const resumo: AndamentoContrato = todos ? 'assinado' : algumEnviado ? 'aguardando' : 'preparando';
  return { contratos, resumo };
}

export interface EntradaAluno {
  ctx: ContratoContexto;
  carta: CartaResolvida;
  tipos: TipoContrato[];
}

/** Monta um resumo por criança elegível ao contrato. `docs` são os contratos já registrados. */
export function montarCriancas(ctxs: ContratoContexto[], docs: ContratoDoc[], ano = 2027): Map<string, { entrada: EntradaAluno; crianca: CriancaSituacao }> {
  const porId = new Map(docs.map(d => [d.id, d]));
  const out = new Map<string, { entrada: EntradaAluno; crianca: CriancaSituacao }>();
  for (const ctx of ctxs) {
    if (!elegivelParaContrato(ctx).ok) continue;
    const carta = resolverCarta(ctx);
    if (!carta) continue;
    const tipos = documentosDoAluno(carta);
    const statusDe = (t: TipoContrato): StatusContrato => porId.get(`${ctx.student.id}_${ano}_${t}`)?.status || 'nao_gerado';
    const a = andamento(tipos, statusDe);
    const liberado = direitoAoDescontoDeJaneiro(carta, ctx);
    const v = dividirJaneiro(carta);
    out.set(ctx.student.id, {
      entrada: { ctx, carta, tipos },
      crianca: {
        nome: ctx.student.nome,
        turma: carta.somenteContraturno ? 'Somente Contraturno' : carta.turma.nome,
        contratos: a.contratos, andamento: a.resumo, liberado,
        mensalidade: liberado ? v.mensalidade : 0, desconto: liberado ? v.desconto : 0,
        novembro: liberado ? v.novembro : 0, janeiro: liberado ? v.janeiro : 0,
        partes: liberado ? v.partes : { regular: 0, contraturno: 0, lanche: 0 },
      },
    });
  }
  return out;
}

/**
 * Um documento por CPF: o CPF da criança (se cadastrado) e o de cada responsável levam às crianças
 * correspondentes (irmãos aparecem juntos quando se consulta pelo CPF do responsável).
 */
export async function montarSituacoes(
  ctxs: ContratoContexto[], docs: ContratoDoc[], agora = new Date().toISOString(),
): Promise<{ docs: SituacaoDoc[]; semCpf: string[]; semDesconto: string[] }> {
  const criancas = montarCriancas(ctxs, docs);
  const porCpf = new Map<string, Map<string, CriancaSituacao>>();
  const semCpf: string[] = [];
  const semDesconto: string[] = [];
  const add = (cpf: string, alunoId: string, c: CriancaSituacao) => {
    if (!cpfValido(cpf)) return false;
    const k = soDigitos(cpf);
    if (!porCpf.has(k)) porCpf.set(k, new Map());
    porCpf.get(k)!.set(alunoId, c);
    return true;
  };
  for (const [alunoId, { entrada, crianca }] of criancas) {
    // Só o CPF do responsável financeiro leva à criança.
    let achou = false;
    for (const g of entrada.ctx.guardians.filter((x: Guardian) => x.alunoId === alunoId && x.financeiro)) {
      if (add(g.cpf || '', alunoId, crianca)) achou = true;
    }
    if (!achou) semCpf.push(crianca.nome);
    if (!crianca.liberado) semDesconto.push(crianca.nome);
  }
  const lista: SituacaoDoc[] = [];
  for (const [cpf, mapa] of porCpf) {
    lista.push({
      id: await hashCpf(cpf),
      criancas: [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      atualizadoEm: agora,
    });
  }
  return { docs: lista, semCpf, semDesconto };
}

/** Compara dois resumos ignorando a data de atualização. */
export const mesmoConteudo = (a: SituacaoDoc, b: SituacaoDoc) =>
  JSON.stringify(a.criancas) === JSON.stringify(b.criancas);

/* ------------------------------------------------------------------ */
/* Pix (BR Code "copia e cola")                                        */
/* ------------------------------------------------------------------ */

/** CRC-16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), exigido no fim do código Pix. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

/** Código "Pix copia e cola" com valor fixo, para a chave da escola. */
export function gerarPixCopiaECola(valor: number, opcoes: { chave?: string; nome?: string; cidade?: string } = {}): string {
  const chave = opcoes.chave ?? PIX_CHAVE;
  const nome = (opcoes.nome ?? PIX_NOME).slice(0, 25);
  const cidade = (opcoes.cidade ?? PIX_CIDADE).slice(0, 15);
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  const base =
    campo('00', '01') +
    campo('01', '11') + // código estático, reutilizável
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor > 0 ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', '***')) +
    '6304';
  return base + crc16(base);
}

/* ------------------------------------------------------------------ */
/* Mensagem do comprovante                                             */
/* ------------------------------------------------------------------ */

export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function mensagemComprovante(c: Pick<CriancaSituacao, 'nome' | 'turma' | 'novembro'>): string {
  return (
    `Olá! Segue o comprovante do Pix da 1ª parcela da mensalidade de janeiro de 2027.\n\n` +
    `Criança: ${c.nome}\n` +
    `Turma: ${c.turma}\n` +
    `Valor pago: ${moeda(c.novembro)}\n\n` +
    `(comprovante em anexo)`
  );
}

export const linkZapComprovante = (c: Pick<CriancaSituacao, 'nome' | 'turma' | 'novembro'>) =>
  `https://wa.me/${ZAP_FINANCEIRO}?text=${encodeURIComponent(mensagemComprovante(c))}`;

export const linkZapDuvida = (nome?: string) =>
  `https://wa.me/${ZAP_FINANCEIRO}?text=${encodeURIComponent(nome ? `Olá! Tenho uma dúvida sobre a matrícula 2027 de ${nome}.` : 'Olá! Tenho uma dúvida sobre a matrícula 2027.')}`;
