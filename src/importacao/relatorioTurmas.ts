/**
 * Importação do "Relatório de Turmas" (exportado pelo sistema escolar anterior).
 *
 * Este módulo é PURO: lê o arquivo e monta um PLANO de mudanças. Ele nunca grava nada.
 * Quem grava é a tela de importação, e só o que a pessoa marcar.
 *
 * Regras de proteção:
 *  - só mexe em dados cadastrais (aluno novo e responsáveis);
 *  - nunca altera turma, matrícula, valores, descontos, contraturno, contratos ou Carta de Intenção;
 *  - por padrão só PREENCHE campo vazio; valor diferente fica para a pessoa decidir;
 *  - nada é apagado;
 *  - logins/senhas, uso de imagem, autorização de saída, necessidades especiais e bolsista
 *    NÃO são lidos (no relatório são valores padrão e poderiam apagar respostas reais).
 */
import type { Student, Guardian, EstadoCivil } from '../types';

export type LinhaRelatorio = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Leitura do arquivo                                                  */
/* ------------------------------------------------------------------ */

/** O relatório é um HTML com extensão .xls, em ISO-8859-1. */
export function decodificarArquivo(buf: ArrayBuffer): string {
  return new TextDecoder('iso-8859-1').decode(buf);
}

const limpar = (s: string | null | undefined) =>
  (s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Lê todas as tabelas de dados (uma por turma) e devolve uma linha por aluno-por-turma. */
export function lerRelatorio(html: string): LinhaRelatorio[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const saida: LinhaRelatorio[] = [];
  doc.querySelectorAll('table').forEach(tabela => {
    const cab = tabela.querySelector('thead tr');
    if (!cab) return;
    const nomes = Array.from(cab.children).map(c => limpar(c.textContent));
    if (!nomes.includes('Nome') || !nomes.includes('Turma')) return;
    // colunas repetidas (ex.: "Período") ganham sufixo, como no Excel
    const vistos: Record<string, number> = {};
    const chaves = nomes.map(n => {
      vistos[n] = (vistos[n] ?? 0) + 1;
      return vistos[n] === 1 ? n : `${n}.${vistos[n] - 1}`;
    });
    tabela.querySelectorAll('tbody tr, tr').forEach(tr => {
      if (tr.parentElement?.tagName === 'THEAD') return;
      const cels = Array.from(tr.children);
      if (cels.length !== chaves.length) return;
      const linha: LinhaRelatorio = {};
      cels.forEach((c, i) => { linha[chaves[i]] = limpar(c.textContent); });
      if (linha['Nome']) saida.push(linha);
    });
  });
  return saida;
}

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

export const semAcento = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** dd/mm/aaaa -> aaaa-mm-dd (aaaa-mm-dd passa direto) */
export function dataIso(s: string): string {
  const t = limpar(s);
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

/** Telefone comparável: só dígitos, sem 55 nem 0 na frente. */
export function telefoneChave(s: unknown): string {
  let d = soDigitos(s);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d;
}

const ESTADOS_CIVIS: Record<string, EstadoCivil> = {
  'solteiro(a)': 'Solteiro(a)', solteiro: 'Solteiro(a)', solteira: 'Solteiro(a)',
  'casado(a)': 'Casado(a)', casado: 'Casado(a)', casada: 'Casado(a)',
  'divorciado(a)': 'Divorciado(a)', divorciado: 'Divorciado(a)', divorciada: 'Divorciado(a)',
  'viuvo(a)': 'Viúvo(a)', viuvo: 'Viúvo(a)', viuva: 'Viúvo(a)',
  'uniao estavel': 'União estável', 'uniao estavel.': 'União estável',
};
const estadoCivil = (s: string): EstadoCivil | '' => ESTADOS_CIVIS[semAcento(s)] ?? '';

export const chaveAluno = (nome: string, nascimentoIso: string) => `${semAcento(nome)}|${nascimentoIso}`;

/* ------------------------------------------------------------------ */
/* Pessoas (responsáveis) lidas da planilha                            */
/* ------------------------------------------------------------------ */

export type CampoResp = 'cpf' | 'rg' | 'endereco' | 'dataNascimento' | 'email' | 'telefone' | 'estadoCivil';
export const CAMPOS_RESP: CampoResp[] = ['cpf', 'rg', 'dataNascimento', 'endereco', 'email', 'telefone', 'estadoCivil'];
export const ROTULO_CAMPO: Record<CampoResp, string> = {
  cpf: 'CPF', rg: 'RG', dataNascimento: 'Nascimento', endereco: 'Endereço',
  email: 'E-mail', telefone: 'Telefone', estadoCivil: 'Estado civil',
};

export interface PessoaPlanilha {
  nome: string;
  papeis: Set<'Mae' | 'Pai' | 'Financeiro' | 'Pedagogico'>;
  cpf: string; rg: string; dataNascimento: string; endereco: string;
  email: string; telefone: string; estadoCivil: string;
}

const pessoaVazia = (nome: string): PessoaPlanilha => ({
  nome, papeis: new Set(), cpf: '', rg: '', dataNascimento: '', endereco: '', email: '', telefone: '', estadoCivil: '',
});

function enderecoCompleto(end: string, cep: string): string {
  const e = limpar(end), c = limpar(cep);
  if (!e) return '';
  if (!c || e.replace(/\D/g, '').includes(c.replace(/\D/g, ''))) return e;
  return `${e} - CEP ${c}`;
}

/** Junta mãe, pai e responsável financeiro/pedagógico; a mesma pessoa em dois papéis vira uma só. */
export function pessoasDaLinha(l: LinhaRelatorio): PessoaPlanilha[] {
  const v = (k: string) => limpar(l[k]);
  const tel = (...ks: string[]) => ks.map(v).find(Boolean) ?? '';
  const brutas: { papel: 'Mae' | 'Pai' | 'Financeiro' | 'Pedagogico'; p: PessoaPlanilha }[] = [];

  const montar = (papel: 'Mae' | 'Pai' | 'Financeiro' | 'Pedagogico', d: Partial<Record<CampoResp | 'nome' | 'cep', string>>) => {
    const nome = limpar(d.nome);
    if (!nome) return;
    const p = pessoaVazia(nome);
    p.cpf = soDigitos(d.cpf); p.rg = limpar(d.rg); p.dataNascimento = dataIso(d.dataNascimento ?? '');
    p.endereco = enderecoCompleto(d.endereco ?? '', d.cep ?? '');
    p.email = limpar(d.email); p.telefone = limpar(d.telefone); p.estadoCivil = estadoCivil(d.estadoCivil ?? '');
    brutas.push({ papel, p });
  };

  montar('Mae', {
    nome: v('Nome Mãe'), cpf: v('CPF Mãe'), rg: v('RG Mãe'), dataNascimento: v('Data de nascimento Mãe'),
    endereco: v('Endereço Mãe'), cep: v('CEP Mãe'), email: v('E-mail Mãe'),
    telefone: tel('Telefone celular Mãe', 'Telefone Mãe'), estadoCivil: v('Estado civil Mãe'),
  });
  montar('Pai', {
    nome: v('Nome Pai'), cpf: v('CPF Pai'), rg: v('RG Pai'), dataNascimento: v('Data de nascimento Pai'),
    endereco: v('Endereço Pai'), cep: v('CEP Pai'), email: v('E-mail Pai'),
    telefone: tel('Telefone celular Pai', 'Telefone Pai'), estadoCivil: v('Estado civil Pai'),
  });
  montar('Financeiro', {
    nome: v('Nome Resp. Fin.'), cpf: v('CPF Resp. Fin.'), rg: v('RG Resp. Financeiro'),
    dataNascimento: v('Data de Nascimento - Resp. Fin.'), endereco: v('Endereço Resp. Financeiro'),
    cep: v('CEP Resp. Financeiro'), email: v('E-mail resp. financeiro'),
    telefone: tel('Telefone celular resp. financeiro', 'Telefone Resp. Financeiro'),
  });
  montar('Pedagogico', {
    nome: v('Nome Resp. Pedag.'), cpf: v('CPF Resp. Pedag.'), rg: v('RG Resp. Pedagógico'),
    endereco: v('Endereço Resp. Pedagógico'), cep: v('CEP Resp. Pedagógico'),
    email: v('E-mail resp. pedagógico'), telefone: tel('Telefone celular resp. pedagógico', 'Telefone Resp. Pedagógico'),
  });

  // une quem é a mesma pessoa (mesmo CPF, ou mesmo nome)
  const pessoas: PessoaPlanilha[] = [];
  for (const { papel, p } of brutas) {
    const igual = pessoas.find(q =>
      (p.cpf.length === 11 && q.cpf === p.cpf) || semAcento(q.nome) === semAcento(p.nome));
    if (!igual) { p.papeis.add(papel); pessoas.push(p); continue; }
    igual.papeis.add(papel);
    for (const c of CAMPOS_RESP) if (!igual[c] && p[c]) igual[c] = p[c];
  }
  return pessoas;
}

/* ------------------------------------------------------------------ */
/* Plano                                                               */
/* ------------------------------------------------------------------ */

export interface MudancaCampo {
  campo: CampoResp;
  atual: string;
  novo: string;
  tipo: 'preencher' | 'diferente';
}

export interface ItemResponsavel {
  /** responsável existente no sistema (null = ainda não existe) */
  guardianId: string | null;
  nome: string;
  papel: string; // rótulo para a tela
  mudancas: MudancaCampo[];
  /** valores completos para criar um responsável novo */
  novo?: PessoaPlanilha;
}

export interface ItemAluno {
  chave: string;
  nome: string;
  nascimento: string; // ISO
  turmasPlanilha: string[];
  situacaoPlanilha: string;
  status: 'igual' | 'novo' | 'concluido_ignorado';
  alunoId: string | null;
  statusNoSistema?: Student['status'];
  /** pontos que a pessoa precisa olhar; nunca alteram nada sozinhos */
  alertas: string[];
  responsaveis: ItemResponsavel[];
  /** dados da planilha para cadastrar aluno novo */
  dataEntrada: string;
  pessoas: PessoaPlanilha[];
}

export interface ResumoPlano {
  alunosNaPlanilha: number;
  jaNoSistema: number;
  novos: number;
  concluidosIgnorados: number;
  foraDaPlanilha: number;
  camposAPreencher: number;
  camposDiferentes: number;
  responsaveisNovos: number;
  comAlertas: number;
}

export interface Plano {
  itens: ItemAluno[];
  resumo: ResumoPlano;
  foraDaPlanilha: { id: string; nome: string; status: Student['status'] }[];
}

const TURMAS_CONTRATURNO = new Set(['melaco', 'marmelada']);
const TURMA_PLANILHA_PARA_ID: Record<string, string> = {
  'mirim i': 'mirim_1', 'mirim ii': 'mirim_2',
  'mandacaia i': 'mandacaia_1', 'mandacaia ii': 'mandacaia_2',
  'abelha branca': 'abelha_branca', jatai: 'jatai', urucu: 'urucu', irai: 'irai', benjoi: 'benjoi',
};
const idCurto = (id?: string) => (id ?? '').replace(/^\d{4}_/, '');

export interface ContextoSistema {
  students: Student[];
  guardians: Guardian[];
  enrollments: { alunoId: string; ano: number; turmaRegularId: string }[];
  anoLetivo?: number;
}

/** Valor atual do campo no sistema, já como texto comparável. */
const valorAtual = (g: Guardian, c: CampoResp): string => {
  if (c === 'telefone') return limpar(g.telefone || g.contato);
  return limpar((g as unknown as Record<string, string | undefined>)[c]);
};

function mesmoValor(c: CampoResp, a: string, b: string): boolean {
  switch (c) {
    case 'cpf': return soDigitos(a) === soDigitos(b);
    case 'rg': return soDigitos(a) && soDigitos(b) ? soDigitos(a) === soDigitos(b) : semAcento(a) === semAcento(b);
    case 'telefone': return telefoneChave(a) === telefoneChave(b);
    case 'email': return a.toLowerCase() === b.toLowerCase();
    case 'endereco': return semAcento(a).replace(/[^a-z0-9]/g, '') === semAcento(b).replace(/[^a-z0-9]/g, '');
    default: return semAcento(a) === semAcento(b);
  }
}

function casarResponsavel(p: PessoaPlanilha, doAluno: Guardian[], usados: Set<string>): Guardian | undefined {
  const livres = doAluno.filter(g => !usados.has(g.id));
  if (p.cpf.length === 11) {
    const porCpf = livres.find(g => soDigitos(g.cpf) === p.cpf);
    if (porCpf) return porCpf;
  }
  return livres.find(g => semAcento(g.nome) === semAcento(p.nome));
}

export function montarPlano(linhas: LinhaRelatorio[], ctx: ContextoSistema): Plano {
  const ano = ctx.anoLetivo ?? 2026;
  const porChave = new Map<string, Student>();
  ctx.students.forEach(s => porChave.set(chaveAluno(s.nome, dataIso(s.nascimento)), s));
  const guardiansDe = new Map<string, Guardian[]>();
  ctx.guardians.forEach(g => guardiansDe.set(g.alunoId, [...(guardiansDe.get(g.alunoId) ?? []), g]));
  const matricula = new Map<string, string>();
  ctx.enrollments.filter(e => e.ano === ano).forEach(e => matricula.set(e.alunoId, e.turmaRegularId));

  // agrupa as linhas por aluno (regular + contraturno viram um só)
  const grupos = new Map<string, LinhaRelatorio[]>();
  for (const l of linhas) {
    const k = chaveAluno(l['Nome'], dataIso(l['Data de nascimento']));
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }

  const itens: ItemAluno[] = [];
  for (const [chave, ls] of grupos) {
    const base = ls.find(l => !TURMAS_CONTRATURNO.has(semAcento(l['Turma']))) ?? ls[0];
    const turmas = ls.map(l => l['Turma']);
    const regular = ls.find(l => !TURMAS_CONTRATURNO.has(semAcento(l['Turma'])));
    const aluno = porChave.get(chave) ?? null;
    const concluido = ls.every(l => semAcento(l['Situação da Matrícula']) !== 'ativa');
    const pessoas = ls.flatMap(pessoasDaLinha).reduce<PessoaPlanilha[]>((acc, p) => {
      const igual = acc.find(q => (p.cpf.length === 11 && q.cpf === p.cpf) || semAcento(q.nome) === semAcento(p.nome));
      if (!igual) acc.push(p);
      else {
        p.papeis.forEach(x => igual.papeis.add(x));
        for (const c of CAMPOS_RESP) if (!igual[c] && p[c]) igual[c] = p[c];
      }
      return acc;
    }, []);

    const item: ItemAluno = {
      chave, nome: base['Nome'], nascimento: dataIso(base['Data de nascimento']),
      turmasPlanilha: turmas, situacaoPlanilha: base['Situação da Matrícula'],
      status: aluno ? 'igual' : concluido ? 'concluido_ignorado' : 'novo',
      alunoId: aluno?.id ?? null, statusNoSistema: aluno?.status,
      alertas: [], responsaveis: [], dataEntrada: dataIso(base['Data da Matrícula']), pessoas,
    };

    if (aluno) {
      const turmaSis = idCurto(matricula.get(aluno.id));
      if (regular) {
        const esperado = TURMA_PLANILHA_PARA_ID[semAcento(regular['Turma'])];
        if (turmaSis === 'sem_regular') item.alertas.push(`Na planilha está no regular (${regular['Turma']}), mas no sistema consta "Somente Contraturno".`);
        else if (turmaSis && esperado && turmaSis !== esperado) item.alertas.push(`Turma diferente: planilha ${regular['Turma']}, sistema ${turmaSis.replace(/_/g, ' ')}. A importação não altera turma.`);
      } else if (turmaSis && turmaSis !== 'sem_regular') {
        item.alertas.push(`Na planilha só aparece no contraturno, mas no sistema tem turma regular (${turmaSis.replace(/_/g, ' ')}).`);
      }
      if (aluno.status !== 'ativo') item.alertas.push(`No sistema está "${aluno.status}" e na planilha está ativo. Nada é reativado automaticamente.`);

      const doAluno = guardiansDe.get(aluno.id) ?? [];
      const usados = new Set<string>();
      for (const p of pessoas) {
        const g = casarResponsavel(p, doAluno, usados);
        const papel = [...p.papeis].map(x => ({ Mae: 'Mãe', Pai: 'Pai', Financeiro: 'Resp. financeiro', Pedagogico: 'Resp. pedagógico' }[x])).join(' + ');
        if (g) {
          usados.add(g.id);
          const mudancas: MudancaCampo[] = [];
          for (const c of CAMPOS_RESP) {
            const novo = p[c];
            if (!novo) continue;
            const atual = valorAtual(g, c);
            if (!atual) mudancas.push({ campo: c, atual: '', novo, tipo: 'preencher' });
            else if (!mesmoValor(c, atual, novo)) mudancas.push({ campo: c, atual, novo, tipo: 'diferente' });
          }
          item.responsaveis.push({ guardianId: g.id, nome: g.nome, papel, mudancas });
        } else {
          item.responsaveis.push({ guardianId: null, nome: p.nome, papel, mudancas: [], novo: p });
        }
      }
    }
    itens.push(item);
  }

  const noPlano = new Set(itens.map(i => i.alunoId).filter(Boolean));
  const foraDaPlanilha = ctx.students
    .filter(s => !noPlano.has(s.id))
    .map(s => ({ id: s.id, nome: s.nome, status: s.status }));

  const todos = itens.flatMap(i => i.responsaveis.flatMap(r => r.mudancas));
  const resumo: ResumoPlano = {
    alunosNaPlanilha: itens.length,
    jaNoSistema: itens.filter(i => i.status === 'igual').length,
    novos: itens.filter(i => i.status === 'novo').length,
    concluidosIgnorados: itens.filter(i => i.status === 'concluido_ignorado').length,
    foraDaPlanilha: foraDaPlanilha.length,
    camposAPreencher: todos.filter(m => m.tipo === 'preencher').length,
    camposDiferentes: todos.filter(m => m.tipo === 'diferente').length,
    responsaveisNovos: itens.filter(i => i.status === 'igual').flatMap(i => i.responsaveis).filter(r => r.guardianId === null).length,
    comAlertas: itens.filter(i => i.alertas.length > 0).length,
  };
  return { itens, resumo, foraDaPlanilha };
}

/* ------------------------------------------------------------------ */
/* Aplicação (devolve só o que gravar; quem grava é a tela)            */
/* ------------------------------------------------------------------ */

export interface Escolhas {
  /** "alunoChave|guardianId|campo" marcados para aplicar */
  campos: Set<string>;
  /** guardianId nulo: "alunoChave|nomeNormalizado" de responsáveis a criar */
  responsaveisNovos: Set<string>;
  /** alunos novos a cadastrar (chave) */
  alunosNovos: Set<string>;
}

export const chaveCampo = (it: ItemAluno, r: ItemResponsavel, c: CampoResp) =>
  `${it.chave}|${r.guardianId ?? semAcento(r.nome)}|${c}`;
export const chaveRespNovo = (it: ItemAluno, r: ItemResponsavel) => `${it.chave}|${semAcento(r.nome)}`;

/** Marcação padrão: só os campos vazios; diferenças, responsáveis novos e alunos novos ficam desmarcados. */
export function escolhasPadrao(plano: Plano): Escolhas {
  const campos = new Set<string>();
  for (const it of plano.itens)
    for (const r of it.responsaveis)
      for (const m of r.mudancas) if (m.tipo === 'preencher') campos.add(chaveCampo(it, r, m.campo));
  return { campos, responsaveisNovos: new Set(), alunosNovos: new Set() };
}

const valorParaGravar = (c: CampoResp, v: string) => (c === 'cpf' ? soDigitos(v) : v);

export interface GravacaoPlanejada {
  guardiansAtualizados: Guardian[];
  guardiansCriados: Guardian[];
  studentsCriados: Student[];
  /** lista legível, para o registro/relatório final */
  resumoLinhas: string[];
}

export function resolverGravacao(plano: Plano, ctx: ContextoSistema, esc: Escolhas, agora = Date.now()): GravacaoPlanejada {
  const porId = new Map(ctx.guardians.map(g => [g.id, g]));
  const alterados = new Map<string, Guardian>();
  const criados: Guardian[] = [];
  const alunosCriados: Student[] = [];
  const linhas: string[] = [];
  let seq = 0;
  const novoId = (p: string) => `${p}_imp_${agora}_${seq++}`;

  for (const it of plano.itens) {
    if (it.status === 'igual') {
      for (const r of it.responsaveis) {
        if (r.guardianId) {
          const g0 = alterados.get(r.guardianId) ?? porId.get(r.guardianId);
          if (!g0) continue;
          const g = { ...g0 };
          let mexeu = false;
          for (const m of r.mudancas) {
            if (!esc.campos.has(chaveCampo(it, r, m.campo))) continue;
            const alvo = m.campo === 'telefone' ? 'telefone' : m.campo;
            (g as unknown as Record<string, string>)[alvo] = valorParaGravar(m.campo, m.novo);
            if (m.campo === 'telefone') g.contato = g.contato || valorParaGravar(m.campo, m.novo);
            mexeu = true;
            linhas.push(`${it.nome} · ${r.nome} · ${ROTULO_CAMPO[m.campo]}: ${m.tipo === 'preencher' ? 'preenchido' : 'substituído'}`);
          }
          // as regras do Firestore exigem 'telefone'; cadastros antigos só têm 'contato'
          if (mexeu) { g.telefone = g.telefone ?? g.contato ?? ''; alterados.set(g.id, g); }
        } else if (r.novo && esc.responsaveisNovos.has(chaveRespNovo(it, r))) {
          criados.push(paraGuardian(r.novo, it.alunoId!, novoId('g'), false, r.papel));
          linhas.push(`${it.nome} · ${r.nome}: responsável cadastrado`);
        }
      }
    } else if (it.status === 'novo' && esc.alunosNovos.has(it.chave)) {
      const id = novoId('s');
      alunosCriados.push({
        id, nome: it.nome, nascimento: it.nascimento,
        dataEntrada: it.dataEntrada || it.nascimento, observacoes: '', status: 'ativo', origemCadastro: 'staff',
      } as Student);
      // o responsável financeiro do aluno novo: quem consta como financeiro na planilha
      const fin = it.pessoas.find(p => p.papeis.has('Financeiro')) ?? it.pessoas[0];
      it.pessoas.forEach(p => criados.push(
        paraGuardian(p, id, novoId('g'), p === fin, [...p.papeis].join('+'))));
      linhas.push(`${it.nome}: aluno novo cadastrado (sem matrícula; a turma é definida depois no sistema)`);
    }
  }
  return { guardiansAtualizados: [...alterados.values()], guardiansCriados: criados, studentsCriados: alunosCriados, resumoLinhas: linhas };
}

function paraGuardian(p: PessoaPlanilha, alunoId: string, id: string, financeiro: boolean, papelRotulo: string): Guardian {
  const parentesco = p.papeis.has('Mae') ? 'Mãe' : p.papeis.has('Pai') ? 'Pai' : 'Outro: responsável';
  void papelRotulo;
  const g: Guardian = {
    id, alunoId, nome: p.nome, parentesco, telefone: p.telefone, contato: p.telefone, financeiro,
  };
  if (p.cpf) g.cpf = valorParaGravar('cpf', p.cpf);
  if (p.rg) g.rg = p.rg;
  if (p.endereco) g.endereco = p.endereco;
  if (p.dataNascimento) g.dataNascimento = p.dataNascimento;
  if (p.email) g.email = p.email;
  if (p.estadoCivil) g.estadoCivil = p.estadoCivil as EstadoCivil;
  return g;
}
