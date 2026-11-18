/**
 * Acesso ao banco dos pedidos de uniformes. Ver uniformes.ts para o desenho das coleções.
 */
import { doc, runTransaction } from 'firebase/firestore';
import { db, getCollectionData, getDocumentById, saveDocument } from '../firebase';
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

/** Pedidos de uma família (pelo hash do CPF) em cada lote — leitura só pelo id exato. */
export async function pedidosDaFamilia(cpfHash: string, campanhas: CampanhaUniforme[]): Promise<PedidoUniformeDoc[]> {
  const docs = await Promise.all(campanhas.map(c =>
    getDocumentById<PedidoUniformeDoc>(COL_PEDIDOS, idPedido(c.id, cpfHash)).catch(() => null)));
  return docs.filter((d): d is PedidoUniformeDoc => !!d);
}

/**
 * Acrescenta um envio ao pedido da família naquele lote (cria o documento se for o primeiro).
 * Roda numa transação: lê o que já existe e grava tudo de volta com o envio novo no fim —
 * as regras do Firestore só deixam a família acrescentar, nunca alterar o que já estava lá.
 */
export async function acrescentarEnvio(campanhaId: string, cpfHash: string, envio: EnvioUniforme): Promise<void> {
  const id = idPedido(campanhaId, cpfHash);
  const ref = doc(db, COL_PEDIDOS, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.exists() ? (snap.data() as PedidoUniformeDoc) : null;
    const novo: PedidoUniformeDoc = {
      id, campanhaId, cpfHash,
      envios: [...(atual?.envios || []), envio],
      atualizadoEm: envio.criadoEm,
    };
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
    id: idPedido(campanhaId, chave), campanhaId, cpfHash: '', envios: [envio], atualizadoEm: envio.criadoEm,
  });
}

export const salvarCampanha = (c: CampanhaUniforme) => saveDocument(COL_CAMPANHAS, c);
export const salvarPeca = (p: PecaCatalogo) => saveDocument(COL_CATALOGO, p);
