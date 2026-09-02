import React, { useState } from 'react';
import { Student, Guardian, Enrollment, RegularClass, EstadoCivil } from '../types';
import { calculateAgeAtCutoff, getRegularClassForAgeDynamic } from '../data';
import { Sprout, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface FichaDadosGeraisFormProps {
  classPrices: RegularClass[];
  activeYear: number;
  existingStudent?: Student;
  existingGuardians?: Guardian[];
  onSubmit?: (
    student: Omit<Student, 'id'>,
    guardiansList: Omit<Guardian, 'id' | 'alunoId'>[],
    enrollmentAno: number
  ) => Promise<void>;
  onUpdate?: (
    studentId: string,
    updatedFields: Partial<Omit<Student, 'id'>>,
    guardiansList: Omit<Guardian, 'id' | 'alunoId'>[]
  ) => Promise<void>;
}

interface TempGuardian {
  nome: string;
  parentesco: string;
  parentescoOutro: string;
  telefone: string;
  email: string;
  cpf: string;
  rg: string;
  endereco: string;
  dataNascimento: string;
  estadoCivil: EstadoCivil | '';
  financeiro: boolean;
}

const PARENTESCO_OPCOES = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio', 'Tia', 'Outro'];

const novoResponsavel = (financeiro: boolean): TempGuardian => ({
  nome: '', parentesco: 'Mãe', parentescoOutro: '', telefone: '', email: '',
  cpf: '', rg: '', endereco: '', dataNascimento: '', estadoCivil: '', financeiro,
});

const guardianParaTemp = (g: Guardian): TempGuardian => {
  const isOutro = !['Mãe', 'Pai', 'Avó', 'Avô', 'Tio', 'Tia'].includes(g.parentesco);
  return {
    nome: g.nome,
    parentesco: isOutro ? 'Outro' : g.parentesco,
    parentescoOutro: isOutro ? g.parentesco.replace(/^Outro:\s*/, '') : '',
    telefone: g.telefone,
    email: g.email || '',
    cpf: g.cpf || '',
    rg: g.rg || '',
    endereco: g.endereco || '',
    dataNascimento: g.dataNascimento || '',
    estadoCivil: g.estadoCivil || '',
    financeiro: g.financeiro,
  };
};

export default function FichaDadosGeraisForm({ classPrices, activeYear, existingStudent, existingGuardians, onSubmit, onUpdate }: FichaDadosGeraisFormProps) {
  const isUpdateMode = !!existingStudent;
  const [anoPretendido, setAnoPretendido] = useState<number>(activeYear);
  const [nomeAluno, setNomeAluno] = useState(existingStudent?.nome || '');
  const [nascimento, setNascimento] = useState(existingStudent?.nascimento || '');
  const [cpfAluno, setCpfAluno] = useState(existingStudent?.cpf || '');
  const [comoConheceu, setComoConheceu] = useState(existingStudent?.comoConheceuEscola || '');
  const [autorizadosBuscar, setAutorizadosBuscar] = useState(existingStudent?.autorizadosBuscar || '');
  const [somenteContraturno, setSomenteContraturno] = useState(false);
  const [responsaveis, setResponsaveis] = useState<TempGuardian[]>(
    existingGuardians && existingGuardians.length > 0 ? existingGuardians.map(guardianParaTemp) : [novoResponsavel(true)]
  );
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const idade = nascimento ? calculateAgeAtCutoff(nascimento, anoPretendido) : null;
  const turmaSugerida = idade !== null ? getRegularClassForAgeDynamic(idade, classPrices, anoPretendido) : null;

  const updateResponsavel = (idx: number, field: keyof TempGuardian, value: any) => {
    setResponsaveis(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addResponsavel = () => setResponsaveis(prev => [...prev, novoResponsavel(false)]);
  const removeResponsavel = (idx: number) => setResponsaveis(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!nomeAluno.trim() || !nascimento) {
      setErro('Preencha o nome completo e a data de nascimento do aluno(a).');
      return;
    }
    const responsaveisValidos = responsaveis.filter(r => r.nome.trim() && r.telefone.trim());
    if (responsaveisValidos.length === 0) {
      setErro('Preencha ao menos um responsável, com nome e telefone.');
      return;
    }

    const guardiansList: Omit<Guardian, 'id' | 'alunoId'>[] = responsaveisValidos.map(r => ({
      nome: r.nome.trim(),
      parentesco: r.parentesco === 'Outro' ? `Outro: ${r.parentescoOutro}` : r.parentesco,
      telefone: r.telefone.trim(),
      email: r.email || undefined,
      cpf: r.cpf || undefined,
      rg: r.rg || undefined,
      endereco: r.endereco || undefined,
      dataNascimento: r.dataNascimento || undefined,
      estadoCivil: r.estadoCivil || undefined,
      financeiro: r.financeiro,
    }));

    setIsSubmitting(true);
    try {
      if (isUpdateMode && existingStudent && onUpdate) {
        await onUpdate(
          existingStudent.id,
          {
            nome: nomeAluno.trim(),
            nascimento,
            cpf: cpfAluno || undefined,
            comoConheceuEscola: comoConheceu || undefined,
            autorizadosBuscar: autorizadosBuscar || undefined,
          },
          guardiansList
        );
      } else if (onSubmit) {
        const newStudent: Omit<Student, 'id'> = {
          nome: nomeAluno.trim(),
          nascimento,
          dataEntrada: new Date().toISOString().split('T')[0],
          observacoes: '',
          status: 'ativo',
          cpf: cpfAluno || undefined,
          comoConheceuEscola: comoConheceu || undefined,
          autorizadosBuscar: autorizadosBuscar || undefined,
          origemCadastro: 'auto',
        };
        await onSubmit(newStudent, guardiansList, anoPretendido);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErro('Não foi possível enviar a ficha agora. Verifique sua internet e tente novamente em instantes. Se o problema continuar, entre em contato com a secretaria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans py-8 px-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4"
        >
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={30} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold font-display text-brand-green-dark">
            {isUpdateMode ? 'Dados atualizados!' : 'Ficha recebida!'}
          </h2>
          <p className="text-sm text-slate-600">
            {isUpdateMode
              ? <>Os dados de <strong>{nomeAluno}</strong> foram atualizados. Obrigado por manter tudo em dia!</>
              : <>Obrigado por preencher os dados de <strong>{nomeAluno}</strong>. A equipe do Sítio-Escola Geranium vai entrar em contato em breve para os próximos passos da matrícula.</>}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans py-8 px-4 flex flex-col items-center justify-center print:block print:min-h-0 print:h-auto print:bg-white print:p-0">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-brand-green-dark text-white p-6 sm:p-8 text-center relative">
          <div className="mx-auto mb-3 flex items-center justify-center p-2 bg-white/95 rounded-xl shadow-md max-w-[180px]">
            <img
              src="https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png"
              alt="Sítio-Escola Geranium"
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <Sprout size={14} /> {isUpdateMode ? 'Atualização de Dados' : 'Ficha de Dados Gerais — Pré-Matrícula'}
          </p>
          {isUpdateMode && existingStudent && (
            <p className="text-[11px] text-emerald-100 mt-2 font-semibold">{existingStudent.nome}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <p className="text-xs text-slate-500">
            {isUpdateMode
              ? 'Confira e atualize os dados abaixo. Só altere o que precisar — o que já está certo pode ficar como está.'
              : 'Preencha os dados abaixo para iniciar o processo de matrícula do seu filho(a) no Sítio-Escola Geranium. Em breve nossa equipe entrará em contato.'}
          </p>

          {/* Ano pretendido — só faz sentido para cadastro de aluno novo */}
          {!isUpdateMode && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Matrícula para qual ano letivo?</label>
            <div className="flex gap-2">
              {[activeYear, activeYear + 1].map(ano => (
                <button
                  key={ano}
                  type="button"
                  onClick={() => setAnoPretendido(ano)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors cursor-pointer ${
                    anoPretendido === ano
                      ? 'bg-brand-green-dark text-white border-brand-green-dark'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-green-light'
                  }`}
                >
                  {ano} {ano === activeYear ? '(atual)' : '(próximo)'}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Dados do aluno */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Dados do Aluno(a)</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Nome completo</label>
              <input
                type="text" required value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Data de nascimento</label>
                <input
                  type="date" required value={nascimento} onChange={(e) => setNascimento(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">CPF do aluno (opcional)</label>
                <input
                  type="text" value={cpfAluno} onChange={(e) => setCpfAluno(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none"
                />
              </div>
            </div>

            {/* Turma calculada automaticamente / somente contraturno — só no cadastro novo */}
            {!isUpdateMode && turmaSugerida && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">Turma pretendida (calculada automaticamente)</p>
                  <p className="text-sm font-bold text-emerald-900">{turmaSugerida.nome} — {turmaSugerida.natureza}</p>
                </div>
                <span className="text-[10px] text-emerald-600 font-mono">{idade} anos em {anoPretendido}</span>
              </div>
            )}

            {!isUpdateMode && (
            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox" checked={somenteContraturno}
                onChange={(e) => setSomenteContraturno(e.target.checked)}
                className="w-4 h-4 text-brand-orange rounded border-slate-300 focus:ring-brand-orange cursor-pointer"
              />
              <span className="text-xs text-slate-700">Meu filho(a) frequentará <strong>somente o contraturno</strong> (sem ensino regular)</span>
            </label>
            )}
          </div>

          {/* Responsáveis */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Responsáveis</h3>
            {responsaveis.map((r, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Responsável {idx + 1}</span>
                  {responsaveis.length > 1 && (
                    <button type="button" onClick={() => removeResponsavel(idx)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  type="text" placeholder="Nome completo" required={idx === 0}
                  value={r.nome} onChange={(e) => updateResponsavel(idx, 'nome', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={r.parentesco} onChange={(e) => updateResponsavel(idx, 'parentesco', e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white"
                  >
                    {PARENTESCO_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  {r.parentesco === 'Outro' ? (
                    <input
                      type="text" placeholder="Especifique" value={r.parentescoOutro}
                      onChange={(e) => updateResponsavel(idx, 'parentescoOutro', e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                    />
                  ) : (
                    <input
                      type="text" placeholder="Telefone / WhatsApp" required={idx === 0}
                      value={r.telefone} onChange={(e) => updateResponsavel(idx, 'telefone', e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                    />
                  )}
                </div>
                {r.parentesco === 'Outro' && (
                  <input
                    type="text" placeholder="Telefone / WhatsApp" required={idx === 0}
                    value={r.telefone} onChange={(e) => updateResponsavel(idx, 'telefone', e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email" placeholder="E-mail" value={r.email}
                    onChange={(e) => updateResponsavel(idx, 'email', e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                  />
                  <select
                    value={r.estadoCivil} onChange={(e) => updateResponsavel(idx, 'estadoCivil', e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white"
                  >
                    <option value="">Estado civil</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                    <option value="União estável">União estável</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 block">CPF (opcional)</label>
                    <input
                      type="text" placeholder="000.000.000-00" value={r.cpf}
                      onChange={(e) => updateResponsavel(idx, 'cpf', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 block">RG (opcional)</label>
                    <input
                      type="text" placeholder="00.000.000-0" value={r.rg}
                      onChange={(e) => updateResponsavel(idx, 'rg', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 block">Data de nascimento (opcional)</label>
                    <input
                      type="date" value={r.dataNascimento}
                      onChange={(e) => updateResponsavel(idx, 'dataNascimento', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                    />
                  </div>
                </div>
                <input
                  type="text" placeholder="Endereço completo (rua, número, bairro, cidade, CEP)" value={r.endereco}
                  onChange={(e) => updateResponsavel(idx, 'endereco', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none pt-0.5">
                  <input
                    type="checkbox" checked={r.financeiro}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setResponsaveis(prev => prev.map((rr, i) => ({ ...rr, financeiro: i === idx ? checked : (checked ? false : rr.financeiro) })));
                    }}
                    className="w-3.5 h-3.5 text-emerald-600 rounded"
                  />
                  <span className="text-[11px] font-bold text-slate-600">Responsável financeiro</span>
                </label>
              </div>
            ))}
            <button
              type="button" onClick={addResponsavel}
              className="w-full flex items-center justify-center gap-1 text-xs font-bold text-slate-500 border border-dashed border-slate-300 rounded-lg py-2 hover:bg-slate-50 cursor-pointer"
            >
              <Plus size={13} /> Adicionar outro responsável
            </button>
          </div>

          {/* Origem e autorizações */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Outras informações</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Como conheceu a escola? (opcional)</label>
              <input
                type="text" value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Outras pessoas autorizadas a buscar a criança (opcional)</label>
              <input
                type="text" value={autorizadosBuscar} onChange={(e) => setAutorizadosBuscar(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none"
              />
            </div>
          </div>

          {erro && <p className="text-xs font-bold text-rose-600 text-center">{erro}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-bold font-display uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Enviando...' : isUpdateMode ? 'Atualizar Dados' : 'Enviar Ficha de Dados Gerais'}
          </button>
        </form>
      </div>
    </div>
  );
}
