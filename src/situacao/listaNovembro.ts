/**
 * Lista para imprimir: alunos matriculados em 2027 e o valor da parcela de NOVEMBRO
 * (metade dos 50% que sobram da mensalidade de janeiro, depois do desconto).
 *
 * Usa exatamente o mesmo cálculo da página "Situação da matrícula" (montarCriancas),
 * então o valor impresso é o mesmo que a família vê pelo CPF.
 */
import type { ContratoDoc } from '../types';
import { ContratoContexto, responsavelFinanceiro } from '../contratos/montarDados';
import { montarCriancas, moeda, PIX_CHAVE_FORMATADA, ZAP_FINANCEIRO_FORMATADO } from './situacao';

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const somar = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b * 100, 0)) / 100;

const ROT_ANDAMENTO = { assinado: 'Assinado', aguardando: 'Aguardando assinatura', preparando: 'Em preparação' } as const;

interface LinhaNov {
  nome: string;
  turma: string;
  ordem: number;
  responsavel: string;
  telefone: string;
  contrato: string;
  mensalidade: number;
  desconto: number;
  novembro: number;
  janeiro: number;
  temDesconto: boolean;
}

export function montarListaNovembro(ctxs: ContratoContexto[], docs: ContratoDoc[]): LinhaNov[] {
  const out: LinhaNov[] = [];
  for (const [alunoId, { entrada, crianca }] of montarCriancas(ctxs, docs)) {
    const resp = responsavelFinanceiro(entrada.ctx.guardians, alunoId);
    out.push({
      nome: crianca.nome,
      turma: crianca.turma,
      ordem: entrada.carta.somenteContraturno ? 999 : entrada.carta.turma.idadeRef,
      responsavel: resp?.nome || '—',
      telefone: resp?.telefone || '',
      contrato: ROT_ANDAMENTO[crianca.andamento],
      mensalidade: crianca.mensalidade,
      desconto: crianca.desconto,
      novembro: crianca.novembro,
      janeiro: crianca.janeiro,
      temDesconto: crianca.liberado,
    });
  }
  return out.sort((a, b) => a.ordem - b.ordem || a.turma.localeCompare(b.turma, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Abre uma janela com a lista pronta e chama a impressão. Devolve false se o navegador bloquear a janela. */
export function imprimirListaNovembro(ctxs: ContratoContexto[], docs: ContratoDoc[]): boolean {
  const todas = montarListaNovembro(ctxs, docs);
  const comDesconto = todas.filter(l => l.temDesconto);
  const semDesconto = todas.filter(l => !l.temDesconto);

  // agrupa por turma, mantendo a ordem
  const grupos: { turma: string; itens: LinhaNov[] }[] = [];
  for (const l of comDesconto) {
    const g = grupos[grupos.length - 1];
    if (g && g.turma === l.turma) g.itens.push(l); else grupos.push({ turma: l.turma, itens: [l] });
  }

  let n = 0;
  const corpo = grupos.map(g => {
    const linhas = g.itens.map(l => `
      <tr>
        <td class="n">${++n}</td>
        <td><b>${esc(l.nome)}</b></td>
        <td>${esc(l.responsavel)}<div class="s">${esc(l.telefone)}</div></td>
        <td class="ct">${esc(l.contrato)}</td>
        <td class="v">${moeda(l.mensalidade)}</td>
        <td class="v">${moeda(l.janeiro)}</td>
        <td class="v nov">${moeda(l.novembro)}</td>
        <td class="box"></td>
        <td class="dt"></td>
      </tr>`).join('');
    return `
      <tr class="grupo"><td colspan="9">${esc(g.turma)} · ${g.itens.length} ${g.itens.length === 1 ? 'criança' : 'crianças'}</td></tr>
      ${linhas}
      <tr class="sub"><td colspan="6">Subtotal ${esc(g.turma)}</td><td class="v nov">${moeda(somar(g.itens.map(i => i.novembro)))}</td><td colspan="2"></td></tr>`;
  }).join('');

  const totalNov = somar(comDesconto.map(l => l.novembro));
  const blocoSem = semDesconto.length ? `
    <h2>Sem desconto de 50% em janeiro · não pagam parcela em novembro (${semDesconto.length})</h2>
    <table><thead><tr><th class="n">Nº</th><th>Criança</th><th>Turma 2027</th><th>Responsável financeiro</th><th class="ct">Contrato</th></tr></thead><tbody>
    ${semDesconto.map((l, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(l.nome)}</b></td><td>${esc(l.turma)}</td><td>${esc(l.responsavel)}<div class="s">${esc(l.telefone)}</div></td><td class="ct">${esc(l.contrato)}</td></tr>`).join('')}
    </tbody></table>` : '';

  const hoje = new Date().toLocaleDateString('pt-BR');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Parcela de novembro — matrícula 2027</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Inter, Arial, sans-serif; color: #1f2937; margin: 0; font-size: 11px; }
      .topo { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1F3F24; padding-bottom: 8px; margin-bottom: 8px; }
      .topo img { height: 46px; }
      h1 { font-size: 17px; margin: 0; color: #1F3F24; }
      h2 { font-size: 13px; color: #1F3F24; margin: 18px 0 6px; }
      .sub { color: #4b5563; margin-top: 2px; font-size: 11px; }
      .tot { margin-left: auto; text-align: right; font-size: 11px; color: #4b5563; }
      .tot b { font-size: 15px; color: #1F3F24; }
      .nota { font-size: 10px; color: #4b5563; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #F5F1E6; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; padding: 5px 6px; border: 1px solid #cbd5e1; }
      td { padding: 5px 6px; border: 1px solid #cbd5e1; vertical-align: top; }
      tr { page-break-inside: avoid; }
      .n { width: 26px; text-align: center; color: #6b7280; }
      .v { text-align: right; white-space: nowrap; width: 92px; }
      th.v { text-align: right; }
      .nov { font-weight: 700; color: #1F3F24; background: #f0f7f1; }
      .ct { width: 120px; font-size: 10px; }
      .box { width: 44px; text-align: center; }
      .dt { width: 70px; }
      .s { font-size: 9.5px; color: #6b7280; }
      .grupo td { background: #1F3F24; color: #fff; font-weight: 700; font-size: 10.5px; padding: 4px 6px; }
      .sub td { font-size: 10px; color: #374151; text-align: right; background: #fafaf7; }
      .total td { font-weight: 700; font-size: 12px; background: #F5F1E6; text-align: right; }
      thead { display: table-header-group; }
    </style></head><body>
    <div class="topo">
      <img src="${LOGO}" alt="Sítio-Escola Geranium">
      <div><h1>Parcela de novembro · Matrícula 2027</h1>
        <div class="sub">Sítio-Escola Geranium · emitida em ${hoje}</div></div>
      <div class="tot">${comDesconto.length} ${comDesconto.length === 1 ? 'criança' : 'crianças'} com parcela em novembro<br>Total previsto: <b>${moeda(totalNov)}</b></div>
    </div>
    <p class="nota">Mensalidade de janeiro = ensino regular + contraturno + lanche. Desconto de 50%; os outros 50% divididos ao meio: metade em novembro e metade em janeiro (centavo ímpar fica em janeiro). Pix: CNPJ ${PIX_CHAVE_FORMATADA} · Financeiro: ${ZAP_FINANCEIRO_FORMATADO}.</p>
    <table><thead><tr>
      <th class="n">Nº</th><th>Criança</th><th>Responsável financeiro</th><th class="ct">Contrato</th>
      <th class="v">Mensalidade jan.</th><th class="v">Restante jan.</th><th class="v">Novembro</th><th class="box">Pago</th><th class="dt">Data</th>
    </tr></thead><tbody>
      ${corpo || '<tr><td colspan="9">Nenhuma criança com parcela em novembro.</td></tr>'}
      <tr class="total"><td colspan="6">Total de novembro</td><td class="v">${moeda(totalNov)}</td><td colspan="2"></td></tr>
    </tbody></table>
    ${blocoSem}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
