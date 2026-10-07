import React, { useMemo, useRef, useState } from 'react';
import { Student, Guardian, Enrollment } from '../types';
import { saveDocument } from '../firebase';
import {
  decodificarArquivo, lerRelatorio, montarPlano, escolhasPadrao, resolverGravacao,
  chaveCampo, chaveRespNovo, ROTULO_CAMPO, Plano, Escolhas, ItemAluno,
} from '../importacao/relatorioTurmas';
import { Upload, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

type ShowToast = (title: string, description?: string, type?: 'success' | 'error' | 'info', duration?: number) => void;

interface Props {
  students: Student[];
  guardians: Guardian[];
  enrollments: Enrollment[];
  showToast: ShowToast;
  /** baixa o backup JSON atual (o mesmo botão de backup do sistema) */
  onExportBackup: () => void;
  /** devolve ao App o que foi gravado, para a tela atualizar sem recarregar */
  onApplied: (r: { guardiansAtualizados: Guardian[]; guardiansCriados: Guardian[]; studentsCriados: Student[] }) => void;
}

const dataBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');

export default function ImportarTab({ students, guardians, enrollments, showToast, onExportBackup, onApplied }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [plano, setPlano] = useState<Plano | null>(null);
  const [esc, setEsc] = useState<Escolhas | null>(null);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const [aplicando, setAplicando] = useState(false);
  const [concluido, setConcluido] = useState<string[] | null>(null);

  const ctx = useMemo(() => ({ students, guardians, enrollments }), [students, guardians, enrollments]);

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const linhas = lerRelatorio(decodificarArquivo(await f.arrayBuffer()));
      if (linhas.length === 0) {
        showToast('Arquivo não reconhecido', 'Não encontrei alunos. Use o "Relatório de Turmas" exportado do sistema anterior.', 'error', 7000);
        return;
      }
      const p = montarPlano(linhas, ctx);
      setPlano(p); setEsc(escolhasPadrao(p)); setNomeArquivo(f.name); setConcluido(null); setAberto({});
    } catch (err) {
      console.error(err);
      showToast('Erro ao ler o arquivo', 'O arquivo não pôde ser lido.', 'error', 6000);
    }
  };

  const alterna = (conj: 'campos' | 'responsaveisNovos' | 'alunosNovos', chave: string) =>
    setEsc(prev => {
      if (!prev) return prev;
      const novo = new Set(prev[conj]);
      novo.has(chave) ? novo.delete(chave) : novo.add(chave);
      return { ...prev, [conj]: novo };
    });

  const totalMarcado = esc ? esc.campos.size + esc.responsaveisNovos.size + esc.alunosNovos.size : 0;

  const aplicar = async () => {
    if (!plano || !esc || totalMarcado === 0) return;
    if (!confirm(`Aplicar ${totalMarcado} mudança(s) nos cadastros?\n\nUm backup será baixado primeiro. Turmas, matrículas, valores e contratos não são alterados.`)) return;
    setAplicando(true);
    try {
      onExportBackup(); // 1) backup antes de qualquer gravação
      const g = resolverGravacao(plano, ctx, esc);
      for (const s of g.studentsCriados) await saveDocument('students', s);
      for (const x of g.guardiansCriados) await saveDocument('guardians', x);
      for (const x of g.guardiansAtualizados) await saveDocument('guardians', x);
      onApplied(g);
      setConcluido(g.resumoLinhas);
      setPlano(null); setEsc(null);
      showToast('Importação concluída', `${g.guardiansAtualizados.length} responsável(is) atualizado(s), ${g.guardiansCriados.length} criado(s), ${g.studentsCriados.length} aluno(s) novo(s).`, 'success', 7000);
    } catch (err) {
      console.error(err);
      showToast('A importação parou no meio', 'Nada foi apagado. O backup baixado permite restaurar. Confira os cadastros e tente de novo.', 'error', 9000);
    } finally {
      setAplicando(false);
    }
  };

  const R = plano?.resumo;
  const Card = ({ n, rotulo, destaque }: { n: number; rotulo: string; destaque?: boolean }) => (
    <div className={`rounded-lg border px-3 py-2 bg-white ${destaque ? 'border-brand-orange' : 'border-slate-200'}`}>
      <div className="text-xl font-bold text-slate-800">{n}</div>
      <div className="text-[11px] text-slate-500 leading-tight">{rotulo}</div>
    </div>
  );

  const linhaAluno = (it: ItemAluno) => {
    const campos = it.responsaveis.flatMap(r => r.mudancas.map(m => ({ r, m })));
    const novosResp = it.responsaveis.filter(r => !r.guardianId);
    const abre = aberto[it.chave];
    const marcados = campos.filter(({ r, m }) => esc!.campos.has(chaveCampo(it, r, m.campo))).length;
    return (
      <div key={it.chave} className="border border-slate-200 rounded-lg bg-white">
        <button onClick={() => setAberto(a => ({ ...a, [it.chave]: !abre }))} className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer">
          {abre ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold text-slate-800 flex-1">{it.nome}</span>
          <span className="text-[11px] text-slate-500">{it.turmasPlanilha.join(' + ')}</span>
          <span className="text-[11px] font-bold text-slate-600">{marcados}/{campos.length} campos</span>
          {it.alertas.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        </button>
        {abre && (
          <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
            {it.alertas.map((a, i) => (
              <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">{a}</p>
            ))}
            {it.responsaveis.filter(r => r.guardianId && r.mudancas.length > 0).map(r => (
              <div key={r.guardianId!} className="pt-2">
                <div className="text-xs font-bold text-slate-700">{r.nome} <span className="font-normal text-slate-400">· {r.papel}</span></div>
                {r.mudancas.map(m => {
                  const k = chaveCampo(it, r, m.campo);
                  return (
                    <label key={k} className="flex items-start gap-2 text-xs py-0.5 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={esc!.campos.has(k)} onChange={() => alterna('campos', k)} />
                      <span className="w-24 shrink-0 text-slate-500">{ROTULO_CAMPO[m.campo]}</span>
                      {m.tipo === 'preencher'
                        ? <span className="text-emerald-700 break-all">+ {m.campo === 'dataNascimento' ? dataBR(m.novo) : m.novo}</span>
                        : <span className="break-all"><span className="text-slate-400 line-through">{m.campo === 'dataNascimento' ? dataBR(m.atual) : m.atual}</span> <span className="text-amber-700">→ {m.campo === 'dataNascimento' ? dataBR(m.novo) : m.novo}</span></span>}
                    </label>
                  );
                })}
              </div>
            ))}
            {novosResp.map(r => (
              <label key={r.nome} className="flex items-start gap-2 text-xs pt-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={esc!.responsaveisNovos.has(chaveRespNovo(it, r))} onChange={() => alterna('responsaveisNovos', chaveRespNovo(it, r))} />
                <span><b>{r.nome}</b> ({r.papel}) não está cadastrado(a) neste aluno. Cadastrar como novo responsável (não financeiro)</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const comMudanca = plano?.itens.filter(i => i.status === 'igual' && (i.responsaveis.some(r => r.mudancas.length > 0 || !r.guardianId) || i.alertas.length > 0)) ?? [];
  const novos = plano?.itens.filter(i => i.status === 'novo') ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Importar Relatório de Turmas</h2>
        <p className="text-xs text-slate-500">Escolha o arquivo e veja a prévia. Nada é gravado até você marcar o que quer e confirmar.</p>
      </div>

      <div className="flex items-start gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Só cadastros (alunos novos e responsáveis). Turmas, matrículas, valores, descontos, contraturno, contratos e Cartas <b>nunca</b> são alterados.
          Por padrão só campos <b>vazios</b> são preenchidos; valores diferentes ficam desmarcados. Nada é apagado. Logins e senhas do arquivo são ignorados.
        </div>
      </div>

      <div>
        <input ref={inputRef} type="file" accept=".xls,.html,.htm" className="hidden" onChange={aoEscolherArquivo} />
        <button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:border-slate-500 cursor-pointer">
          <Upload className="w-4 h-4" /> {plano ? 'Escolher outro arquivo' : 'Escolher o arquivo .xls'}
        </button>
        {nomeArquivo && plano && <span className="ml-3 text-xs text-slate-500">{nomeArquivo}</span>}
      </div>

      {concluido && (
        <div className="bg-white border border-emerald-200 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Importação concluída</div>
          <p className="text-xs text-slate-500">{concluido.length} mudança(s) registradas. O backup de antes da importação foi baixado.</p>
        </div>
      )}

      {plano && R && esc && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card n={R.alunosNaPlanilha} rotulo="alunos na planilha" />
            <Card n={R.jaNoSistema} rotulo="já estão no sistema" />
            <Card n={R.novos} rotulo="não encontrados (novos)" destaque={R.novos > 0} />
            <Card n={R.concluidosIgnorados} rotulo="concluído(s), ignorado(s)" />
            <Card n={R.camposAPreencher} rotulo="campos vazios a preencher" />
            <Card n={R.camposDiferentes} rotulo="valores diferentes (você decide)" destaque={R.camposDiferentes > 0} />
            <Card n={R.comAlertas} rotulo="alunos com alerta" destaque={R.comAlertas > 0} />
            <Card n={R.foraDaPlanilha} rotulo="no sistema e fora da planilha" />
          </div>

          <div className="flex gap-2 text-xs">
            <button className="px-2 py-1 rounded border border-slate-200 bg-white cursor-pointer" onClick={() => setEsc(escolhasPadrao(plano))}>Marcação padrão (só vazios)</button>
            <button className="px-2 py-1 rounded border border-slate-200 bg-white cursor-pointer" onClick={() => setEsc(p => p && ({ ...p, campos: new Set() }))}>Desmarcar campos</button>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-700">Alunos já cadastrados ({comMudanca.length} com algo a ver)</h3>
            {comMudanca.map(linhaAluno)}
          </section>

          {novos.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-700">Alunos não encontrados no sistema</h3>
              <p className="text-xs text-slate-500">Se for um aluno que já existe com outra grafia do nome ou outra data, não marque: corrija no cadastro e rode de novo. Aluno novo entra sem matrícula; a turma é definida depois no sistema.</p>
              {novos.map(it => (
                <label key={it.chave} className="flex items-start gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={esc.alunosNovos.has(it.chave)} onChange={() => alterna('alunosNovos', it.chave)} />
                  <span><b>{it.nome}</b> · nasc. {dataBR(it.nascimento)} · {it.turmasPlanilha.join(' + ')} · {it.pessoas.length} responsável(is)</span>
                </label>
              ))}
            </section>
          )}

          {plano.foraDaPlanilha.length > 0 && (
            <section className="space-y-1">
              <h3 className="text-sm font-bold text-slate-700">No sistema e fora da planilha (não mudam)</h3>
              <p className="text-xs text-slate-500">{plano.foraDaPlanilha.map(a => `${a.nome} (${a.status})`).join(' · ')}</p>
            </section>
          )}

          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-end gap-3 z-20">
            <span className="text-xs text-slate-500">{totalMarcado} mudança(s) marcada(s)</span>
            <button disabled={aplicando || totalMarcado === 0} onClick={aplicar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-brand-orange text-white disabled:opacity-40 cursor-pointer">
              {aplicando && <Loader2 className="w-4 h-4 animate-spin" />} Baixar backup e aplicar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
