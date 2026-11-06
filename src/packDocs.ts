import type { PackDocument } from './types';

/** Limite do Firestore: 1 MiB por documento. O arquivo vai em base64 (~33% maior). */
export const TAMANHO_MAX_PACK_DOC = 700 * 1024;

const cacheBlob = new Map<string, string>();

/** Endereço para abrir o arquivo: arquivos guardados no banco viram um link temporário no navegador. */
export function urlDoPackDocument(d: PackDocument): string {
  if (!d.base64) return d.url;
  const chave = `${d.id}|${d.atualizadoEm}|${d.tamanho ?? d.base64.length}`;
  const guardado = cacheBlob.get(chave);
  if (guardado) return guardado;
  const bin = atob(d.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: d.mime || 'application/octet-stream' }));
  cacheBlob.set(chave, url);
  return url;
}
