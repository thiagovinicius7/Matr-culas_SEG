/**
 * Resumo das famílias para o pedido de uniformes (coleção uniformeFamilias).
 *
 * Um documento por CPF de responsável cadastrado (qualquer responsável, não só o financeiro).
 * O id é o hash do CPF (o CPF não é gravado). O documento traz o nome e o telefone desse
 * responsável e as crianças dele que estão matriculadas para 2027 (novas, rematrículas e
 * "somente contraturno"), com a turma.
 *
 * `grupo` identifica o conjunto de crianças: pai e mãe das mesmas crianças caem no mesmo grupo,
 * então os pedidos que um faz aparecem também para o outro.
 *
 * A aba Uniformes publica este resumo sozinha toda vez que é aberta (só grava o que mudou).
 */
import type { Guardian } from '../types';
import { ContratoContexto, elegivelParaContrato, resolverCarta } from '../contratos/montarDados';
import { cpfValido, hashCpf, soDigitos } from '../situacao/situacao';

export interface FamiliaUniforme {
  id: string; // hash do CPF do responsável
  responsavel: string;
  parentesco: string;
  telefone: string;
  grupo: string;
  criancas: { nome: string; turma: string }[];
  atualizadoEm: string;
}

async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const grupoDasCriancas = (alunoIds: string[]) =>
  sha256(`geranium-uniformes-grupo|${[...alunoIds].sort().join(',')}`);

/** Monta os resumos a partir dos dados da escola. `semCpf` = crianças sem nenhum responsável com CPF válido. */
export async function montarFamilias(ctxs: ContratoContexto[], agora = new Date().toISOString()): Promise<{ docs: FamiliaUniforme[]; semCpf: string[] }> {
  const porCpf = new Map<string, { g: Guardian; criancas: Map<string, { nome: string; turma: string }> }>();
  const semCpf: string[] = [];

  for (const ctx of ctxs) {
    if (!elegivelParaContrato(ctx).ok) continue;
    const carta = resolverCarta(ctx);
    if (!carta) continue;
    const crianca = { nome: ctx.student.nome, turma: carta.somenteContraturno ? 'Somente Contraturno' : carta.turma.nome };
    let achou = false;
    for (const g of ctx.guardians.filter(x => x.alunoId === ctx.student.id)) {
      if (!cpfValido(g.cpf || '')) continue;
      achou = true;
      const k = soDigitos(g.cpf);
      if (!porCpf.has(k)) porCpf.set(k, { g, criancas: new Map() });
      const item = porCpf.get(k)!;
      // Se o mesmo responsável aparece com telefone só num dos cadastros, aproveita esse.
      if (!item.g.telefone && g.telefone) item.g = { ...item.g, telefone: g.telefone };
      item.criancas.set(ctx.student.id, crianca);
    }
    if (!achou) semCpf.push(crianca.nome);
  }

  const docs: FamiliaUniforme[] = [];
  for (const [cpf, { g, criancas }] of porCpf) {
    docs.push({
      id: await hashCpf(cpf),
      responsavel: (g.nome || '').trim(),
      parentesco: g.parentesco || '',
      telefone: (g.telefone || g.contato || '').trim(),
      grupo: await grupoDasCriancas([...criancas.keys()]),
      criancas: [...criancas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      atualizadoEm: agora,
    });
  }
  return { docs, semCpf: [...new Set(semCpf)].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
}

export const mesmaFamilia = (a: FamiliaUniforme, b: FamiliaUniforme) => {
  const { atualizadoEm: _a, ...ra } = a;
  const { atualizadoEm: _b, ...rb } = b;
  return JSON.stringify(ra) === JSON.stringify(rb);
};
