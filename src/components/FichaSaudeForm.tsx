import React, { useState } from 'react';
import { Student, FichaSaude } from '../types';
import { CheckCircle2, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

interface FichaSaudeFormProps {
  student: Student;
  existingFicha?: FichaSaude;
  onSubmit: (ficha: Omit<FichaSaude, 'id'>) => Promise<void>;
}

type AcompTipo = 'Psicologia' | 'Fonoaudiologia' | 'Terapia Ocupacional' | 'Fisioterapia' | 'Psicopedagogia' | 'Outros';
const ACOMP_TIPOS: AcompTipo[] = ['Psicologia', 'Fonoaudiologia', 'Terapia Ocupacional', 'Fisioterapia', 'Psicopedagogia', 'Outros'];

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

interface CheckboxRowProps { label: string; checked: boolean; onChange: (v: boolean) => void; }
const CheckboxRow: React.FC<CheckboxRowProps> = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-brand-orange rounded border-slate-300 focus:ring-brand-orange cursor-pointer shrink-0" />
      <span className="text-xs text-slate-700">{label}</span>
    </label>
  );
};

function CheckboxGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map(op => (
        <CheckboxRow key={op} label={op} checked={selected.includes(op)} onChange={() => onChange(toggleInArray(selected, op))} />
      ))}
    </div>
  );
}

function SimNao({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-slate-700">{label}</span>
      <div className="flex gap-1.5 shrink-0">
        <button type="button" onClick={() => onChange(true)}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-md border cursor-pointer ${value === true ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-slate-500 border-slate-200'}`}>Sim</button>
        <button type="button" onClick={() => onChange(false)}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-md border cursor-pointer ${value === false ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200'}`}>Não</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-500">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">{number}. {title}</h3>
      {children}
    </div>
  );
}

export default function FichaSaudeForm({ student, existingFicha, onSubmit }: FichaSaudeFormProps) {
  const f = existingFicha;
  const [numeroMatricula, setNumeroMatricula] = useState(f?.numeroMatricula || '');
  const [nomePlanoSaude, setNomePlanoSaude] = useState(f?.nomePlanoSaude || '');
  const [numeroInscricaoPlano, setNumeroInscricaoPlano] = useState(f?.numeroInscricaoPlano || '');

  const [doencasContagiosas, setDoencasContagiosas] = useState<string[]>(f?.doencasContagiosas || []);
  const [doencasContagiosasOutras, setDoencasContagiosasOutras] = useState(f?.doencasContagiosasOutras || '');
  const [doencasCronicas, setDoencasCronicas] = useState<string[]>(f?.doencasCronicas || []);
  const [doencasCronicasOutras, setDoencasCronicasOutras] = useState(f?.doencasCronicasOutras || '');
  const [temEpilepsia, setTemEpilepsia] = useState<boolean | undefined>(f?.temEpilepsia);
  const [epilepsiaEmTratamento, setEpilepsiaEmTratamento] = useState<boolean | undefined>(f?.epilepsiaEmTratamento);
  const [temDiabetes, setTemDiabetes] = useState<boolean | undefined>(f?.temDiabetes);
  const [diabetesEmTratamento, setDiabetesEmTratamento] = useState<boolean | undefined>(f?.diabetesEmTratamento);
  const [diabetesDependenteInsulina, setDiabetesDependenteInsulina] = useState<boolean | undefined>(f?.diabetesDependenteInsulina);
  const [temDoencaCongenita, setTemDoencaCongenita] = useState<boolean | undefined>(f?.temDoencaCongenita);
  const [doencaCongenitaQual, setDoencaCongenitaQual] = useState(f?.doencaCongenitaQual || '');
  const [tipoSanguineo, setTipoSanguineo] = useState(f?.tipoSanguineo || '');
  const [alergiasTipos, setAlergiasTipos] = useState<string[]>(f?.alergiasTipos || []);
  const [alergiaCorantesQual, setAlergiaCorantesQual] = useState(f?.alergiaCorantesQual || '');
  const [alergiaMedicacaoQual, setAlergiaMedicacaoQual] = useState(f?.alergiaMedicacaoQual || '');
  const [alergiaOutrosQual, setAlergiaOutrosQual] = useState(f?.alergiaOutrosQual || '');
  const [alergicoMedicamento, setAlergicoMedicamento] = useState<boolean | undefined>(f?.alergicoMedicamento);
  const [alergicoMedicamentoQuais, setAlergicoMedicamentoQuais] = useState(f?.alergicoMedicamentoQuais || '');
  const [medicacaoAtual, setMedicacaoAtual] = useState<boolean | undefined>(f?.medicacaoAtual);
  const [medicacaoAtualQual, setMedicacaoAtualQual] = useState(f?.medicacaoAtualQual || '');

  const [acompAtivos, setAcompAtivos] = useState<AcompTipo[]>(f?.acompanhamentos ? (Object.keys(f.acompanhamentos) as AcompTipo[]) : []);
  const [acompDados, setAcompDados] = useState<Record<string, { qual?: string; nome?: string; telefone?: string }>>(f?.acompanhamentos || {});

  const [temNecessidadeEducativa, setTemNecessidadeEducativa] = useState<boolean | undefined>(f?.temNecessidadeEducativa);
  const [necessidadesEducativasTipos, setNecessidadesEducativasTipos] = useState<string[]>(f?.necessidadesEducativasTipos || []);
  const [necessidadesEducativasOutras, setNecessidadesEducativasOutras] = useState(f?.necessidadesEducativasOutras || '');
  const [temSindrome, setTemSindrome] = useState<boolean | undefined>(f?.temSindrome);
  const [sindromeQual, setSindromeQual] = useState(f?.sindromeQual || '');
  const [condicoes, setCondicoes] = useState<string[]>(f?.condicoes || []);
  const [lateralidade, setLateralidade] = useState<string>(f?.lateralidade || '');
  const [gestacaoSemanas, setGestacaoSemanas] = useState(f?.gestacaoSemanas || '');
  const [tipoParto, setTipoParto] = useState<string>(f?.tipoParto || '');
  const [idadeSentou, setIdadeSentou] = useState(f?.idadeSentou || '');
  const [idadeEngatinhou, setIdadeEngatinhou] = useState(f?.idadeEngatinhou || '');
  const [idadeAndou, setIdadeAndou] = useState(f?.idadeAndou || '');
  const [idadeFalou, setIdadeFalou] = useState(f?.idadeFalou || '');
  const [idade1aDenticao, setIdade1aDenticao] = useState(f?.idade1aDenticao || '');

  const [temRestricaoAlimentar, setTemRestricaoAlimentar] = useState<boolean | undefined>(f?.temRestricaoAlimentar);
  const [restricaoAlimentarQual, setRestricaoAlimentarQual] = useState(f?.restricaoAlimentarQual || '');

  const [ce1Nome, setCe1Nome] = useState(f?.contatoEmergencia1Nome || '');
  const [ce1RG, setCe1RG] = useState(f?.contatoEmergencia1RG || '');
  const [ce1Telefone, setCe1Telefone] = useState(f?.contatoEmergencia1Telefone || '');
  const [ce1Parentesco, setCe1Parentesco] = useState(f?.contatoEmergencia1Parentesco || '');
  const [ce2Nome, setCe2Nome] = useState(f?.contatoEmergencia2Nome || '');
  const [ce2RG, setCe2RG] = useState(f?.contatoEmergencia2RG || '');
  const [ce2Telefone, setCe2Telefone] = useState(f?.contatoEmergencia2Telefone || '');
  const [ce2Parentesco, setCe2Parentesco] = useState(f?.contatoEmergencia2Parentesco || '');
  const [hospitalTelefone, setHospitalTelefone] = useState(f?.hospitalTelefone || '');
  const [hospitalEndereco, setHospitalEndereco] = useState(f?.hospitalEndereco || '');
  const [medicoTipo, setMedicoTipo] = useState<string>(f?.medicoTipo || '');
  const [medicoNome, setMedicoNome] = useState(f?.medicoNome || '');
  const [febreAltaMedicar, setFebreAltaMedicar] = useState<boolean | undefined>(f?.febreAltaMedicar);
  const [febreAltaPosologia, setFebreAltaPosologia] = useState(f?.febreAltaPosologia || '');

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const toggleAcomp = (tipo: AcompTipo) => {
    setAcompAtivos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };
  const updateAcompDado = (tipo: AcompTipo, campo: 'qual' | 'nome' | 'telefone', valor: string) => {
    setAcompDados(prev => ({ ...prev, [tipo]: { ...prev[tipo], [campo]: valor } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!ce1Nome.trim() || !ce1Telefone.trim()) {
      setErro('Preencha ao menos o nome e telefone do Contato de Emergência 1.');
      return;
    }

    const acompanhamentos: FichaSaude['acompanhamentos'] = {};
    acompAtivos.forEach(tipo => {
      acompanhamentos[tipo] = {
        qual: acompDados[tipo]?.qual || undefined,
        nome: acompDados[tipo]?.nome || undefined,
        telefone: acompDados[tipo]?.telefone || undefined,
      };
    });

    const ficha: Omit<FichaSaude, 'id'> = {
      alunoId: student.id,
      numeroMatricula: numeroMatricula || undefined,
      nomePlanoSaude: nomePlanoSaude || undefined,
      numeroInscricaoPlano: numeroInscricaoPlano || undefined,
      doencasContagiosas: doencasContagiosas.length ? doencasContagiosas : undefined,
      doencasContagiosasOutras: doencasContagiosasOutras || undefined,
      doencasCronicas: doencasCronicas.length ? doencasCronicas : undefined,
      doencasCronicasOutras: doencasCronicasOutras || undefined,
      temEpilepsia, epilepsiaEmTratamento: temEpilepsia ? epilepsiaEmTratamento : undefined,
      temDiabetes,
      diabetesEmTratamento: temDiabetes ? diabetesEmTratamento : undefined,
      diabetesDependenteInsulina: temDiabetes ? diabetesDependenteInsulina : undefined,
      temDoencaCongenita, doencaCongenitaQual: temDoencaCongenita ? (doencaCongenitaQual || undefined) : undefined,
      tipoSanguineo: tipoSanguineo || undefined,
      alergiasTipos: alergiasTipos.length ? alergiasTipos : undefined,
      alergiaCorantesQual: alergiaCorantesQual || undefined,
      alergiaMedicacaoQual: alergiaMedicacaoQual || undefined,
      alergiaOutrosQual: alergiaOutrosQual || undefined,
      alergicoMedicamento, alergicoMedicamentoQuais: alergicoMedicamento ? (alergicoMedicamentoQuais || undefined) : undefined,
      medicacaoAtual, medicacaoAtualQual: medicacaoAtual ? (medicacaoAtualQual || undefined) : undefined,
      acompanhamentos: Object.keys(acompanhamentos).length ? acompanhamentos : undefined,
      temNecessidadeEducativa,
      necessidadesEducativasTipos: temNecessidadeEducativa && necessidadesEducativasTipos.length ? necessidadesEducativasTipos : undefined,
      necessidadesEducativasOutras: necessidadesEducativasOutras || undefined,
      temSindrome, sindromeQual: temSindrome ? (sindromeQual || undefined) : undefined,
      condicoes: condicoes.length ? condicoes : undefined,
      lateralidade: (lateralidade || undefined) as FichaSaude['lateralidade'],
      gestacaoSemanas: gestacaoSemanas || undefined,
      tipoParto: (tipoParto || undefined) as FichaSaude['tipoParto'],
      idadeSentou: idadeSentou || undefined,
      idadeEngatinhou: idadeEngatinhou || undefined,
      idadeAndou: idadeAndou || undefined,
      idadeFalou: idadeFalou || undefined,
      idade1aDenticao: idade1aDenticao || undefined,
      temRestricaoAlimentar, restricaoAlimentarQual: temRestricaoAlimentar ? (restricaoAlimentarQual || undefined) : undefined,
      contatoEmergencia1Nome: ce1Nome.trim(),
      contatoEmergencia1RG: ce1RG || undefined,
      contatoEmergencia1Telefone: ce1Telefone.trim(),
      contatoEmergencia1Parentesco: ce1Parentesco || undefined,
      contatoEmergencia2Nome: ce2Nome || undefined,
      contatoEmergencia2RG: ce2RG || undefined,
      contatoEmergencia2Telefone: ce2Telefone || undefined,
      contatoEmergencia2Parentesco: ce2Parentesco || undefined,
      hospitalTelefone: hospitalTelefone || undefined,
      hospitalEndereco: hospitalEndereco || undefined,
      medicoTipo: (medicoTipo || undefined) as FichaSaude['medicoTipo'],
      medicoNome: medicoNome || undefined,
      febreAltaMedicar, febreAltaPosologia: febreAltaMedicar ? (febreAltaPosologia || undefined) : undefined,
      preenchidoEm: new Date().toISOString().split('T')[0],
    };

    setIsSubmitting(true);
    try {
      await onSubmit(ficha);
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
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={30} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold font-display text-brand-green-dark">Ficha de Saúde recebida!</h2>
          <p className="text-sm text-slate-600">
            Obrigado por preencher as informações de saúde de <strong>{student.nome}</strong>. Esses dados ficam
            guardados com cuidado e são usados só pela equipe da escola, em caso de necessidade.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans py-8 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-brand-green-dark text-white p-6 sm:p-8 text-center relative">
          <div className="mx-auto mb-3 flex items-center justify-center p-2 bg-white/95 rounded-xl shadow-md max-w-[180px]">
            <img src="https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png" alt="Sítio-Escola Geranium"
              className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <HeartPulse size={14} /> Ficha de Saúde do Aluno
          </p>
          <p className="text-[11px] text-emerald-100 mt-2 font-semibold">{student.nome}</p>
          <p className="text-[10px] text-emerald-200/80">Preencher no momento da assinatura do contrato</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <Section number={1} title="Identificação">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField label="RM (nº de matrícula, se souber)" value={numeroMatricula} onChange={setNumeroMatricula} />
              <TextField label="Tipo sanguíneo" value={tipoSanguineo} onChange={setTipoSanguineo} placeholder="Ex: O+" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField label="Nome do plano de saúde" value={nomePlanoSaude} onChange={setNomePlanoSaude} />
              <TextField label="Nº de inscrição" value={numeroInscricaoPlano} onChange={setNumeroInscricaoPlano} />
            </div>
          </Section>

          <Section number={2} title="Histórico de Saúde">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Doenças contagiosas já contraídas</label>
              <CheckboxGroup options={['Catapora', 'Caxumba', 'Coqueluche', 'Escarlatina', 'Rubéola', 'Sarampo']} selected={doencasContagiosas} onChange={setDoencasContagiosas} />
              <input type="text" placeholder="Outras" value={doencasContagiosasOutras} onChange={(e) => setDoencasContagiosasOutras(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Doenças crônicas</label>
              <CheckboxGroup options={['Asma', 'Hipertensão', 'Hemofilia', 'Bronquite', 'Reumatismo', 'Doença Celíaca']} selected={doencasCronicas} onChange={setDoencasCronicas} />
              <input type="text" placeholder="Outras" value={doencasCronicasOutras} onChange={(e) => setDoencasCronicasOutras(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200" />
            </div>

            <SimNao label="O aluno tem epilepsia?" value={temEpilepsia} onChange={setTemEpilepsia} />
            {temEpilepsia && <SimNao label="Em caso afirmativo, está em tratamento?" value={epilepsiaEmTratamento} onChange={setEpilepsiaEmTratamento} />}

            <SimNao label="O aluno tem diabetes?" value={temDiabetes} onChange={setTemDiabetes} />
            {temDiabetes && <>
              <SimNao label="Está em tratamento?" value={diabetesEmTratamento} onChange={setDiabetesEmTratamento} />
              <SimNao label="É dependente de insulina?" value={diabetesDependenteInsulina} onChange={setDiabetesDependenteInsulina} />
            </>}

            <SimNao label="A criança tem doença congênita?" value={temDoencaCongenita} onChange={setTemDoencaCongenita} />
            {temDoencaCongenita && <TextField label="Qual?" value={doencaCongenitaQual} onChange={setDoencaCongenitaQual} />}

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-500">Apresenta algum tipo de alergia?</label>
              <CheckboxGroup options={['Picadas de insetos', 'Corantes', 'Medicação', 'Outros']} selected={alergiasTipos} onChange={setAlergiasTipos} />
              {alergiasTipos.includes('Corantes') && <TextField label="Qual (corantes)?" value={alergiaCorantesQual} onChange={setAlergiaCorantesQual} />}
              {alergiasTipos.includes('Medicação') && <TextField label="Qual (medicação)?" value={alergiaMedicacaoQual} onChange={setAlergiaMedicacaoQual} />}
              {alergiasTipos.includes('Outros') && <TextField label="Qual (outros)?" value={alergiaOutrosQual} onChange={setAlergiaOutrosQual} />}
            </div>
            <SimNao label="É alérgico a algum medicamento tópico, oral ou injetável?" value={alergicoMedicamento} onChange={setAlergicoMedicamento} />
            {alergicoMedicamento && <TextField label="Quais?" value={alergicoMedicamentoQuais} onChange={setAlergicoMedicamentoQuais} />}
            <SimNao label="Está ingerindo alguma medicação específica atualmente?" value={medicacaoAtual} onChange={setMedicacaoAtual} />
            {medicacaoAtual && <TextField label="Qual?" value={medicacaoAtualQual} onChange={setMedicacaoAtualQual} />}
          </Section>

          <Section number={3} title="Acompanhamento Terapêutico">
            <p className="text-[11px] text-slate-500">Está realizando algum dos tratamentos abaixo?</p>
            <div className="space-y-2">
              {ACOMP_TIPOS.map(tipo => (
                <div key={tipo} className="bg-slate-50 rounded-md p-2.5 space-y-1.5">
                  <CheckboxRow label={tipo} checked={acompAtivos.includes(tipo)} onChange={() => toggleAcomp(tipo)} />
                  {acompAtivos.includes(tipo) && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {tipo === 'Outros' && (
                        <input type="text" placeholder="Qual?" value={acompDados[tipo]?.qual || ''} onChange={(e) => updateAcompDado(tipo, 'qual', e.target.value)}
                          className="col-span-2 text-xs px-2 py-1.5 rounded-md border border-slate-200" />
                      )}
                      <input type="text" placeholder="Nome do profissional" value={acompDados[tipo]?.nome || ''} onChange={(e) => updateAcompDado(tipo, 'nome', e.target.value)}
                        className="text-xs px-2 py-1.5 rounded-md border border-slate-200" />
                      <input type="text" placeholder="Telefone" value={acompDados[tipo]?.telefone || ''} onChange={(e) => updateAcompDado(tipo, 'telefone', e.target.value)}
                        className="text-xs px-2 py-1.5 rounded-md border border-slate-200" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section number={4} title="Necessidades Educativas Especiais e Desenvolvimento">
            <SimNao label="O aluno possui alguma necessidade educativa especial?" value={temNecessidadeEducativa} onChange={setTemNecessidadeEducativa} />
            {temNecessidadeEducativa && (
              <div className="space-y-1.5">
                <CheckboxGroup options={['Deficiência auditiva', 'Falha no processamento auditivo', 'Mental (Cognitiva)', 'Física', 'Visual', 'Fala', 'Surdo']} selected={necessidadesEducativasTipos} onChange={setNecessidadesEducativasTipos} />
                <input type="text" placeholder="Outras" value={necessidadesEducativasOutras} onChange={(e) => setNecessidadesEducativasOutras(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200" />
              </div>
            )}
            <SimNao label="O aluno possui alguma síndrome?" value={temSindrome} onChange={setTemSindrome} />
            {temSindrome && <TextField label="Qual?" value={sindromeQual} onChange={setSindromeQual} />}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">O aluno apresenta:</label>
              <CheckboxGroup options={['Dislexia', 'TDAH', 'TEA']} selected={condicoes} onChange={setCondicoes} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Lateralidade</label>
                <select value={lateralidade} onChange={(e) => setLateralidade(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200">
                  <option value="">—</option>
                  <option value="Destro">Destro</option>
                  <option value="Canhoto">Canhoto</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Tipo de parto</label>
                <select value={tipoParto} onChange={(e) => setTipoParto(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200">
                  <option value="">—</option>
                  <option value="Normal">Normal</option>
                  <option value="Cesárea">Cesárea</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-500 pt-1">Informações da gestação e desenvolvimento</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Gestação (nº de semanas)" value={gestacaoSemanas} onChange={setGestacaoSemanas} />
              <TextField label="Idade da 1ª dentição" value={idade1aDenticao} onChange={setIdade1aDenticao} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField label="Idade que sentou" value={idadeSentou} onChange={setIdadeSentou} />
              <TextField label="Idade que engatinhou" value={idadeEngatinhou} onChange={setIdadeEngatinhou} />
              <TextField label="Idade que andou" value={idadeAndou} onChange={setIdadeAndou} />
            </div>
            <TextField label="Idade que falou" value={idadeFalou} onChange={setIdadeFalou} />
          </Section>

          <Section number={5} title="Alimentação">
            <SimNao label="Possui alguma intolerância ou restrição alimentar?" value={temRestricaoAlimentar} onChange={setTemRestricaoAlimentar} />
            {temRestricaoAlimentar && <TextField label="Qual?" value={restricaoAlimentarQual} onChange={setRestricaoAlimentarQual} />}
          </Section>

          <Section number={6} title="Emergência">
            <p className="text-[11px] text-slate-500">Em caso de emergência, não localizando os pais, contatar:</p>
            <div className="bg-slate-50 rounded-md p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Contato de emergência 1</p>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Nome" value={ce1Nome} onChange={setCe1Nome} />
                <TextField label="RG" value={ce1RG} onChange={setCe1RG} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Telefone" value={ce1Telefone} onChange={setCe1Telefone} />
                <TextField label="Parentesco" value={ce1Parentesco} onChange={setCe1Parentesco} />
              </div>
            </div>
            <div className="bg-slate-50 rounded-md p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Contato de emergência 2 (opcional)</p>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Nome" value={ce2Nome} onChange={setCe2Nome} />
                <TextField label="RG" value={ce2RG} onChange={setCe2RG} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Telefone" value={ce2Telefone} onChange={setCe2Telefone} />
                <TextField label="Parentesco" value={ce2Parentesco} onChange={setCe2Parentesco} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">Em caso de necessidade, remover para:</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Hospital / Clínica — telefone" value={hospitalTelefone} onChange={setHospitalTelefone} />
              <TextField label="Endereço" value={hospitalEndereco} onChange={setHospitalEndereco} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Médico do aluno</label>
                <select value={medicoTipo} onChange={(e) => setMedicoTipo(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200">
                  <option value="">—</option>
                  <option value="Alopata">Alopata</option>
                  <option value="Homeopata">Homeopata</option>
                </select>
              </div>
              <TextField label="Nome" value={medicoNome} onChange={setMedicoNome} />
            </div>
            <SimNao label="Em caso de febre alta, o aluno deverá ser medicado?" value={febreAltaMedicar} onChange={setFebreAltaMedicar} />
            {febreAltaMedicar && <TextField label="Se sim, posologia (quantidade)" value={febreAltaPosologia} onChange={setFebreAltaPosologia} />}
          </Section>

          {erro && <p className="text-xs font-bold text-rose-600 text-center">{erro}</p>}

          <button type="submit" disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-bold font-display uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            {isSubmitting ? 'Enviando...' : existingFicha ? 'Atualizar Ficha de Saúde' : 'Enviar Ficha de Saúde'}
          </button>
        </form>
      </div>
    </div>
  );
}
