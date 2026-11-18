/**
 * Lista para imprimir: alunos matriculados em 2027 e o valor da parcela de NOVEMBRO
 * (metade do que sobra da mensalidade de janeiro, depois do desconto).
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
  percentual: number;
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
      percentual: crianca.percentual ?? 50,
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
        <td><b>${esc(l.nome)}</b>${l.percentual !== 50 ? `<div class="s">desconto de ${String(l.percentual).replace('.', ',')}%</div>` : ''}</td>
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
    <h2>Sem desconto em janeiro · não pagam parcela em novembro (${semDesconto.length})</h2>
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
    <p class="nota">Mensalidade de janeiro = ensino regular + contraturno + lanche. Desconto padrão de 50% (algumas crianças têm outro percentual, indicado ao lado do nome); o restante dividido ao meio: metade em novembro e metade em janeiro (centavo ímpar fica em janeiro). Pix: CNPJ ${PIX_CHAVE_FORMATADA} · Financeiro: ${ZAP_FINANCEIRO_FORMATADO}.</p>
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

/* ------------------------------------------------------------------ */
/* Planilha Excel (.xlsx) — montada à mão com PizZip, sem biblioteca nova */
/* ------------------------------------------------------------------ */

type Cel = string | number | { f: string } | null;
const xml = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const colLetra = (i: number) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** estilos: 0 normal · 1 cabeçalho · 2 moeda · 3 total (negrito) · 4 total moeda · 5 título */
function folha(linhas: { cels: Cel[]; estilo?: number[] | number }[], larguras: number[], opc: { congelarLinha?: number; filtro?: string } = {}) {
  const rows = linhas.map((l, r) => {
    const cs = l.cels.map((v, c) => {
      if (v === null || v === '') return '';
      const ref = `${colLetra(c)}${r + 1}`;
      const st = Array.isArray(l.estilo) ? (l.estilo[c] ?? 0) : (l.estilo ?? 0);
      const s = st ? ` s="${st}"` : '';
      if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
      if (typeof v === 'object') return `<c r="${ref}"${s}><f>${xml(v.f)}</f></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cs}</row>`;
  }).join('');
  const cols = `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const pane = opc.congelarLinha
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${opc.congelarLinha}" topLeftCell="A${opc.congelarLinha + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '';
  const filtro = opc.filtro ? `<autoFilter ref="${opc.filtro}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData>${filtro}<pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
}

export async function baixarExcelNovembro(ctxs: ContratoContexto[], docs: ContratoDoc[]) {
  const { default: PizZip } = await import('pizzip');
  const todas = montarListaNovembro(ctxs, docs);
  const com = todas.filter(l => l.temDesconto);
  const sem = todas.filter(l => !l.temDesconto);

  // Aba 1 — Novembro
  const cab = ['Nº', 'Turma 2027', 'Criança', 'Responsável financeiro', 'Telefone', 'Contrato', 'Mensalidade jan.', 'Desconto', 'Novembro', 'Restante jan.', 'Pago', 'Data do pagamento', '% desconto'];
  const L: { cels: Cel[]; estilo?: number[] | number }[] = [
    { cels: [`Parcela de novembro · Matrícula 2027 · Sítio-Escola Geranium · emitida em ${new Date().toLocaleDateString('pt-BR')}`], estilo: 5 },
    { cels: cab, estilo: 1 },
  ];
  const moedaEst = [0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0];
  com.forEach((l, i) => L.push({ cels: [i + 1, l.turma, l.nome, l.responsavel, l.telefone, l.contrato, l.mensalidade, l.desconto, l.novembro, l.janeiro, '', '', l.percentual], estilo: moedaEst }));
  const ini = 3, fim = 2 + com.length;
  if (com.length) {
    L.push({
      cels: ['', '', `Total (${com.length} ${com.length === 1 ? 'criança' : 'crianças'})`, '', '', '', { f: `SUM(G${ini}:G${fim})` }, { f: `SUM(H${ini}:H${fim})` }, { f: `SUM(I${ini}:I${fim})` }, { f: `SUM(J${ini}:J${fim})` }, '', '', ''],
      estilo: [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3],
    });
  }
  const aba1 = folha(L, [5, 20, 34, 32, 16, 22, 15, 14, 14, 14, 8, 16, 11], { congelarLinha: 2, filtro: `A2:M${Math.max(fim, 2)}` });

  // Aba 2 — Sem desconto
  const L2: { cels: Cel[]; estilo?: number[] | number }[] = [
    { cels: ['Sem desconto em janeiro · não pagam parcela em novembro'], estilo: 5 },
    { cels: ['Nº', 'Turma 2027', 'Criança', 'Responsável financeiro', 'Telefone', 'Contrato'], estilo: 1 },
    ...sem.map((l, i) => ({ cels: [i + 1, l.turma, l.nome, l.responsavel, l.telefone, l.contrato] as Cel[] })),
  ];
  const aba2 = folha(L2, [5, 20, 34, 32, 16, 22], { congelarLinha: 2 });

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1F3F24"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3F24"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F1E6"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Novembro" sheetId="1" r:id="rId1"/><sheet name="Sem desconto" sheetId="2" r:id="rId2"/></sheets>${com.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Novembro!$A$2:$M$${fim}</definedName></definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', estilos);
  zip.file('xl/worksheets/sheet1.xml', aba1);
  zip.file('xl/worksheets/sheet2.xml', aba2);
  const bytes: Uint8Array = zip.generate({ type: 'uint8array', compression: 'DEFLATE' });

  const d = new Date();
  const nome = `Parcela_novembro_2027_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { total: com.length, sem: sem.length };
}
