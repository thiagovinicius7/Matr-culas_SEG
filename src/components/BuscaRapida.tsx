import React, { useState, useRef, useEffect } from 'react';
import { Student, Guardian, Enrollment, RegularClass } from '../types';
import { calculateAgeAtCutoff, getRegularClassForAgeDynamic } from '../data';
import { Search, FileText, Calculator, ClipboardList, X } from 'lucide-react';

interface BuscaRapidaProps {
  students: Student[];
  guardians: Guardian[];
  enrollments: Enrollment[];
  classPrices: RegularClass[];
  activeYear: number;
  onNavigateWithStudent: (tabId: string, studentId: string) => void;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca rápida de aluno ou responsável — fica no topo de todas as telas. */
export default function BuscaRapida({ students, guardians, enrollments, classPrices, activeYear, onNavigateWithStudent }: BuscaRapidaProps) {
  const [termo, setTermo] = useState('');
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (ev: MouseEvent) => { if (raiz.current && !raiz.current.contains(ev.target as Node)) setTermo(''); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const q = semAcento(termo.trim());
  const resultados = q
    ? students.filter(s => {
        if (semAcento(s.nome).includes(q)) return true;
        return guardians.some(g => g.alunoId === s.id && semAcento(g.nome || '').includes(q));
      }).slice(0, 6)
    : [];

  const ir = (aba: string, id: string) => { onNavigateWithStudent(aba, id); setTermo(''); };

  return (
    <div ref={raiz} className="relative w-full sm:w-72 lg:w-80" id="quick-student-search-panel">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Buscar aluno ou responsável…"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        className="w-full text-xs pl-8 pr-8 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:ring-1 focus:ring-brand-green-light focus:outline-none bg-white"
      />
      {termo && (
        <button onClick={() => setTermo('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Limpar busca">
          <X size={14} />
        </button>
      )}
      {q && (
        <div className="absolute z-50 top-full left-0 right-0 sm:left-auto sm:w-96 mt-1.5 border border-slate-200 rounded-lg shadow-lg overflow-hidden divide-y divide-slate-100 bg-white max-h-96 overflow-y-auto">
          {resultados.map(student => {
            const soContraturno = enrollments.some(e => e.alunoId === student.id && e.ano === activeYear && e.turmaRegularId === 'sem_regular');
            const idade = calculateAgeAtCutoff(student.nascimento, activeYear);
            const turma = soContraturno ? 'Somente Contraturno' : getRegularClassForAgeDynamic(idade, classPrices, activeYear).nome;
            return (
              <div key={student.id} className="p-3 space-y-1.5 hover:bg-slate-50/50 transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{student.nome}</h4>
                  <p className="text-[10px] text-slate-500">{idade} anos • Turma: <span className="font-semibold text-brand-green-dark">{turma}</span></p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => ir('students', student.id)} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer"><FileText size={11} />Ficha</button>
                  <button onClick={() => ir('negotiation', student.id)} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer"><Calculator size={11} />Calculadora</button>
                  <button onClick={() => ir('rematricula', student.id)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer"><ClipboardList size={11} />Lista de Trabalho</button>
                </div>
              </div>
            );
          })}
          {resultados.length === 0 && <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum aluno encontrado com "{termo}".</div>}
        </div>
      )}
    </div>
  );
}
