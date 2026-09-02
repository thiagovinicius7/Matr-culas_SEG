import React, { useState } from 'react';
import { Student, FichaAnamnese } from '../types';
import { CheckCircle2, NotebookPen } from 'lucide-react';
import { motion } from 'motion/react';

interface FichaAnamneseFormProps {
  student: Student;
  natureza: 'Infantil' | 'Fundamental';
  existingFicha?: FichaAnamnese;
  onSubmit: (ficha: Omit<FichaAnamnese, 'id'>) => Promise<void>;
}

export default function FichaAnamneseForm({ student, natureza, existingFicha, onSubmit }: FichaAnamneseFormProps) {
  const [rotinaFamiliar, setRotinaFamiliar] = useState(existingFicha?.rotinaFamiliar || '');
  const [interesses, setInteresses] = useState(existingFicha?.interesses || '');
  const [paraEscolaConhecerMelhor, setParaEscolaConhecerMelhor] = useState(existingFicha?.paraEscolaConhecerMelhor || '');

  // Infantil
  const [gestacaoParto, setGestacaoParto] = useState(existingFicha?.gestacaoParto || '');
  const [desenvolvimentoMotorLinguagem, setDesenvolvimentoMotorLinguagem] = useState(existingFicha?.desenvolvimentoMotorLinguagem || '');
  const [habitosSono, setHabitosSono] = useState(existingFicha?.habitosSono || '');
  const [habitosAlimentares, setHabitosAlimentares] = useState(existingFicha?.habitosAlimentares || '');
  const [autonomiaAtividadesDiarias, setAutonomiaAtividadesDiarias] = useState(existingFicha?.autonomiaAtividadesDiarias || '');

  // Fundamental
  const [trajetoriaEscolar, setTrajetoriaEscolar] = useState(existingFicha?.trajetoriaEscolar || '');
  const [aprendizagem, setAprendizagem] = useState(existingFicha?.aprendizagem || '');
  const [envolvimentoAutonomia, setEnvolvimentoAutonomia] = useState(existingFicha?.envolvimentoAutonomia || '');
  const [convivenciaRelacoes, setConvivenciaRelacoes] = useState(existingFicha?.convivenciaRelacoes || '');

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const ficha: Omit<FichaAnamnese, 'id'> = {
      alunoId: student.id,
      natureza,
      rotinaFamiliar: rotinaFamiliar || undefined,
      interesses: interesses || undefined,
      paraEscolaConhecerMelhor: paraEscolaConhecerMelhor || undefined,
      gestacaoParto: natureza === 'Infantil' ? (gestacaoParto || undefined) : undefined,
      desenvolvimentoMotorLinguagem: natureza === 'Infantil' ? (desenvolvimentoMotorLinguagem || undefined) : undefined,
      habitosSono: natureza === 'Infantil' ? (habitosSono || undefined) : undefined,
      habitosAlimentares: natureza === 'Infantil' ? (habitosAlimentares || undefined) : undefined,
      autonomiaAtividadesDiarias: natureza === 'Infantil' ? (autonomiaAtividadesDiarias || undefined) : undefined,
      trajetoriaEscolar: natureza === 'Fundamental' ? (trajetoriaEscolar || undefined) : undefined,
      aprendizagem: natureza === 'Fundamental' ? (aprendizagem || undefined) : undefined,
      envolvimentoAutonomia: natureza === 'Fundamental' ? (envolvimentoAutonomia || undefined) : undefined,
      convivenciaRelacoes: natureza === 'Fundamental' ? (convivenciaRelacoes || undefined) : undefined,
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
          <h2 className="text-lg font-bold font-display text-brand-green-dark">Ficha de Anamnese recebida!</h2>
          <p className="text-sm text-slate-600">
            Obrigado por compartilhar essas informações sobre <strong>{student.nome}</strong>. Isso ajuda muito a
            equipe pedagógica a conhecê-lo(a) melhor.
          </p>
        </motion.div>
      </div>
    );
  }

  const textareaClass = "w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none";

  return (
    <div className="min-h-screen bg-slate-100 font-sans py-8 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

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
            <NotebookPen size={14} /> Ficha de Anamnese — {natureza}
          </p>
          <p className="text-[11px] text-emerald-100 mt-2 font-semibold">{student.nome}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <p className="text-xs text-slate-500">
            Essas informações ajudam a equipe pedagógica a conhecer melhor {student.nome} e apoiar seu desenvolvimento
            no dia a dia da escola. Pode responder com a profundidade que achar melhor.
          </p>

          {natureza === 'Infantil' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Gestação e parto (como foram, algo relevante?)</label>
                <textarea rows={2} value={gestacaoParto} onChange={(e) => setGestacaoParto(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Desenvolvimento motor e da linguagem (andou/falou quando, como foi)</label>
                <textarea rows={2} value={desenvolvimentoMotorLinguagem} onChange={(e) => setDesenvolvimentoMotorLinguagem(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Hábitos de sono (dorme bem? soneca? algum ritual?)</label>
                <textarea rows={2} value={habitosSono} onChange={(e) => setHabitosSono(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Hábitos alimentares (come bem? seletivo? alguma preferência)</label>
                <textarea rows={2} value={habitosAlimentares} onChange={(e) => setHabitosAlimentares(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Autonomia nas atividades diárias (se veste, come, usa o banheiro sozinho?)</label>
                <textarea rows={2} value={autonomiaAtividadesDiarias} onChange={(e) => setAutonomiaAtividadesDiarias(e.target.value)} className={textareaClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Trajetória escolar (escolas anteriores, adaptações, como foi)</label>
                <textarea rows={2} value={trajetoriaEscolar} onChange={(e) => setTrajetoriaEscolar(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Aprendizagem (facilidades, dificuldades, ritmo)</label>
                <textarea rows={2} value={aprendizagem} onChange={(e) => setAprendizagem(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Envolvimento e autonomia (organização, iniciativa, responsabilidade)</label>
                <textarea rows={2} value={envolvimentoAutonomia} onChange={(e) => setEnvolvimentoAutonomia(e.target.value)} className={textareaClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Convivência e relações (com colegas, adultos, como se relaciona)</label>
                <textarea rows={2} value={convivenciaRelacoes} onChange={(e) => setConvivenciaRelacoes(e.target.value)} className={textareaClass} />
              </div>
            </div>
          )}

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Rotina familiar (como é o dia a dia em casa)</label>
              <textarea rows={2} value={rotinaFamiliar} onChange={(e) => setRotinaFamiliar(e.target.value)} className={textareaClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Interesses (do que gosta, brincadeiras, temas favoritos)</label>
              <textarea rows={2} value={interesses} onChange={(e) => setInteresses(e.target.value)} className={textareaClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Algo mais que a escola deva conhecer melhor?</label>
              <textarea rows={2} value={paraEscolaConhecerMelhor} onChange={(e) => setParaEscolaConhecerMelhor(e.target.value)} className={textareaClass} />
            </div>
          </div>

          {erro && <p className="text-xs font-bold text-rose-600 text-center">{erro}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-bold font-display uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Enviando...' : existingFicha ? 'Atualizar Ficha de Anamnese' : 'Enviar Ficha de Anamnese'}
          </button>
        </form>
      </div>
    </div>
  );
}
