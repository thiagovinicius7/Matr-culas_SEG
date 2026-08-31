export type StudentStatus = 'ativo' | 'trancado' | 'cancelado' | 'inativo';

export interface Student {
  id: string;
  nome: string;
  nascimento: string; // YYYY-MM-DD
  dataEntrada: string; // YYYY-MM-DD
  observacoes: string;
  status: StudentStatus;
  cpf?: string;
  comoConheceuEscola?: string;
  autorizadosBuscar?: string; // nomes de pessoas extras autorizadas a buscar a criança
  irmaosIds?: string[]; // IDs de outros Students que são irmãos matriculados na escola
  origemCadastro?: 'auto' | 'staff'; // 'auto' = criado pela própria família via Ficha de Dados Gerais pública
}

export type EstadoCivil = 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)' | 'União estável' | 'Outro';

export interface Guardian {
  id: string;
  alunoId: string;
  nome: string;
  parentesco: string; // e.g. Mãe, Pai, Tio, Avó, "Outro: <especificação>"
  /** @deprecated use `telefone` instead. Kept optional only for backward-compat during migration. */
  contato?: string;
  telefone: string; // substitui o antigo campo "contato"
  email?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  dataNascimento?: string; // YYYY-MM-DD
  estadoCivil?: EstadoCivil;
  financeiro: boolean; // Marks who is responsible for payments — só um Guardian por aluno deve ser true
}

export interface RegularClass {
  id: string;
  nome: string;
  natureza: 'Infantil' | 'Fundamental';
  idadeRef: number;
  valorMensal: number;
  ano?: number;
}

export type ContraturnoNature = 'Melaço' | 'Marmelada';
export type ContraturnoPeriod = 'Parcial' | 'Completo';

export interface ContraturnoSegment {
  id: string;
  alunoId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string | null; // null means active/ongoing
  natureza: ContraturnoNature; // 'Melaço' (up to 4 years old) or 'Marmelada' (5+ years old)
  diasSemana: ('Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex')[];
  periodo: ContraturnoPeriod;
  valorMensal: number;
}

/**
 * Fase do ciclo de matrícula do ano (novo aluno OU rematrícula seguem a mesma esteira).
 * 🌾 preparo_terra (negociação) → 🌱 semeadura (dados) → 🌿 enraizamento (contrato assinado)
 * → 🌸 florescer (boas-vindas enviadas) → 🌾 colheita (concluída)
 */
export type FaseProcessoMatricula =
  | 'preparo_terra'
  | 'semeadura'
  | 'enraizamento'
  | 'florescer'
  | 'colheita';

/**
 * Uma entrada do histórico de propostas de negociação de um Enrollment.
 * Nada é apagado quando a proposta muda — a entrada vigente é fechada
 * (vigenteAte preenchido) e uma nova é criada.
 */
export interface NegotiationHistoryEntry {
  id: string;
  enrollmentId: string;
  valorFinalRegular: number;
  descontoMensal: number;
  motivoDesconto: string; // ex: "Irmão na escola", "Filho de funcionária", texto livre
  vigenteDesde: string; // YYYY-MM-DD
  vigenteAte: string | null; // null = ainda vigente
  anotacoes: string;
}

export interface Enrollment {
  id: string;
  alunoId: string;
  ano: number;
  turmaRegularId: string; // locked by birthday cut-off
  valorRegularOriginal: number;
  descontoMensal: number; // monthly discount value in R$
  valorFinalRegular: number; // valorRegularOriginal - descontoMensal
  statusNegociacao: 'Pendente' | 'Em Negociação' | 'Confirmada' | 'Cancelada';
  faseProcesso: FaseProcessoMatricula;
  motivoDesconto?: string; // motivo do desconto atual, texto livre (ex: "Irmão na escola")
  anotacoes: string;
  descontoContraturno?: number;
  tipoDescontoRegular?: 'reais' | 'porcentagem';
  valorDescontoRegularInput?: number;
  tipoDescontoContraturno?: 'reais' | 'porcentagem';
  valorDescontoContraturnoInput?: number;
  adicionarLanche?: boolean;
  valorLanche?: number;
  adicionarAlmoco?: boolean;
  valorAlmoco?: number;
  diaVencimento?: '01' | '05' | '10' | '15' | '20';
  descontoPontualidade?: boolean; // legacy or backward compatibility alias
  descontoPontualidadeRegular?: boolean;
  descontoPontualidadeContraturno?: boolean;

  // Novos campos para Carta de Intenção e Rematrícula 2027
  valorProposto2027?: number; // Valor personalizado editável para a regular de 2027
  turmaPropostaId2027?: string; // Turma prevista 2027
  contraturnoDesejado2027?: boolean;
  diasContraturno2027?: ('Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex')[];
  horarioSaida2027?: '15:30' | '17:30';
  periodoContraturno2027?: 'Parcial' | 'Completo';
  adicionarLanche2027?: boolean;
  valorLanche2027?: number;
  adicionarAlmoco2027?: boolean;
  valorAlmoco2027?: number;
  diaVencimento2027?: '01' | '05' | '10' | '15' | '20';
  descontoPontualidadeAtivo2027?: boolean;
  valorDescontoPontualidade2027?: number;
  statusIntencao2027?: 'Pendente' | 'Confirmada' | 'Em Análise' | 'Não Renovará';
  observacoesFamilia2027?: string;
  dataIntencao2027?: string;
}

export interface FinancialMovement {
  id: string;
  alunoId: string;
  data: string; // YYYY-MM-DD
  tipo: 'Matrícula' | 'Contraturno_Ativação' | 'Contraturno_Cancelamento' | 'Desconto_Alterado' | 'Reajuste_Geral' | 'Transição_Ano_Letivo';
  descricao: string;
  valorAnterior: number; // Previous total monthly sum
  valorNovo: number; // New total monthly sum
}

export interface ContraturnoPrice {
  id: string;
  frequencia: number; // 0 is avulso, 1-5 is weekly frequency
  valorParcial: number;
  valorCompleto: number;
  valorSomenteContraturnoParcial?: number;
  valorSomenteContraturnoCompleto?: number;
  ano?: number;
}

/**
 * Exceção pontual da Escala do Contraturno (uso operacional do dia a dia).
 * NUNCA altera o ContraturnoSegment fixo do aluno — vale só para a data
 * específica indicada, para fins de exibição/impressão da escala do dia.
 */
export interface ContraturnoDailyException {
  id: string;
  data: string; // YYYY-MM-DD — dia específico a que a exceção se aplica
  tipo: 'mover' | 'faltou' | 'avulso_diaria';
  alunoId?: string; // presente quando tipo é 'mover' ou 'faltou' (aluno já cadastrado)
  diaOrigemSemana?: 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex'; // usado em 'mover', de onde veio
  nomeAvulso?: string; // usado em 'avulso_diaria' quando a criança não tem cadastro (ex: diária externa)
  observacao?: string;
}

/**
 * Um documento real do Pack de Matrícula (contrato, ficha, etc.), com o
 * arquivo já enviado e disponível para download pela equipe. O `id` é uma
 * chave fixa e estável (ex: 'ficha_dados_gerais') usada para localizar o
 * documento certo em cada fase, independente do nome do arquivo enviado.
 */
export interface PackDocument {
  id: string;
  nome: string;
  fase: 'semeadura' | 'enraizamento' | 'florescer';
  url: string;
  storagePath: string; // caminho no Firebase Storage, usado para poder substituir/excluir
  atualizadoEm: string; // YYYY-MM-DD
}
