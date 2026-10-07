/**
 * Números e valores por extenso em português do Brasil — usados nos contratos
 * ("R$ 1.800,00 (mil e oitocentos reais)").
 */

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 0 a 999 */
function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`);
    }
  }
  return partes.join(' e ');
}

/** Inteiro de 0 a 999.999.999 por extenso. */
export function numeroPorExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new RangeError(`Número fora do intervalo suportado: ${n}`);
  if (n === 0) return 'zero';

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: { texto: string; valor: number }[] = [];
  if (milhoes > 0) partes.push({ texto: milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`, valor: milhoes });
  if (milhares > 0) partes.push({ texto: milhares === 1 ? 'mil' : `${ate999(milhares)} mil`, valor: milhares });
  if (resto > 0) partes.push({ texto: ate999(resto), valor: resto });

  // Conjunção "e": só antes do ÚLTIMO grupo, e apenas quando ele é menor que
  // 100 ou múltiplo exato de 100 (mil e um, mil e cem, vinte e um mil e
  // seiscentos) — não em "mil duzentos e cinquenta".
  let saida = partes[0].texto;
  for (let i = 1; i < partes.length; i++) {
    const ultimo = i === partes.length - 1;
    const v = partes[i].valor;
    const usaE = ultimo && (v < 100 || v % 100 === 0);
    saida += (usaE ? ' e ' : ' ') + partes[i].texto;
  }
  return saida;
}

/** Valor em reais por extenso: 629 → "seiscentos e vinte e nove reais"; 1,5 → "um real e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) throw new RangeError(`Valor inválido: ${valor}`);
  const totalCentavos = Math.round(valor * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const textoReais = reais === 1 ? 'um real' : `${numeroPorExtenso(reais)} ${
    // "um milhão de reais", "dois milhões de reais": usa "de" quando termina em milhão/milhões sem resto
    reais >= 1_000_000 && reais % 1_000_000 === 0 ? 'de reais' : 'reais'}`;
  if (centavos === 0) return reais === 0 ? 'zero reais' : textoReais;
  const textoCentavos = centavos === 1 ? 'um centavo' : `${numeroPorExtenso(centavos)} centavos`;
  return reais === 0 ? textoCentavos : `${textoReais} e ${textoCentavos}`;
}

/** 1800 → "1.800,00" (sem o "R$": o modelo já traz). */
export function formatarMoeda(valor: number): string {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 10 → "10"; 7.5 → "7,5"; 3.3333 → "3,3". Até uma casa decimal, sem zeros sobrando. */
export function formatarPercentual(p: number): string {
  const arred = Math.round(Number(p || 0) * 10) / 10;
  return arred.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
