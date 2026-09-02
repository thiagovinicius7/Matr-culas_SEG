import React, { useState } from 'react';
import { Student, FichaSaude } from '../types';
import { CheckCircle2, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

interface FichaSaudeFormProps {
  student: Student;
  existingFicha?: FichaSaude;
  onSubmit: (ficha: Omit<FichaSaude, 'id'>) => Promise<void>;
}

export default function FichaSaudeForm({ student, existingFicha, onSubmit }: FichaSaudeFormProps) {
  const [planoSaude, setPlanoSaude] = useState(existingFicha?.planoSaude || '');
  const [numeroCarteirinha, setNumeroCarteirinha] = useState(existingFicha?.numeroCarteirinha || '');
  const [hospitalPreferencia, setHospitalPreferencia] = useState(existingFicha?.hospitalPreferencia || '');
  const [tipoSanguineo, setTipoSanguineo] = useState(existingFicha?.tipoSanguineo || '');
  const [doencasPreExistentes, setDoencasPreExistentes] = useState(existingFicha?.doencasPreExistentes || '');
  const [cirurgiasInternacoes, setCirurgiasInternacoes] = useState(existingFicha?.cirurgiasInternacoes || '');
  const [alergias, setAlergias] = useState(existingFicha?.alergias || '');
  const [restricaoAlimentar, setRestricaoAlimentar] = useState(existingFicha?.restricaoAlimentar || '');
  const [medicacoesUso, setMedicacoesUso] = useState(existingFicha?.medicacoesUso || '');
  const [acompanhamentoTerapeutico, setAcompanhamentoTerapeutico] = useState(existingFicha?.acompanhamentoTerapeutico || '');
  const [necessidadesEducativas, setNecessidadesEducativas] = useState(existingFicha?.necessidadesEducativas || '');
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState(existingFicha?.contatoEmergenciaNome || '');
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState(existingFicha?.contatoEmergenciaTelefone || '');
  const [contatoEmergenciaParentesco, setContatoEmergenciaParentesco] = useState(existingFicha?.contatoEmergenciaParentesco || '');
  const [autorizaProcedimentoEmergencia, setAutorizaProcedimentoEmergencia] = useState(existingFicha?.autorizaProcedimentoEmergencia ?? true);
  const [observacoesGerais, setObservacoesGerais] = useState(existingFicha?.observacoesGerais || '');

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!contatoEmergenciaNome.trim() || !contatoEmergenciaTelefone.trim()) {
      setErro('Preencha ao menos o nome e o telefone do contato de emergência.');
      return;
    }

    const ficha: Omit<FichaSaude, 'id'> = {
      alunoId: student.id,
      planoSaude: planoSaude || undefined,
      numeroCarteirinha: numeroCarteirinha || undefined,
      hospitalPreferencia: hospitalPreferencia || undefined,
      tipoSanguineo: tipoSanguineo || undefined,
      doencasPreExistentes: doencasPreExistentes || undefined,
      cirurgiasInternacoes: cirurgiasInternacoes || undefined,
      alergias: alergias || undefined,
      restricaoAlimentar: restricaoAlimentar || undefined,
      medicacoesUso: medicacoesUso || undefined,
      acompanhamentoTerapeutico: acompanhamentoTerapeutico || undefined,
      necessidadesEducativas: necessidadesEducativas || undefined,
      contatoEmergenciaNome: contatoEmergenciaNome.trim(),
      contatoEmergenciaTelefone: contatoEmergenciaTelefone.trim(),
      contatoEmergenciaParentesco: contatoEmergenciaParentesco || undefined,
      autorizaProcedimentoEmergencia,
      observacoesGerais: observacoesGerais || undefined,
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
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4"
        >
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
            <HeartPulse size={14} /> Ficha de Saúde
          </p>
          <p className="text-[11px] text-emerald-100 mt-2 font-semibold">{student.nome}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <p className="text-xs text-slate-500">
            Essas informações ajudam a equipe a cuidar bem do seu filho(a) no dia a dia e em qualquer emergência.
            Preencha com atenção — tudo aqui é tratado com confidencialidade.
          </p>

          {/* Identificação */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Plano de Saúde</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Plano de saúde (opcional)</label>
                <input type="text" value={planoSaude} onChange={(e) => setPlanoSaude(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Nº da carteirinha (opcional)</label>
                <input type="text" value={numeroCarteirinha} onChange={(e) => setNumeroCarteirinha(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Hospital de preferência (opcional)</label>
                <input type="text" value={hospitalPreferencia} onChange={(e) => setHospitalPreferencia(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Tipo sanguíneo (opcional)</label>
                <input type="text" placeholder="Ex: O+" value={tipoSanguineo} onChange={(e) => setTipoSanguineo(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Histórico de Saúde */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Histórico de Saúde</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Doenças pré-existentes / condições crônicas (se houver)</label>
              <textarea rows={2} value={doencasPreExistentes} onChange={(e) => setDoencasPreExistentes(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Cirurgias ou internações anteriores (se houver)</label>
              <textarea rows={2} value={cirurgiasInternacoes} onChange={(e) => setCirurgiasInternacoes(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
          </div>

          {/* Alergias e Medicações */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Alergias e Medicações</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Alergias (alimentares, medicamentosas, outras)</label>
              <textarea rows={2} value={alergias} onChange={(e) => setAlergias(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Restrição alimentar (se houver)</label>
              <input type="text" value={restricaoAlimentar} onChange={(e) => setRestricaoAlimentar(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Medicações de uso contínuo (nome, dose, horário)</label>
              <textarea rows={2} value={medicacoesUso} onChange={(e) => setMedicacoesUso(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
          </div>

          {/* Acompanhamento Terapêutico */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Acompanhamento Terapêutico</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Faz algum acompanhamento (fono, TO, psicológico etc.)? Qual profissional?</label>
              <textarea rows={2} value={acompanhamentoTerapeutico} onChange={(e) => setAcompanhamentoTerapeutico(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
          </div>

          {/* Necessidades Educativas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Necessidades Educativas / Desenvolvimento</h3>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Algo que a escola deva saber para apoiar melhor o desenvolvimento dele(a)?</label>
              <textarea rows={2} value={necessidadesEducativas} onChange={(e) => setNecessidadesEducativas(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
          </div>

          {/* Emergência */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Emergência</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Nome do contato</label>
                <input type="text" required value={contatoEmergenciaNome} onChange={(e) => setContatoEmergenciaNome(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Telefone</label>
                <input type="text" required value={contatoEmergenciaTelefone} onChange={(e) => setContatoEmergenciaTelefone(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Parentesco</label>
                <input type="text" value={contatoEmergenciaParentesco} onChange={(e) => setContatoEmergenciaParentesco(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input type="checkbox" checked={autorizaProcedimentoEmergencia} onChange={(e) => setAutorizaProcedimentoEmergencia(e.target.checked)}
                className="w-4 h-4 text-brand-orange rounded border-slate-300 focus:ring-brand-orange cursor-pointer" />
              <span className="text-xs text-slate-700">Autorizo a escola a tomar as providências necessárias (incluindo atendimento médico de emergência) caso não seja possível localizar um responsável imediatamente.</span>
            </label>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Observações gerais (opcional)</label>
              <textarea rows={2} value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
            </div>
          </div>

          {erro && <p className="text-xs font-bold text-rose-600 text-center">{erro}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-bold font-display uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Enviando...' : existingFicha ? 'Atualizar Ficha de Saúde' : 'Enviar Ficha de Saúde'}
          </button>
        </form>
      </div>
    </div>
  );
}
