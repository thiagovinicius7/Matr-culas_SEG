// Funções compartilhadas da área de Vivências (página pública + aba da equipe).
// Vivências usam coleções próprias ('vivencias' e 'vivenciaInscricoes') e não
// tocam em alunos, responsáveis ou matrículas.
import { collection, doc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { Vivencia, VivenciaInscricao } from './types';

export const COL_VIVENCIAS = 'vivencias';
export const COL_INSCRICOES = 'vivenciaInscricoes';

export const COMO_CONHECEU_OPCOES = [
  'Indicação de amigos ou família',
  'Instagram',
  'Google',
  'Já conheço o Sítio Geranium',
  'Passei em frente',
  'Outro',
];

export const PARENTESCO_VIVENCIA = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** "sábado, 14 de novembro" */
export function dataPorExtenso(iso: string, comAno = false): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return `${SEMANA[dt.getUTCDay()]}, ${d} de ${MESES[m - 1]}${comAno ? ` de ${a}` : ''}`;
}

/** "14/11/2026" */
export function dataBR(iso?: string): string {
  if (!iso) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function horario(v: Pick<Vivencia, 'horaInicio' | 'horaFim'>): string {
  if (v.horaInicio && v.horaFim) return `${v.horaInicio} às ${v.horaFim}`;
  return v.horaInicio || '';
}

/** Idade em anos completos numa data de referência (YYYY-MM-DD). */
export function idadeEm(nascimento: string, referencia: string): number | null {
  if (!nascimento || !referencia) return null;
  const [na, nm, nd] = nascimento.split('-').map(Number);
  const [ra, rm, rd] = referencia.split('-').map(Number);
  if (!na || !ra) return null;
  let idade = ra - na;
  if (rm < nm || (rm === nm && rd < nd)) idade--;
  return idade < 0 ? null : idade;
}

export function textoIdade(nascimento: string, referencia: string): string {
  const i = idadeEm(nascimento, referencia);
  if (i === null) return '';
  return i === 1 ? '1 ano' : `${i} anos`;
}

export function faixaEtaria(v: Pick<Vivencia, 'idadeMin' | 'idadeMax'>): string {
  const min = v.idadeMin ?? null, max = v.idadeMax ?? null;
  if (min !== null && max !== null) return `de ${min} a ${max} anos`;
  if (min !== null) return `a partir de ${min} anos`;
  if (max !== null) return `até ${max} anos`;
  return '';
}

/** Número pronto para wa.me (com 55 na frente). Vazio se não parecer telefone. */
export function numeroWhatsApp(telefone: string): string {
  const tel = (telefone || '').replace(/\D/g, '');
  if (tel.length < 8) return '';
  return tel.startsWith('55') && tel.length > 11 ? tel : `55${tel}`;
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Link público. Sem id = página com todas as vivências abertas. */
export function linkPublico(vivenciaId?: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return vivenciaId ? `${base}?vivencia=${vivenciaId}` : `${base}?vivencias=1`;
}

export function vagasRestantes(v: Vivencia): number | null {
  if (!v.vagas || v.vagas <= 0) return null; // sem limite
  return Math.max(0, v.vagas - (v.inscritos || 0));
}

/** Vivências com inscrição aberta e data de hoje em diante (para a página pública). */
export async function carregarVivenciasAbertas(): Promise<Vivencia[]> {
  const snap = await getDocs(query(collection(db, COL_VIVENCIAS), where('aberta', '==', true)));
  const hoje = hojeISO();
  return snap.docs
    .map(d => d.data() as Vivencia)
    .filter(v => v.data >= hoje)
    .sort((a, b) => (a.data + (a.horaInicio || '')).localeCompare(b.data + (b.horaInicio || '')));
}

export class VagasEsgotadasError extends Error {
  restantes: number;
  constructor(restantes: number) {
    super('vagas esgotadas');
    this.restantes = restantes;
  }
}
export class InscricoesEncerradasError extends Error {}

/**
 * Grava as inscrições (uma por criança) e atualiza o contador de inscritos da
 * vivência numa TRANSAÇÃO: se duas famílias se inscreverem ao mesmo tempo na
 * última vaga, só uma consegue.
 */
export async function inscreverNaVivencia(vivenciaId: string, inscricoes: VivenciaInscricao[]): Promise<void> {
  const ref = doc(db, COL_VIVENCIAS, vivenciaId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new InscricoesEncerradasError('vivência não encontrada');
    const v = snap.data() as Vivencia;
    if (!v.aberta) throw new InscricoesEncerradasError('inscrições encerradas');
    const atuais = v.inscritos || 0;
    if (v.vagas > 0 && atuais + inscricoes.length > v.vagas) {
      throw new VagasEsgotadasError(Math.max(0, v.vagas - atuais));
    }
    inscricoes.forEach(i => tx.set(doc(db, COL_INSCRICOES, i.id), i));
    tx.update(ref, { inscritos: atuais + inscricoes.length });
  });
}
