import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { MARCADORES_CONHECIDOS, TipoContrato, NOMES_DOCS } from './montarDados';

/** Marcadores no modelo são {{assim}}; trechos entre {{#x}} e {{/x}} somem quando x é falso. */
const OPCOES = { paragraphLoop: true, linebreaks: true, delimiters: { start: '{{', end: '}}' } };

// ---------- base64 <-> bytes (modelos ficam no Firestore como texto) ----------
export function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesParaBase64(bytes: Uint8Array): string {
  let bin = '';
  const bloco = 0x8000; // em blocos, pra não estourar a pilha com arquivos maiores
  for (let i = 0; i < bytes.length; i += bloco) bin += String.fromCharCode(...bytes.subarray(i, i + bloco));
  return btoa(bin);
}

function mensagemDeErro(e: any): string {
  const lista = e?.properties?.errors as any[] | undefined;
  if (lista && lista.length) {
    const msgs = lista.slice(0, 4).map(x => {
      const exp = x?.properties?.explanation || x?.message || 'erro no marcador';
      return String(exp);
    });
    return msgs.join(' | ');
  }
  return e?.message || 'erro desconhecido';
}

// ---------- conferência de um modelo enviado ----------
export interface ResultadoModelo {
  ok: boolean;
  erros: string[];          // impedem o uso do modelo
  marcadores: string[];     // marcadores encontrados
  desconhecidos: string[];  // marcadores que o sistema não sabe preencher
}

export function validarModelo(bytes: Uint8Array): ResultadoModelo {
  const vazio = { ok: false, erros: [] as string[], marcadores: [] as string[], desconhecidos: [] as string[] };
  let zip: PizZip;
  try { zip = new PizZip(bytes); } catch { return { ...vazio, erros: ['O arquivo não é um documento Word (.docx) válido.'] }; }
  if (!zip.file('word/document.xml')) return { ...vazio, erros: ['O arquivo não parece ser um documento Word (.docx).'] };

  let doc: Docxtemplater;
  try { doc = new Docxtemplater(zip, OPCOES); }
  catch (e) { return { ...vazio, erros: [`Há um marcador mal formado no modelo: ${mensagemDeErro(e)}`] }; }

  const texto = doc.getFullText();
  const achados = new Set<string>();
  const rx = /\{\{\s*[#\/^]?\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(texto)) !== null) achados.add(m[1]);
  const marcadores = [...achados].sort();
  const desconhecidos = marcadores.filter(x => !MARCADORES_CONHECIDOS.includes(x));
  const erros = desconhecidos.length
    ? [`O modelo usa marcadores que o sistema não conhece: ${desconhecidos.map(d => `{{${d}}}`).join(', ')}. Confira a grafia.`]
    : [];
  return { ok: erros.length === 0, erros, marcadores, desconhecidos };
}

// ---------- preenchimento ----------
export function preencherModelo(bytes: Uint8Array, dados: Record<string, string | boolean>): Uint8Array {
  const faltaram = new Set<string>();
  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(new PizZip(bytes), {
      ...OPCOES,
      nullGetter(parte: any) { faltaram.add(String(parte?.value)); return ''; },
    });
    doc.render(dados);
  } catch (e) {
    throw new Error(`Não foi possível preencher o modelo: ${mensagemDeErro(e)}`);
  }
  if (faltaram.size) {
    throw new Error(`O modelo usa marcadores que o sistema não conhece: ${[...faltaram].map(f => `{{${f}}}`).join(', ')}.`);
  }
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
}

// ---------- arquivos ----------
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function nomeDoArquivo(tipo: TipoContrato, numero: string, anoLetivo: number, alunoNome: string, versao: number): string {
  const aluno = semAcento(alunoNome).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const doc = semAcento(NOMES_DOCS[tipo].curto).replace(/[^A-Za-z0-9]+/g, '');
  return `${doc}_${numero}-${anoLetivo}_${aluno}${versao > 1 ? `_v${versao}` : ''}.docx`;
}

export function zipar(arquivos: { nome: string; bytes: Uint8Array }[]): Uint8Array {
  const zip = new PizZip();
  const usados = new Set<string>();
  arquivos.forEach(a => {
    let nome = a.nome; let i = 2;
    while (usados.has(nome)) nome = a.nome.replace(/(\.[^.]+)$/, `_${i++}$1`);
    usados.add(nome);
    zip.file(nome, a.bytes);
  });
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
}

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export function baixarArquivo(nome: string, bytes: Uint8Array, mime: string = MIME_DOCX) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
