/**
 * Acesso ao banco dos pedidos de uniformes. Ver uniformes.ts para o desenho das coleções.
 */
import { doc, runTransaction } from 'firebase/firestore';
import { db, getCollectionData, getDocumentById, saveDocument, deleteDocument } from '../firebase';
import { COL_FAMILIAS } from './uniformes';
import { mesmaFamilia, type FamiliaUniforme } from './familias';
import {
  COL_CATALOGO, COL_CAMPANHAS, COL_PEDIDOS, CATALOGO_PADRAO, idPedido,
  type PecaCatalogo, type CampanhaUniforme, type PedidoUniformeDoc, type EnvioUniforme,
} from './uniformes';

export async function carregarCatalogo(): Promise<PecaCatalogo[]> {
  const lista = await getCollectionData<PecaCatalogo>(COL_CATALOGO);
  return lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Grava o catálogo padrão (só as peças que ainda não existem). */
export async function semearCatalogo(existentes: PecaCatalogo[]): Promise<number> {
  const ids = new Set(existentes.map(p => p.id));
  let n = 0;
  for (const p of CATALOGO_PADRAO) {
    if (ids.has(p.id)) continue;
    await saveDocument(COL_CATALOGO, p);
    n++;
  }
  return n;
}

export async function carregarCampanhas(): Promise<CampanhaUniforme[]> {
  const lista = await getCollectionData<CampanhaUniforme>(COL_CAMPANHAS);
  return lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

export async function carregarPedidos(): Promise<PedidoUniformeDoc[]> {
  return getCollectionData<PedidoUniformeDoc>(COL_PEDIDOS);
}

/** Resumo da família pelo hash do CPF de um responsável (leitura só pelo id exato). */
export const familiaPorCpfHash = (hash: string) => getDocumentById<FamiliaUniforme>(COL_FAMILIAS, hash);

export const carregarFamilias = () => getCollectionData<FamiliaUniforme>(COL_FAMILIAS);

/**
 * Publica os resumos das famílias: grava só os que mudaram e apaga os que não valem mais
 * (responsável sem criança matriculada, CPF trocado…).
 */
export async function publicarFamilias(novos: FamiliaUniforme[]): Promise<{ gravados: number; removidos: number }> {
  const atuais = await carregarFamilias();
  const porId = new Map(atuais.map(a => [a.id, a]));
  let gravados = 0, removidos = 0;
  for (const n of novos) {
    const a = porId.get(n.id);
    if (a && mesmaFamilia(a, n)) continue;
    await saveDocument(COL_FAMILIAS, n); gravados++;
  }
  const ids = new Set(novos.map(n => n.id));
  for (const a of atuais) if (!ids.has(a.id)) { await deleteDocument(COL_FAMILIAS, a.id); removidos++; }
  return { gravados, removidos };
}

/** Pedidos de uma família (pelo grupo) em cada lote — leitura só pelo id exato. */
export async function pedidosDaFamilia(grupo: string, campanhas: CampanhaUniforme[]): Promise<PedidoUniformeDoc[]> {
  const docs = await Promise.all(campanhas.map(c =>
    getDocumentById<PedidoUniformeDoc>(COL_PEDIDOS, idPedido(c.id, grupo)).catch(() => null)));
  return docs.filter((d): d is PedidoUniformeDoc => !!d);
}

/**
 * Acrescenta um envio ao pedido da família naquele lote (cria o documento se for o primeiro).
 * Roda numa transação: lê o que já existe e grava tudo de volta com o envio novo no fim —
 * as regras do Firestore só deixam a família acrescentar, nunca alterar o que já estava lá.
 */
export async function acrescentarEnvio(campanhaId: string, grupo: string, envio: EnvioUniforme): Promise<void> {
  const id = idPedido(campanhaId, grupo);
  const ref = doc(db, COL_PEDIDOS, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists() ? (snap.data() as PedidoUniformeDoc) : null;
    // Mantém os campos que já existiam; só acrescenta o envio no fim (é o que as regras permitem à família).
    const novo: PedidoUniformeDoc = atual
      ? { ...atual, envios: [...(atual.envios || []), envio], atualizadoEm: envio.criadoEm }
      : { id, campanhaId, grupo, envios: [envio], atualizadoEm: envio.criadoEm };
    tx.set(ref, novo);
  });
}

/**
 * Altera um envio (pelo código) lendo a versão mais nova do documento, para não apagar
 * um envio que a família tenha acabado de acrescentar. `mudar` devolve o envio alterado
 * ou null para removê-lo. Se não sobrar nenhum envio, o documento é apagado.
 */
export async function alterarEnvio(pedidoId: string, codigo: string, mudar: (e: EnvioUniforme) => EnvioUniforme | null): Promise<void> {
  const ref = doc(db, COL_PEDIDOS, pedidoId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Pedido não encontrado.');
    const atual = snap.data() as PedidoUniformeDoc;
    const envios = atual.envios
      .map(e => (e.codigo === codigo ? mudar(e) : e))
      .filter((e): e is EnvioUniforme => !!e);
    if (envios.length === 0) tx.delete(ref);
    else tx.set(ref, { ...atual, envios, atualizadoEm: new Date().toISOString() });
  });
}

/** Pedido feito pela equipe para quem não tem o CPF do responsável financeiro no sistema. */
export async function salvarPedidoAvulso(campanhaId: string, envio: EnvioUniforme): Promise<void> {
  const chave = `avulso-${envio.codigo.replace(/[^A-Z0-9]/gi, '')}`;
  await saveDocument<PedidoUniformeDoc>(COL_PEDIDOS, {
    id: idPedido(campanhaId, chave), campanhaId, grupo: '', envios: [envio], atualizadoEm: envio.criadoEm,
  });
}

export const salvarCampanha = (c: CampanhaUniforme) => saveDocument(COL_CAMPANHAS, c);
export const salvarPeca = (p: PecaCatalogo) => saveDocument(COL_CATALOGO, p);
