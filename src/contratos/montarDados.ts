import { Student, Guardian, Enrollment, RegularClass, ContraturnoPrice, ContraturnoSegment } from '../types';
import {
  ANO_CARTA_INTENCAO, DIA_VENCIMENTO_PADRAO, DESCONTO_PONTUALIDADE_PERCENTUAL, SOMENTE_CONTRATURNO_CLASS,
  TAXA_MATERIAL_2027, getEnrollmentBaseDaCarta, getNextYearClass, getContraturnoPriceDynamic,
  valorComPontualidade, normalizeClassId, getDadosFaltandoParaContrato,
} from '../data';
import { numeroPorExtenso, reaisPorExtenso, formatarMoeda, formatarPercentual } from './extenso';

export type TipoContrato = 'contrato' | 'contraturno' | 'aditivo' | 'imagem';
export const ORDEM_TIPOS: TipoContrato[] = ['contrato', 'contraturno', 'aditivo', 'imagem'];
export const NOMES_DOCS: Record<TipoContrato, { nome: string; curto: string }> = {
  contrato:    { nome: 'Contrato 2027',           curto: 'Contrato' },
  contraturno: { nome: 'Contrato do contraturno', curto: 'Contraturno' },
  aditivo:     { nome: 'Aditivo de alimentação',  curto: 'Aditivo' },
  imagem:      { nome: 'Termo de imagem',         curto: 'Imagem' },
};
export type PerfilContrato = 'regular' | 'regular_ct' | 'so_ct';
export const NOMES_PERFIL: Record<PerfilContrato, string> = {
  regular: 'só ensino regular', regular_ct: 'regular com contraturno', so_ct: 'só contraturno',
};

type Dia = 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex';
const DIAS_EXTENSO: Record<Dia, string> = {
  Seg: 'segunda-feira', Ter: 'terça-feira', Qua: 'quarta-feira', Qui: 'quinta-feira', Sex: 'sexta-feira',
};
const ORDEM_DIAS: Dia[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
/** Frequências que existem na tabela de modalidades do contrato do contraturno. */
export const FREQUENCIAS_NO_CONTRATO = [1, 2, 3, 5];
/** Valor do lanche quando a Carta não define (mesmo padrão da tela da Carta). */
export const LANCHE_VALOR_PADRAO = 250;

export interface ContratoContexto {
  student: Student;
  guardians: Guardian[];
  enrollments: Enrollment[];
  classPrices: RegularClass[];
  contraturnoPrices: ContraturnoPrice[];
  contraturnos: ContraturnoSegment[];
}

export interface CartaResolvida {
  base: Enrollment;
  turma: RegularClass;                 // pode ser SOMENTE_CONTRATURNO_CLASS
  somenteContraturno: boolean;
  natureza: 'Infantil' | 'Fundamental' | null;
  mensalidadeTabela: number;
  mensalidade: number;                 // valor combinado na Carta (já com o desconto)
  descontoPercentual: number;
  temDesconto: boolean;
  pontualidadeAtiva: boolean;
  mensalidadePontualidade: number;
  contraturno: null | {
    dias: Dia[]; periodo: 'Parcial' | 'Completo'; frequencia: number;
    valorTabela: number; valor: number; descontoPercentual: number; temDesconto: boolean;
  };
  lancheAdiciona: boolean;
  lancheValor: number;
  diaVencimento: string;
  /** A Carta não registra a escolha de contraturno, mas o aluno tem contraturno hoje: a equipe precisa abrir a Carta e salvar. */
  contraturnoSemEscolha: boolean;
  /** De onde vieram os dados (aparece na gaveta, pra conferir contra a Carta). */
  fonte: { anoMatricula: number; contraturnoNaCarta: 'sim' | 'nao' | 'nao_registrado'; cartaEm?: string };
}

export type ResultadoElegibilidade = { ok: true } | { ok: false; motivo: string };

const normaliza = (v: number) => Math.round(v * 100) / 100;
const percentualDesconto = (tabela: number, valor: number) =>
  tabela > 0 && valor < tabela - 0.005 ? ((tabela - valor) / tabela) * 100 : 0;

/**
 * Quem aparece na aba Contratos: aluno ativo, com rematrícula confirmada (Carta
 * "Confirmada" ou pré-matrícula do ano-alvo confirmada), que não foi cancelado
 * e não está concluindo o Fundamental.
 */
export function elegivelParaContrato(ctx: ContratoContexto): ResultadoElegibilidade {
  const { student, enrollments } = ctx;
  if (student.status !== 'ativo') return { ok: false, motivo: 'aluno não está ativo' };
  const base = getEnrollmentBaseDaCarta(student.id, enrollments);
  if (!base) return { ok: false, motivo: 'sem matrícula' };
  const e2027 = enrollments.find(e => e.alunoId === student.id && e.ano === ANO_CARTA_INTENCAO);
  if (e2027?.statusNegociacao === 'Cancelada') return { ok: false, motivo: 'matrícula cancelada' };
  const confirmada = base.statusIntencao2027 === 'Confirmada' || e2027?.statusNegociacao === 'Confirmada';
  if (!confirmada) return { ok: false, motivo: 'rematrícula ainda não confirmada' };
  const carta = resolverCarta(ctx);
  if (!carta) return { ok: false, motivo: 'conclui o Ensino Fundamental' };
  return { ok: true };
}

/**
 * Espelha as contas da tela dos pais (ParentCartaPortal): mesma matrícula base,
 * mesmos valores de reserva. Devolve null se o aluno conclui o Fundamental.
 */
export function resolverCarta(ctx: ContratoContexto): CartaResolvida | null {
  const { student, enrollments, classPrices, contraturnoPrices, contraturnos } = ctx;
  const base = getEnrollmentBaseDaCarta(student.id, enrollments);
  if (!base) return null;

  // ---- turma de 2027
  let turma: RegularClass;
  const idProposto = base.turmaPropostaId2027;
  if (base.ano >= ANO_CARTA_INTENCAO) {
    // aluno novo: o próprio registro de 2027 já traz a turma
    const id = idProposto || base.turmaRegularId;
    turma = id === 'sem_regular'
      ? SOMENTE_CONTRATURNO_CLASS
      : (classPrices.find(c => c.id === id && (c.ano || 2026) === 2027) || classPrices.find(c => normalizeClassId(c.id) === normalizeClassId(id))
        || getNextYearClass(student, undefined, classPrices, ANO_CARTA_INTENCAO) || SOMENTE_CONTRATURNO_CLASS);
  } else {
    const sugeridaBruta = getNextYearClass(student, base, classPrices, ANO_CARTA_INTENCAO);
    if (sugeridaBruta === null && !idProposto) return null; // conclui o Fundamental
    const sugerida = sugeridaBruta || SOMENTE_CONTRATURNO_CLASS;
    const id = idProposto || sugerida.id;
    turma = id === 'sem_regular'
      ? SOMENTE_CONTRATURNO_CLASS
      : (classPrices.find(c => c.id === id && (c.ano || 2026) === 2027) || classPrices.find(c => c.id === id) || sugerida);
  }
  const somenteContraturno = turma.id === 'sem_regular';
  const natureza = somenteContraturno ? null : (turma.natureza as 'Infantil' | 'Fundamental');

  // ---- mensalidade regular
  const mensalidadeTabela = somenteContraturno ? 0 : turma.valorMensal;
  const mensalidade = somenteContraturno ? 0 : (base.valorProposto2027 !== undefined ? base.valorProposto2027 : turma.valorMensal);
  const descontoPercentual = percentualDesconto(mensalidadeTabela, mensalidade);
  const pontualidadeAtiva = !somenteContraturno && base.descontoPontualidadeAtivo2027 === true;
  const mensalidadePontualidade = pontualidadeAtiva ? valorComPontualidade(mensalidade, mensalidadeTabela) : mensalidade;

  // ---- contraturno (mesmos padrões da tela dos pais)
  const ativo = contraturnos.find(c => c.alunoId === student.id && c.dataFim === null);
  // REGRA: o contrato segue a Carta, e só ela. Só entra contraturno se a Carta diz "Sim". Nunca se deduz
  // do contraturno que o aluno já tem no cadastro (isso é só uma sugestão da tela da Carta, não uma escolha).
  const escolhaNaCarta = base.contraturnoDesejado2027;
  const desejado = escolhaNaCarta === true;
  const contraturnoSemEscolha = escolhaNaCarta === undefined && !!ativo;
  let contraturno: CartaResolvida['contraturno'] = null;
  if (desejado) {
    const dias: Dia[] = (base.diasContraturno2027 && base.diasContraturno2027.length > 0)
      ? base.diasContraturno2027 : (ativo?.diasSemana as Dia[] | undefined) || ['Seg', 'Ter', 'Qua'];
    const horario: '15:30' | '17:30' =
      base.horarioSaida2027 === '15:30' || base.horarioSaida2027 === '17:30'
        ? base.horarioSaida2027
        : (base.periodoContraturno2027 === 'Parcial' || ativo?.periodo === 'Parcial' ? '15:30' : '17:30');
    const periodo = horario === '17:30' ? 'Completo' : 'Parcial';
    const diasOrdenados = ORDEM_DIAS.filter(d => dias.includes(d));
    const frequencia = diasOrdenados.length;
    const valorTabela = getContraturnoPriceDynamic(frequencia, periodo, contraturnoPrices, ANO_CARTA_INTENCAO);
    const valor = base.valorContraturnoProposto2027 !== undefined ? base.valorContraturnoProposto2027 : valorTabela;
    contraturno = {
      dias: diasOrdenados, periodo, frequencia, valorTabela, valor,
      descontoPercentual: percentualDesconto(valorTabela, valor),
      temDesconto: valor < valorTabela - 0.005,
    };
  }

  const lancheAdiciona = base.adicionarLanche2027 !== undefined ? base.adicionarLanche2027 : (base.adicionarLanche || false);
  const lancheValor = base.valorLanche2027 ?? base.valorLanche ?? LANCHE_VALOR_PADRAO;

  return {
    base, turma, somenteContraturno, natureza,
    mensalidadeTabela, mensalidade, descontoPercentual, temDesconto: mensalidade < mensalidadeTabela - 0.005,
    pontualidadeAtiva, mensalidadePontualidade, contraturno,
    lancheAdiciona, lancheValor,
    diaVencimento: base.diaVencimento2027 || DIA_VENCIMENTO_PADRAO,
    contraturnoSemEscolha,
    fonte: {
      anoMatricula: base.ano,
      contraturnoNaCarta: escolhaNaCarta === true ? 'sim' : escolhaNaCarta === false ? 'nao' : 'nao_registrado',
      cartaEm: base.dataIntencao2027 || base.cartaEnviadaEm2027,
    },
  };
}

export function perfilDoAluno(c: CartaResolvida): PerfilContrato {
  if (c.somenteContraturno) return 'so_ct';
  return c.contraturno ? 'regular_ct' : 'regular';
}

/** Quais documentos este aluno precisa (o aditivo só no Fundamental que adere ao lanche). */
export function documentosDoAluno(c: CartaResolvida): TipoContrato[] {
  const docs: TipoContrato[] = [];
  if (!c.somenteContraturno) docs.push('contrato');
  if (c.contraturno) docs.push('contraturno');
  if (!c.somenteContraturno && c.natureza === 'Fundamental' && c.lancheAdiciona) docs.push('aditivo');
  docs.push('imagem');
  return docs;
}

export function responsavelFinanceiro(guardians: Guardian[], alunoId: string): Guardian | undefined {
  const dele = guardians.filter(g => g.alunoId === alunoId);
  return dele.find(g => g.financeiro) || dele[0];
}

/** O que impede de gerar (faltas) e o que merece atenção (avisos). */
export function validarParaContrato(ctx: ContratoContexto, carta: CartaResolvida): { faltas: string[]; avisos: string[]; bloqueios: string[] } {
  const faltas: string[] = [];   // dados que a FAMÍLIA precisa completar na ficha
  const avisos: string[] = [];
  const bloqueios: string[] = []; // pendências que a EQUIPE resolve (impedem gerar)
  if (carta.contraturnoSemEscolha) {
    bloqueios.push('A Carta de Intenção não registra se o aluno terá contraturno em 2027 (e ele tem contraturno hoje). Abra a Carta, confirme a escolha e salve.');
  }
  const resp = responsavelFinanceiro(ctx.guardians, ctx.student.id);
  faltas.push(...getDadosFaltandoParaContrato(resp));
  if (!ctx.student.nascimento) faltas.push('data de nascimento do aluno');
  if (carta.contraturno) {
    if (carta.contraturno.frequencia === 0) faltas.push('dias do contraturno');
    else if (!FREQUENCIAS_NO_CONTRATO.includes(carta.contraturno.frequencia)) {
      avisos.push(`A tabela do contrato não tem a opção de ${carta.contraturno.frequencia} dias por semana: nenhuma caixinha será marcada (marque no Word).`);
    }
    if (carta.contraturno.valor <= 0) avisos.push('O valor do contraturno está zerado.');
  }
  if (!carta.somenteContraturno && carta.mensalidade <= 0) avisos.push('A mensalidade combinada na Carta está zerada.');
  if (carta.somenteContraturno && !carta.contraturno && !carta.contraturnoSemEscolha) {
    avisos.push('O aluno é "somente contraturno", mas a Carta diz que ele não terá contraturno.');
  }
  const comResposta = ctx.enrollments.filter(e => e.alunoId === ctx.student.id && e.statusIntencao2027 !== undefined);
  if (comResposta.length > 1) {
    avisos.push(`Há mais de uma matrícula com resposta da Carta (anos ${comResposta.map(e => e.ano).sort().join(' e ')}); o contrato usa a de ${carta.base.ano}.`);
  }
  if (carta.base.valorLanche2027 === undefined && carta.base.valorLanche === undefined) {
    avisos.push(`Valor do lanche não definido na Carta: o contrato usa R$ ${formatarMoeda(LANCHE_VALOR_PADRAO)}.`);
  }
  return { faltas, avisos, bloqueios };
}

// ---------- formatação de textos ----------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const dataPorExtenso = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
export const dataBR = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
};
export const diasPorExtenso = (dias: Dia[]) => {
  const nomes = ORDEM_DIAS.filter(d => dias.includes(d)).map(d => DIAS_EXTENSO[d]);
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
};
/** "Casado(a)" → "casado(a)": entra no meio da frase do contrato. */
const minuscula = (t?: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : '');
export const formatarNumeroDoc = (n: number) => String(n).padStart(3, '0');
/** "05" → "05 (cinco)" — mesmo formato do texto antigo ("10 (dez)"). */
const diaVencimentoTexto = (dia: string) => {
  const n = parseInt(dia, 10);
  return `${String(n).padStart(2, '0')} (${numeroPorExtenso(n)})`;
};

export interface NumerosContrato { contrato?: number; contraturno?: number; aditivo?: number }

/**
 * O termo de imagem leva o número do contrato regular; quando o aluno não tem
 * contrato regular (só contraturno), leva o do contraturno.
 */
export function numeroDoTermoDeImagem(n: NumerosContrato): number | undefined {
  return n.contrato ?? n.contraturno;
}

/** Todos os marcadores que os modelos de contrato podem usar. */
export function montarDadosDoContrato(
  ctx: ContratoContexto, carta: CartaResolvida, numeros: NumerosContrato, hoje: Date = new Date()
): Record<string, string | boolean> {
  const resp = responsavelFinanceiro(ctx.guardians, ctx.student.id);
  const ct = carta.contraturno;
  const taxa = carta.natureza ? TAXA_MATERIAL_2027[carta.natureza] : 0;
  const anual = normaliza(carta.mensalidade * 12);
  const dados: Record<string, string | boolean> = {
    numero_contrato: numeros.contrato !== undefined ? formatarNumeroDoc(numeros.contrato) : '',
    numero_contraturno: numeros.contraturno !== undefined ? formatarNumeroDoc(numeros.contraturno) : '',
    numero_aditivo: numeros.aditivo !== undefined ? formatarNumeroDoc(numeros.aditivo) : '',

    responsavel_nome: resp?.nome || '',
    responsavel_nacionalidade: resp?.nacionalidade || '',
    responsavel_estado_civil: minuscula(resp?.estadoCivil),
    responsavel_profissao: resp?.profissao || '',
    responsavel_cpf: resp?.cpf || '',
    responsavel_rg: resp?.rg || '',
    responsavel_endereco: resp?.endereco || '',
    responsavel_email: resp?.email || '',
    responsavel_telefone: resp?.telefone || resp?.contato || '',

    aluno_nome: ctx.student.nome,
    aluno_nascimento: dataBR(ctx.student.nascimento),
    aluno_turma: carta.somenteContraturno ? 'Somente Contraturno' : carta.turma.nome,

    data_documento: dataPorExtenso(hoje),
    dia_vencimento: diaVencimentoTexto(carta.diaVencimento),

    lanche_valor: formatarMoeda(carta.lancheValor),
    lanche_valor_extenso: reaisPorExtenso(carta.lancheValor),
    taxa_material_valor: formatarMoeda(taxa),
    taxa_material_extenso: reaisPorExtenso(taxa),

    faixa_infantil: carta.natureza === 'Infantil',
    faixa_fundamental: carta.natureza === 'Fundamental',
    valor_anual: formatarMoeda(anual),
    valor_anual_extenso: reaisPorExtenso(anual),
    mensalidade_valor: formatarMoeda(carta.mensalidade),
    mensalidade_extenso: reaisPorExtenso(carta.mensalidade),
    tem_desconto: carta.temDesconto,
    desconto_percentual: formatarPercentual(carta.descontoPercentual),
    tem_pontualidade: carta.pontualidadeAtiva,
    pontualidade_percentual: formatarPercentual(DESCONTO_PONTUALIDADE_PERCENTUAL),
    mensalidade_pontualidade: formatarMoeda(carta.mensalidadePontualidade),
    mensalidade_pontualidade_extenso: reaisPorExtenso(carta.mensalidadePontualidade),

    ct_valor: ct ? formatarMoeda(ct.valor) : '',
    ct_tem_desconto: !!ct && ct.temDesconto,
    ct_desconto_percentual: ct ? formatarPercentual(ct.descontoPercentual) : '',
    ct_dias: ct ? diasPorExtenso(ct.dias) : '',
  };
  for (const periodo of ['completo', 'parcial']) {
    for (const n of FREQUENCIAS_NO_CONTRATO) {
      const escolhida = !!ct && ct.periodo.toLowerCase() === periodo && ct.frequencia === n;
      dados[`ct_${periodo}_${n}x`] = escolhida ? 'X' : '';
      // Valor cheio de tabela de cada opção: sai da MESMA tabela de preços do sistema
      // que calcula o desconto em % — assim o contrato nunca contradiz a si mesmo.
      dados[`ct_preco_${periodo}_${n}x`] = formatarMoeda(
        getContraturnoPriceDynamic(n, periodo === 'completo' ? 'Completo' : 'Parcial', ctx.contraturnoPrices, ANO_CARTA_INTENCAO));
    }
  }
  return dados;
}

/** Nomes dos marcadores que o sistema sabe preencher (usado pra conferir os modelos enviados). */
export const MARCADORES_CONHECIDOS: string[] = Object.keys(
  montarDadosDoContratoVazio()
);

function montarDadosDoContratoVazio(): Record<string, string | boolean> {
  const chaves = [
    'numero_contrato', 'numero_contraturno', 'numero_aditivo',
    'responsavel_nome', 'responsavel_nacionalidade', 'responsavel_estado_civil', 'responsavel_profissao',
    'responsavel_cpf', 'responsavel_rg', 'responsavel_endereco', 'responsavel_email', 'responsavel_telefone',
    'aluno_nome', 'aluno_nascimento', 'aluno_turma', 'data_documento', 'dia_vencimento',
    'lanche_valor', 'lanche_valor_extenso', 'taxa_material_valor', 'taxa_material_extenso',
    'faixa_infantil', 'faixa_fundamental', 'valor_anual', 'valor_anual_extenso', 'mensalidade_valor', 'mensalidade_extenso',
    'tem_desconto', 'desconto_percentual', 'tem_pontualidade', 'pontualidade_percentual',
    'mensalidade_pontualidade', 'mensalidade_pontualidade_extenso',
    'ct_valor', 'ct_tem_desconto', 'ct_desconto_percentual', 'ct_dias',
    ...['completo', 'parcial'].flatMap(p => FREQUENCIAS_NO_CONTRATO.flatMap(n => [`ct_${p}_${n}x`, `ct_preco_${p}_${n}x`])),
  ];
  return Object.fromEntries(chaves.map(c => [c, '']));
}
