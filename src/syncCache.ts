/**
 * Leitura econômica das coleções do Firestore.
 *
 * Antes, cada abertura do sistema relia TODOS os documentos de todas as coleções
 * (~1.000+ leituras por vez) e a cota gratuita diária (50 mil leituras) estourava.
 *
 * Agora:
 * - Toda gravação feita por `saveDocument` em uma coleção sincronizada leva o campo
 *   `_sync` (hora do servidor).
 * - O navegador da equipe guarda uma cópia das coleções (IndexedDB). Na próxima
 *   abertura busca só os documentos com `_sync` mais novo que a última busca, e confere
 *   a quantidade total com uma contagem (1 leitura a cada 1.000 documentos). Se a
 *   contagem não bater (algo foi apagado, ou gravado por uma versão antiga do app),
 *   relê aquela coleção inteira.
 * - Uma vez por dia a coleção é relida inteira, por garantia.
 * - O campo `_sync` nunca chega às telas: é retirado na leitura.
 */
import {
  collection, getDocs, getCountFromServer, query, where, Timestamp,
} from 'firebase/firestore';
import { db, CAMPO_SYNC, COLECOES_SINCRONIZADAS } from './firebase';

const NOME_BANCO = 'geranium-cache-v1';
const LOJA = 'colecoes';
const SOBREPOSICAO_MS = 5 * 60 * 1000; // margem para gravações quase simultâneas
const RELEITURA_COMPLETA_MS = 24 * 60 * 60 * 1000;

interface EntradaCache {
  docs: Record<string, any>;
  ultimoSync: number; // maior `_sync` (ms, hora do servidor) já visto
  completoEm: number; // quando a coleção foi lida inteira pela última vez (relógio local)
}

function abrirBanco(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(NOME_BANCO, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(LOJA); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function lerCache(nome: string): Promise<EntradaCache | null> {
  const banco = await abrirBanco();
  if (!banco) return null;
  return new Promise(resolve => {
    try {
      const req = banco.transaction(LOJA, 'readonly').objectStore(LOJA).get(nome);
      req.onsuccess = () => resolve((req.result as EntradaCache) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function gravarCache(nome: string, entrada: EntradaCache): Promise<void> {
  const banco = await abrirBanco();
  if (!banco) return;
  await new Promise<void>(resolve => {
    try {
      const tx = banco.transaction(LOJA, 'readwrite');
      tx.objectStore(LOJA).put(entrada, nome);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Apaga a cópia local (ao sair do sistema, restaurar backup ou limpar o banco). */
export async function limparCacheLocal(): Promise<void> {
  const banco = await abrirBanco();
  if (!banco) return;
  await new Promise<void>(resolve => {
    try {
      const tx = banco.transaction(LOJA, 'readwrite');
      tx.objectStore(LOJA).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Tira o `_sync` do documento e devolve a hora dele em ms (0 se não tiver). */
function separarSync(dados: any): { limpo: any; ms: number } {
  if (!dados || typeof dados !== 'object' || !(CAMPO_SYNC in dados)) return { limpo: dados, ms: 0 };
  const { [CAMPO_SYNC]: marca, ...limpo } = dados;
  const ms = marca && typeof marca.toMillis === 'function' ? marca.toMillis() : 0;
  return { limpo, ms };
}

async function lerCompleta(nome: string): Promise<any[]> {
  const snap = await getDocs(collection(db, nome));
  const docs: Record<string, any> = {};
  let ultimoSync = 0;
  snap.docs.forEach(d => {
    const { limpo, ms } = separarSync(d.data());
    docs[d.id] = limpo;
    ultimoSync = Math.max(ultimoSync, ms);
  });
  await gravarCache(nome, { docs, ultimoSync, completoEm: Date.now() });
  return Object.values(docs);
}

/**
 * Lê a coleção inteira, mas só gasta leituras com o que mudou desde a última vez
 * neste navegador. Para coleções fora de COLECOES_SINCRONIZADAS, lê tudo como antes.
 */
export async function carregarColecao<T>(nome: string): Promise<T[]> {
  if (!COLECOES_SINCRONIZADAS.has(nome)) {
    const snap = await getDocs(collection(db, nome));
    return snap.docs.map(d => d.data() as T);
  }

  const cache = await lerCache(nome);
  if (!cache || Date.now() - cache.completoEm > RELEITURA_COMPLETA_MS) {
    return (await lerCompleta(nome)) as T[];
  }

  try {
    const desde = Timestamp.fromMillis(Math.max(0, cache.ultimoSync - SOBREPOSICAO_MS));
    const [mudancas, contagem] = await Promise.all([
      getDocs(query(collection(db, nome), where(CAMPO_SYNC, '>', desde))),
      getCountFromServer(collection(db, nome)),
    ]);
    const docs = { ...cache.docs };
    let ultimoSync = cache.ultimoSync;
    mudancas.docs.forEach(d => {
      const { limpo, ms } = separarSync(d.data());
      docs[d.id] = limpo;
      ultimoSync = Math.max(ultimoSync, ms);
    });
    if (Object.keys(docs).length !== contagem.data().count) {
      // Algo foi apagado (ou gravado sem `_sync`): relê esta coleção inteira.
      return (await lerCompleta(nome)) as T[];
    }
    await gravarCache(nome, { docs, ultimoSync, completoEm: cache.completoEm });
    return Object.values(docs) as T[];
  } catch {
    return (await lerCompleta(nome)) as T[];
  }
}

/** Documentos de uma coleção que pertencem a um aluno (para os links das famílias). */
export async function carregarDoAluno<T>(nome: string, alunoId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, nome), where('alunoId', '==', alunoId)));
  return snap.docs.map(d => separarSync(d.data()).limpo as T);
}
