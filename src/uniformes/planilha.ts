/**
 * Planilha Excel (.xlsx) do pedido de uniformes, com três abas:
 *  1. Pedidos     — uma linha por peça de cada pedido (com pagamento e situação)
 *  2. Fornecedora — quantidades por peça, cor e tamanho
 *  3. Recibos     — um recibo por família, pronto para imprimir (como a aba RECIBOS_IMPRESSÃO antiga)
 *  4. Pagamentos  — uma linha por parcela com "Pago?" (SIM/NÃO); a equipe marca e o sistema lê de volta
 *                   no botão "Atualizar pagamentos" (lerPagamentosDaPlanilha, mais abaixo).
 *
 * Montada à mão com PizZip (já usado nos contratos), sem biblioteca nova.
 */
import {
  valoresParcelas, listaFornecedor, situacaoDoEnvio, ROTULO_SITUACAO, parcelasDe, valorPago, formaPagamento, textoPagamento,
  dataHoraBR, slug, type CampanhaUniforme, type PedidoUniformeDoc, type EnvioUniforme,
} from './uniformes';

type Cel = string | number | { f: string } | null;
interface Linha { cels: Cel[]; estilo?: number[] | number; altura?: number }
interface Aba {
  nome: string; linhas: Linha[]; larguras: number[]; merges?: string[]; congelar?: number; filtro?: string; retrato?: boolean;
  /** Lista suspensa SIM/NÃO numa faixa (ex.: "I3:I200"), pintada de verde quando SIM. */
  simNao?: string;
}

const xml = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const col = (i: number) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/**
 * Estilos: 0 normal · 1 cabeçalho verde · 2 moeda · 3 total (negrito, areia) · 4 total moeda · 5 título
 * 6 faixa do recibo (verde, centralizado) · 7 itálico à direita · 8 cabeçalho areia com borda · 9 célula com borda
 * 10 moeda com borda · 11 centralizado cinza (linha de corte) · 12 centralizado pequeno · 13 negrito
 */
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="7"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1F3F24"/><name val="Calibri"/></font><font><i/><sz val="11"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF999999"/><name val="Calibri"/></font><font><sz val="8"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3F24"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F1E6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8E1"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB0B7C3"/></left><right style="thin"><color rgb="FFB0B7C3"/></right><top style="thin"><color rgb="FFB0B7C3"/></top><bottom style="thin"><color rgb="FFB0B7C3"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="2"><dxf><font><b/><color rgb="FF065F46"/></font><fill><patternFill><bgColor rgb="FFD1FAE5"/></patternFill></fill></dxf><dxf><font><color rgb="FF92400E"/></font><fill><patternFill><bgColor rgb="FFFEF3C7"/></patternFill></fill></dxf></dxfs></styleSheet>`;

function folha(a: Aba): string {
  const rows = a.linhas.map((l, r) => {
    const cs = l.cels.map((v, c) => {
      const st = Array.isArray(l.estilo) ? (l.estilo[c] ?? 0) : (l.estilo ?? 0);
      const s = st ? ` s="${st}"` : '';
      const ref = `${col(c)}${r + 1}`;
      if (v === null || v === '') return st ? `<c r="${ref}"${s}/>` : '';
      if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
      if (typeof v === 'object') return `<c r="${ref}"${s}><f>${xml(v.f)}</f></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}"${l.altura ? ` ht="${l.altura}" customHeight="1"` : ''}>${cs}</row>`;
  }).join('');
  const cols = `<cols>${a.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const pane = a.congelar
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${a.congelar}" topLeftCell="A${a.congelar + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const filtro = a.filtro ? `<autoFilter ref="${a.filtro}"/>` : '';
  const cf = a.simNao
    ? `<conditionalFormatting sqref="${a.simNao}"><cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"SIM"</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"NÃO"</formula></cfRule></conditionalFormatting>`
      + `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Use SIM ou NÃO" error="Escolha SIM (pago) ou NÃO (pendente)." sqref="${a.simNao}"><formula1>"SIM,NÃO"</formula1></dataValidation></dataValidations>`
    : '';
  const merges = a.merges?.length ? `<mergeCells count="${a.merges.length}">${a.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${pane}${cols}<sheetData>${rows}</sheetData>${filtro}${merges}${cf}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="${a.retrato ? 'portrait' : 'landscape'}" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

async function baixarXlsx(abas: Aba[], nomeArquivo: string) {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip();
  const overrides = abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  const sheets = abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const nomes = abas.map((a, i) => (a.filtro ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(a.nome)}'!${a.filtro.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '')).join('');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets>${nomes ? `<definedNames>${nomes}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  const rels = abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', ESTILOS);
  abas.forEach((a, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, folha(a)));
  const bytes: Uint8Array = zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ------------------------------------------------------------------ */

interface EntradaPlanilha {
  campanha: CampanhaUniforme;
  pedidos: PedidoUniformeDoc[]; // só os do lote
  ordemPeca?: (nome: string) => number;
  /** Fornecedora e recibos só com pedidos que já têm alguma parcela paga. */
  soPagos?: boolean;
}

export async function baixarPlanilhaUniformes({ campanha, pedidos, ordemPeca, soPagos }: EntradaPlanilha) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const todos = pedidos.flatMap(p => p.envios.map(e => ({ p, e }))).sort((a, b) => a.e.criadoEm.localeCompare(b.e.criadoEm));
  const entra = (e: EnvioUniforme) => !e.cancelado && (!soPagos || parcelasDe(e).pagas > 0);

  /* ---------- Aba 1: Pedidos ---------- */
  const cab1 = ['Pedido', 'Data', 'Responsável', 'Telefone', 'Criança', 'Turma 2027', 'Peça', 'Cor', 'Tamanho', 'Qtd', 'Valor unitário', 'Subtotal', 'Total do pedido', 'Pagamento', 'Parcelas pagas', 'Valor pago', 'Situação', 'Origem', 'Observação'];
  const est1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 0, 0, 0];
  const L1: Linha[] = [
    { cels: [`Pedidos de uniformes · ${campanha.nome} · Sítio-Escola Geranium · emitida em ${hoje}`], estilo: 5 },
    { cels: cab1, estilo: 1 },
  ];
  for (const { e } of todos) {
    const { n, pagas } = parcelasDe(e);
    e.itens.forEach((i, k) => {
      const ultimo = k === e.itens.length - 1;
      L1.push({
        cels: [e.codigo, dataHoraBR(e.criadoEm), e.responsavel, e.telefone, i.crianca, i.turma, i.peca, i.cor, i.tamanho, i.qtd, i.preco, i.preco * i.qtd,
          ultimo ? e.total : '', ultimo ? formaPagamento(e) : '', ultimo ? `${pagas} de ${n}` : '', ultimo ? valorPago(e) : '',
          ROTULO_SITUACAO[situacaoDoEnvio(e)].rot, e.origem === 'equipe' ? 'Equipe' : 'Link', ultimo ? (e.obs || '') : ''],
        estilo: est1,
      });
    });
  }
  const fim1 = L1.length;
  if (fim1 > 2) {
    L1.push({
      cels: ['Total (sem cancelados)', '', '', '', '', '', '', '', '', { f: `SUMIF(Q3:Q${fim1},"<>Cancelado",J3:J${fim1})` }, '', '', { f: `SUMIF(Q3:Q${fim1},"<>Cancelado",M3:M${fim1})` }, '', '', { f: `SUMIF(Q3:Q${fim1},"<>Cancelado",P3:P${fim1})` }, '', '', ''],
      estilo: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 4, 3, 3, 3],
    });
  }
  const aba1: Aba = { nome: 'Pedidos', linhas: L1, larguras: [10, 16, 30, 16, 30, 20, 22, 22, 9, 6, 13, 12, 15, 13, 13, 13, 20, 9, 30], congelar: 2, filtro: `A2:S${Math.max(fim1, 2)}` };

  /* ---------- Aba 2: Fornecedora ---------- */
  const lista = listaFornecedor(todos.map(x => x.e).filter(entra), ordemPeca);
  const L2: Linha[] = [
    { cels: [`Pedido para a fornecedora · ${campanha.nome}${soPagos ? ' · só pedidos pagos' : ''} · ${hoje}`], estilo: 5 },
    { cels: ['Peça', 'Cor', 'Tamanho', 'Quantidade'], estilo: 1 },
    ...lista.map(l => ({ cels: [l.peca, l.cor, l.tamanho, l.qtd] as Cel[], estilo: 9 })),
  ];
  if (lista.length) L2.push({ cels: ['Total de peças', '', '', { f: `SUM(D3:D${lista.length + 2})` }], estilo: 3 });
  // Resumo por peça, ao lado
  const porPeca = new Map<string, number>();
  for (const l of lista) porPeca.set(l.peca, (porPeca.get(l.peca) || 0) + l.qtd);
  L2[1].cels.push('', 'Peça', 'Total');
  L2[1].estilo = [1, 1, 1, 1, 0, 1, 1];
  [...porPeca].forEach(([peca, q], i) => {
    const linha = L2[i + 2] || (L2[i + 2] = { cels: ['', '', '', ''] });
    while (linha.cels.length < 4) linha.cels.push('');
    linha.cels.push('', peca, q);
    const base = Array.isArray(linha.estilo) ? linha.estilo : Array(4).fill(linha.estilo ?? 0);
    linha.estilo = [...base.slice(0, 4), 0, 9, 9];
  });
  const aba2: Aba = { nome: 'Fornecedora', linhas: L2, larguras: [28, 26, 10, 12, 3, 28, 10], congelar: 2 };

  /* ---------- Aba 3: Recibos (um por família) ---------- */
  const familias = new Map<string, EnvioUniforme[]>();
  for (const { p, e } of todos) {
    if (!entra(e)) continue;
    if (!familias.has(p.id)) familias.set(p.id, []);
    familias.get(p.id)!.push(e);
  }
  const ordenadas = [...familias.values()].sort((a, b) => a[a.length - 1].responsavel.localeCompare(b[b.length - 1].responsavel, 'pt-BR'));
  const L3: Linha[] = [];
  const merges: string[] = [];
  const linhaMesclada = (texto: string, estilo: number, altura?: number) => {
    const r = L3.length + 1;
    L3.push({ cels: [texto, '', '', '', '', ''], estilo: [estilo, estilo, estilo, estilo, estilo, estilo], altura });
    merges.push(`A${r}:F${r}`);
  };
  for (const envios of ordenadas) {
    const ult = envios[envios.length - 1];
    const itens = envios.flatMap(e => e.itens);
    const total = envios.reduce((s, e) => s + e.total, 0);
    const criancas = [...new Set(itens.map(i => i.crianca))].join(', ');
    linhaMesclada('RECIBO DE ENTREGA DE UNIFORMES · SÍTIO-ESCOLA GERANIUM', 6, 20);
    linhaMesclada(`${campanha.nome} · Pedido${envios.length > 1 ? 's' : ''} ${envios.map(e => e.codigo).join(', ')}`, 12);
    L3.push({ cels: [`Responsável: ${ult.responsavel}`, '', '', `Telefone: ${ult.telefone}`, '', ''] });
    merges.push(`A${L3.length}:C${L3.length}`, `D${L3.length}:F${L3.length}`);
    linhaMesclada(`Aluno(a): ${criancas}`, 0);
    L3.push({ cels: ['Criança', 'Peça', 'Cor', 'Tam.', 'Qtd', 'Valor'], estilo: 8 });
    for (const i of itens) L3.push({ cels: [i.crianca, i.peca, i.cor, i.tamanho, i.qtd, i.preco * i.qtd], estilo: [9, 9, 9, 9, 9, 10] });
    L3.push({ cels: ['', '', '', '', 'TOTAL', total], estilo: [0, 0, 0, 0, 13, 4] });
    const pag = envios.map(e => (envios.length > 1 ? `${e.codigo}: ` : '') + textoPagamento(e)).join(' · ');
    L3.push({ cels: [`Pagamento: ${pag}`, '', '', '', '', ''], estilo: 7 });
    merges.push(`A${L3.length}:F${L3.length}`);
    L3.push({ cels: [''] }, { cels: [''] });
    L3.push({ cels: ['Recebido em ____/____/________', '', '', '______________________________________', '', ''] });
    merges.push(`A${L3.length}:C${L3.length}`, `D${L3.length}:F${L3.length}`);
    L3.push({ cels: ['', '', '', 'Assinatura do responsável', '', ''], estilo: [0, 0, 0, 12, 12, 12] });
    merges.push(`D${L3.length}:F${L3.length}`);
    L3.push({ cels: [''] });
    linhaMesclada('- - - - - - - - - - ✂ - - - - - - - - - - ✂ - - - - - - - - - -', 11);
    L3.push({ cels: [''] });
  }
  if (L3.length === 0) L3.push({ cels: ['Nenhum recibo para este lote.'] });
  const aba3: Aba = { nome: 'Recibos', linhas: L3, larguras: [30, 24, 30, 7, 6, 14], merges, retrato: true };

  /* ---------- Aba 4: Pagamentos (uma linha por parcela) ---------- */
  const cab4 = ['Pedido', 'Responsável', 'Telefone', 'Criança(s)', 'Pagamento', 'Parcela nº', 'De', 'Valor', 'Pago?', 'Data do pagamento', 'Observação'];
  const L4: Linha[] = [
    { cels: [`Pagamentos · ${campanha.nome} · marque SIM nas parcelas pagas e use "Atualizar pagamentos" no sistema`], estilo: 5 },
    { cels: cab4, estilo: 1 },
  ];
  for (const { e } of todos) {
    if (e.cancelado) continue;
    const { n, pagas } = parcelasDe(e);
    const criancas = [...new Set(e.itens.map(i => i.crianca))].join(', ');
    valoresParcelas(e.total, n).forEach((v, k) => {
      L4.push({
        cels: [e.codigo, e.responsavel, e.telefone, criancas, formaPagamento(e), k + 1, n, v, k < pagas ? 'SIM' : 'NÃO', '', ''],
        estilo: [9, 9, 9, 9, 9, 9, 9, 10, 9, 9, 9],
      });
    });
  }
  const fim4 = L4.length;
  if (fim4 > 2) {
    L4.push({ cels: ['', '', '', '', '', '', 'Recebido', { f: `SUMIF(I3:I${fim4},"SIM",H3:H${fim4})` }], estilo: [0, 0, 0, 0, 0, 0, 13, 4] });
    L4.push({ cels: ['', '', '', '', '', '', 'A receber', { f: `SUMIF(I3:I${fim4},"<>SIM",H3:H${fim4})` }], estilo: [0, 0, 0, 0, 0, 0, 13, 4] });
  }
  const aba4: Aba = {
    nome: 'Pagamentos', linhas: L4, larguras: [10, 30, 16, 34, 13, 10, 5, 12, 8, 16, 30], congelar: 2,
    filtro: `A2:K${Math.max(fim4, 2)}`, simNao: `I3:I${Math.max(fim4, 3)}`,
  };

  await baixarXlsx([aba1, aba2, aba3, aba4], `Uniformes_${slug(campanha.nome) || 'pedido'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


/* ------------------------------------------------------------------ */
/* Leitura da aba "Pagamentos" (para o botão "Atualizar pagamentos")   */
/* ------------------------------------------------------------------ */

export interface LinhaPagamentoLida { codigo: string; parcela: number; de: number; pago: boolean; linha: number }

const normTxt = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ehSim = (v: string) => ['sim', 's', 'x', 'pago', 'paga', 'ok', 'true', 'verdadeiro', '1', 'yes', 'y'].includes(normTxt(v)) || v.includes('✓') || v.includes('✔');

/**
 * Lê a aba "Pagamentos" de um .xlsx (salvo no Excel, no LibreOffice ou baixado do Google Planilhas).
 * Acha as colunas pelo nome do cabeçalho (Pedido, Parcela nº, Pago?), então não importa se a ordem mudou.
 */
export async function lerPagamentosDaPlanilha(arquivo: File): Promise<LinhaPagamentoLida[]> {
  const { default: PizZip } = await import('pizzip');
  let zip: InstanceType<typeof PizZip>;
  try { zip = new PizZip(await arquivo.arrayBuffer()); }
  catch { throw new Error('O arquivo não é uma planilha .xlsx. No Google Planilhas use Arquivo → Fazer download → Microsoft Excel (.xlsx).'); }
  const ler = (caminho: string) => zip.file(caminho)?.asText() || '';
  const parse = (txt: string) => new DOMParser().parseFromString(txt, 'application/xml');
  const porTag = (d: Document | Element, tag: string) => Array.from(d.getElementsByTagNameNS('*', tag));

  // 1. Acha a aba "Pagamentos" (ou qualquer uma com "pagamento" no nome).
  const wb = parse(ler('xl/workbook.xml'));
  const abas = porTag(wb, 'sheet');
  const aba = abas.find(s => normTxt(s.getAttribute('name') || '') === 'pagamentos') || abas.find(s => normTxt(s.getAttribute('name') || '').includes('pagamento'));
  if (!aba) throw new Error('Não achei a aba "Pagamentos" nesta planilha. Use a planilha baixada pelo botão "Baixar planilha (.xlsx)".');
  const rid = aba.getAttribute('r:id') || aba.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
  const rels = parse(ler('xl/_rels/workbook.xml.rels'));
  const alvo = porTag(rels, 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target') || '';
  const caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, '')}`;
  const folhaXml = ler(caminho);
  if (!folhaXml) throw new Error('Não consegui abrir a aba "Pagamentos".');

  // 2. Textos compartilhados (o Excel guarda os textos à parte quando salva).
  const compartilhados = porTag(parse(ler('xl/sharedStrings.xml') || '<sst/>'), 'si').map(si => porTag(si, 't').map(t => t.textContent || '').join(''));

  // 3. Lê as células linha a linha.
  const colIdx = (ref: string) => { const l = (ref.match(/^[A-Z]+/) || ['A'])[0]; let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const linhas: { r: number; vals: string[] }[] = [];
  for (const row of porTag(parse(folhaXml), 'row')) {
    const vals: string[] = [];
    for (const c of porTag(row, 'c')) {
      const t = c.getAttribute('t');
      const v = porTag(c, 'v')[0]?.textContent ?? '';
      let txt = v;
      if (t === 's') txt = compartilhados[Number(v)] ?? '';
      else if (t === 'inlineStr') txt = porTag(c, 't').map(x => x.textContent || '').join('');
      else if (t === 'b') txt = v === '1' ? 'TRUE' : 'FALSE';
      vals[colIdx(c.getAttribute('r') || 'A1')] = txt.trim();
    }
    linhas.push({ r: Number(row.getAttribute('r')) || linhas.length + 1, vals });
  }

  // 4. Cabeçalho e colunas.
  const iCab = linhas.findIndex(l => l.vals.some(v => normTxt(v || '') === 'pedido') && l.vals.some(v => normTxt(v || '').startsWith('pago')));
  if (iCab < 0) throw new Error('Não achei o cabeçalho (Pedido … Pago?) na aba "Pagamentos".');
  const cab = linhas[iCab].vals.map(v => normTxt(v || ''));
  const cPed = cab.indexOf('pedido');
  const cPar = cab.findIndex(v => v.startsWith('parcela'));
  const cDe = cab.indexOf('de');
  const cPago = cab.findIndex(v => v.startsWith('pago'));
  if (cPar < 0) throw new Error('Falta a coluna "Parcela nº" na aba "Pagamentos".');

  const out: LinhaPagamentoLida[] = [];
  for (const l of linhas.slice(iCab + 1)) {
    const codigo = (l.vals[cPed] || '').toUpperCase().replace(/\s/g, '');
    if (!/^U-[A-Z0-9]{4,}$/.test(codigo)) continue; // linhas de total e em branco
    const parcela = Math.round(Number((l.vals[cPar] || '').replace(',', '.')));
    if (!(parcela >= 1)) continue;
    out.push({ codigo, parcela, de: Math.round(Number(l.vals[cDe] || 0)) || 0, pago: ehSim(l.vals[cPago] || ''), linha: l.r });
  }
  if (out.length === 0) throw new Error('A aba "Pagamentos" não tem nenhuma linha de pedido.');
  return out;
}
