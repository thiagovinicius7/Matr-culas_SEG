import React, { useState, useMemo } from 'react';
import { Student, ContraturnoSegment, Enrollment, RegularClass, ContraturnoDailyException } from '../types';
import { Printer, CheckSquare, Search, Filter, ArrowUpDown, RotateCcw, X, Info, UserPlus, MoveRight } from 'lucide-react';
import { normalizeClassId, REGULAR_CLASSES } from '../data';

interface ContraturnoScheduleProps {
  students: Student[];
  contraturnos: ContraturnoSegment[];
  enrollments?: Enrollment[];
  classPrices?: RegularClass[];
  activeYear?: number;
  dailyExceptions?: ContraturnoDailyException[];
  onAddDailyException?: (exception: Omit<ContraturnoDailyException, 'id'>) => void;
  onRemoveDailyException?: (id: string) => void;
  onUpdateContraturnoNatureza?: (alunoId: string, segmentId: string, newNatureza: 'Melaço' | 'Marmelada') => void;
  onUpdateContraturnoDays?: (alunoId: string, segmentId: string, newDays: WeekDay[]) => void;
}

type WeekDay = 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex';

export default function ContraturnoSchedule({ 
  students, 
  contraturnos,
  enrollments = [],
  classPrices = [],
  activeYear = 2026,
  dailyExceptions = [],
  onAddDailyException,
  onRemoveDailyException,
  onUpdateContraturnoNatureza,
  onUpdateContraturnoDays
}: ContraturnoScheduleProps) {
  const [viewMode, setViewMode] = useState<'semanal' | 'mensal'>('semanal');
  const [dayViewMode, setDayViewMode] = useState<'semana' | 'dia'>('semana');
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);
  const [targetYear, setTargetYear] = useState<number>(activeYear === 2026 ? 2027 : activeYear);
  const [draggedInfo, setDraggedInfo] = useState<{ alunoId: string; origemDia: WeekDay } | null>(null);
  const [addingAvulsoForDay, setAddingAvulsoForDay] = useState<WeekDay | null>(null);
  const [avulsoNome, setAvulsoNome] = useState('');
  const [selectedDayForDayView, setSelectedDayForDayView] = useState<WeekDay>('Seg');

  // Data de referência (segunda-feira da semana sendo visualizada). As exceções
  // pontuais (mover, faltou, avulso) são amarradas a datas específicas — não
  // a dias da semana recorrentes — então precisamos saber a qual data real
  // cada coluna corresponde.
  const [referenceMonday, setReferenceMonday] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Dom, 1=Seg, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return monday.toISOString().split('T')[0];
  });

  const dayOffsets: Record<WeekDay, number> = { Seg: 0, Ter: 1, Qua: 2, Qui: 3, Sex: 4 };
  const dateForDay = (day: WeekDay): string => {
    const [y, m, d] = referenceMonday.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + dayOffsets[day]);
    return base.toISOString().split('T')[0];
  };
  const weekdayForDate = (dateStr: string): WeekDay | null => {
    for (const day of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as WeekDay[]) {
      if (dateForDay(day) === dateStr) return day;
    }
    return null;
  };

  // Filters state for Matriz Geral
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterNatureza, setFilterNatureza] = useState<string>('todas');
  const [filterTurma, setFilterTurma] = useState<string>('todas');
  const [filterDia, setFilterDia] = useState<string>('todos');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('todos');
  const [filterStatusMatricula, setFilterStatusMatricula] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'nome_asc' | 'nome_desc' | 'natureza' | 'turma' | 'valor'>('nome_asc');

  const daysOfWeek: WeekDay[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const dayNamesFull: Record<WeekDay, string> = {
    Seg: 'Segunda-feira',
    Ter: 'Terça-feira',
    Qua: 'Quarta-feira',
    Qui: 'Quinta-feira',
    Sex: 'Sexta-feira'
  };

  // 1) Deduplicate active contraturnos so each student appears at most ONCE (only active students)
  const activeContraturnos = useMemo(() => {
    const map = new Map<string, ContraturnoSegment>();
    contraturnos.forEach(c => {
      if (c.dataFim === null) {
        const student = students.find(s => s.id === c.alunoId);
        if (student && student.status === 'ativo') {
          map.set(c.alunoId, c);
        }
      }
    });
    return Array.from(map.values());
  }, [contraturnos, students]);

  // Helper to find student details
  const getStudentInfo = (alunoId: string) => students.find(s => s.id === alunoId);

  // Helper to find student enrollment in active year
  const getStudentEnrollment = (alunoId: string) => {
    return enrollments.find(e => e.alunoId === alunoId && e.ano === targetYear) || 
           enrollments.find(e => e.alunoId === alunoId && e.ano === activeYear) || 
           enrollments.find(e => e.alunoId === alunoId);
  };

  // Helper to accurately check if a student's enrollment/rematrícula is confirmed for the targetYear
  const isStudentConfirmedForYear = (alunoId: string, yearToCheck: number = targetYear): boolean => {
    // 1. Check direct enrollment record for yearToCheck
    const directEnrollment = enrollments.find(e => e.alunoId === alunoId && e.ano === yearToCheck);
    if (directEnrollment) {
      return directEnrollment.statusNegociacao === 'Confirmada';
    }

    // 2. If checking upcoming rematrícula cycle 2027 (when enrollment hasn't been rolled over yet)
    if (yearToCheck === 2027) {
      const prevEnrollment = enrollments.find(e => e.alunoId === alunoId && e.ano === 2026);
      if (prevEnrollment?.statusIntencao2027 === 'Confirmada') {
        return true;
      }
      return false; // Not confirmed for 2027 -> PENDING (yellow highlight)
    }

    // 3. If checking 2026 cycle
    if (yearToCheck === 2026) {
      const enr2026 = enrollments.find(e => e.alunoId === alunoId && e.ano === 2026);
      return enr2026?.statusNegociacao === 'Confirmada';
    }

    return false;
  };

  // Helper to find student regular class name
  const getStudentRegularClass = (alunoId: string) => {
    const enr = getStudentEnrollment(alunoId);
    if (!enr) return 'Sem Matrícula';
    if (enr.turmaRegularId === 'sem_regular') return 'Somente Contraturno';
    const cls = (classPrices.length > 0 ? classPrices : REGULAR_CLASSES).find(
      c => normalizeClassId(c.id) === normalizeClassId(enr.turmaRegularId)
    );
    return cls ? cls.nome : 'Outra';
  };

  // Horário de saída string
  const horarioSaida = (periodo: 'Parcial' | 'Completo') => periodo === 'Parcial' ? 'Saída 15h' : 'Saída 17h30';

  // Group active contraturnos by day of week, deduplicated and sorted A-Z by student name
  const getAttendeesForDay = (day: WeekDay) => {
    const date = dateForDay(day);
    const seenStudentIds = new Set<string>();
    const list = activeContraturnos
      .filter(c => c.diasSemana.includes(day))
      .map(c => {
        const student = getStudentInfo(c.alunoId);
        const confirmed = student ? isStudentConfirmedForYear(student.id, targetYear) : false;
        return { segment: c, student, isConfirmed: confirmed };
      })
      .filter((item): item is { segment: ContraturnoSegment; student: Student; isConfirmed: boolean } => {
        if (!item.student || seenStudentIds.has(item.student.id)) return false;
        seenStudentIds.add(item.student.id);
        return true;
      })
      .map(item => {
        // O aluno faltou nesta data específica (exceção pontual)?
        const faltou = dailyExceptions.some(e => e.tipo === 'faltou' && e.data === date && e.alunoId === item.student.id);
        // O aluno foi movido para OUTRO dia nesta mesma semana (saiu daqui)?
        const movidoParaOutroDia = dailyExceptions.find(e =>
          e.tipo === 'mover' && e.diaOrigemSemana === day && e.alunoId === item.student.id &&
          weekdayForDate(e.data) !== null && e.data !== date
        );
        return {
          ...item,
          exceptionStatus: faltou ? ('faltou' as const) : (movidoParaOutroDia ? ('movido_daqui' as const) : undefined),
          origemOuDestino: movidoParaOutroDia ? weekdayForDate(movidoParaOutroDia.data) ?? undefined : undefined,
        };
      });

    // Alunos que vieram de OUTRO dia para cá nesta data (exceção 'mover' com destino = esta data)
    const movidosParaCa = dailyExceptions
      .filter(e => e.tipo === 'mover' && e.data === date && e.alunoId && !list.some(l => l.student.id === e.alunoId))
      .map(e => {
        const student = getStudentInfo(e.alunoId!);
        if (!student) return null;
        const originalSegment = activeContraturnos.find(c => c.alunoId === e.alunoId);
        const segment: ContraturnoSegment = originalSegment || {
          id: `virtual_${e.id}`, alunoId: e.alunoId!, dataInicio: date, dataFim: null,
          natureza: 'Marmelada', diasSemana: [day], periodo: 'Completo', valorMensal: 0,
        };
        const confirmed = isStudentConfirmedForYear(student.id, targetYear);
        return {
          segment, student, isConfirmed: confirmed,
          exceptionStatus: 'movido_para_ca' as const,
          origemOuDestino: e.diaOrigemSemana,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Diárias avulsas (crianças de fora, ou alunos que não são desse dia) para esta data
    const avulsos = dailyExceptions
      .filter(e => e.tipo === 'avulso_diaria' && e.data === date)
      .map(e => {
        const student = e.alunoId ? getStudentInfo(e.alunoId) : null;
        const nome = student?.nome || e.nomeAvulso || 'Aluno avulso';
        const segment: ContraturnoSegment = {
          id: `avulso_${e.id}`, alunoId: e.alunoId || `avulso_${e.id}`, dataInicio: date, dataFim: null,
          natureza: 'Marmelada', diasSemana: [day], periodo: 'Completo', valorMensal: 0,
        };
        const fakeStudent: Student = student || {
          id: `avulso_${e.id}`, nome, nascimento: '', dataEntrada: date, observacoes: '', status: 'ativo',
        };
        return { segment, student: fakeStudent, isConfirmed: true, exceptionStatus: 'avulso' as const, origemOuDestino: undefined };
      });

    return [...list, ...movidosParaCa, ...avulsos].sort((a, b) => a.student.nome.localeCompare(b.student.nome, 'pt-BR'));
  };

  // Unique list of available regular classes for filtering
  const availableTurmas = useMemo(() => {
    const set = new Set<string>();
    activeContraturnos.forEach(c => {
      const regClass = getStudentRegularClass(c.alunoId);
      if (regClass) set.add(regClass);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [activeContraturnos, enrollments, classPrices]);

  // Filtered and sorted list for Matriz Geral
  const filteredAndSortedMatrix = useMemo(() => {
    return activeContraturnos
      .map(c => {
        const student = getStudentInfo(c.alunoId);
        const regularClass = getStudentRegularClass(c.alunoId);
        const isConfirmed = student ? isStudentConfirmedForYear(student.id, targetYear) : false;
        return { segment: c, student, regularClass, isConfirmed };
      })
      .filter((item): item is { segment: ContraturnoSegment; student: Student; regularClass: string; isConfirmed: boolean } => {
        if (!item.student) return false;

        // Search term
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          if (!item.student.nome.toLowerCase().includes(term)) return false;
        }

        // Natureza
        if (filterNatureza !== 'todas' && item.segment.natureza !== filterNatureza) {
          return false;
        }

        // Turma
        if (filterTurma !== 'todas' && item.regularClass !== filterTurma) {
          return false;
        }

        // Dia de semana
        if (filterDia !== 'todos' && !item.segment.diasSemana.includes(filterDia as WeekDay)) {
          return false;
        }

        // Período / Saída
        if (filterPeriodo !== 'todos' && item.segment.periodo !== filterPeriodo) {
          return false;
        }

        // Status Matrícula
        if (filterStatusMatricula === 'confirmada' && !item.isConfirmed) {
          return false;
        }
        if (filterStatusMatricula === 'pendente' && item.isConfirmed) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nome_asc') {
          return a.student.nome.localeCompare(b.student.nome, 'pt-BR');
        }
        if (sortBy === 'nome_desc') {
          return b.student.nome.localeCompare(a.student.nome, 'pt-BR');
        }
        if (sortBy === 'natureza') {
          return a.segment.natureza.localeCompare(b.segment.natureza);
        }
        if (sortBy === 'turma') {
          return a.regularClass.localeCompare(b.regularClass, 'pt-BR');
        }
        if (sortBy === 'valor') {
          return b.segment.valorMensal - a.segment.valorMensal;
        }
        return 0;
      });
  }, [activeContraturnos, students, enrollments, classPrices, targetYear, activeYear, searchTerm, filterNatureza, filterTurma, filterDia, filterPeriodo, filterStatusMatricula, sortBy]);

  const hasActiveFilters = searchTerm !== '' || filterNatureza !== 'todas' || filterTurma !== 'todas' || filterDia !== 'todos' || filterPeriodo !== 'todos' || filterStatusMatricula !== 'todas' || sortBy !== 'nome_asc';

  const resetFilters = () => {
    setSearchTerm('');
    setFilterNatureza('todas');
    setFilterTurma('todas');
    setFilterDia('todos');
    setFilterPeriodo('todos');
    setFilterStatusMatricula('todas');
    setSortBy('nome_asc');
  };

  // Print schedule helper
  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 300);
  };

  if (isPrintMode) {
    return (
      <div className="bg-white text-black min-h-screen font-sans" id="print-view">
        {/* Cabeçalho com identidade visual do Sítio-Escola Geranium */}
        <div className="flex items-center justify-between px-8 pt-6 pb-3">
          <img
            src="https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png"
            alt="Sítio-Escola Geranium"
            className="h-14 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="text-right">
            <h1 className="text-base font-bold uppercase tracking-wide text-brand-green-dark font-display">Escala de Contraturno</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {viewMode === 'semanal' ? 'Semana' : 'Matriz geral'} • Impresso em {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-brand-orange mx-8 rounded-full mb-5" />

        <div className="px-8 pb-8">

        {viewMode === 'semanal' ? (
          /* WEEKLY PRINT MATRIX */
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {daysOfWeek.map(day => {
                const allAttendees = getAttendeesForDay(day);
                // Impressão só mostra quem realmente estará presente: exclui quem
                // faltou ou foi movido para outro dia.
                const attendees = allAttendees.filter(a => a.exceptionStatus !== 'faltou' && a.exceptionStatus !== 'movido_daqui');
                const melaco = attendees.filter(a => a.segment.natureza === 'Melaço');
                const marmelada = attendees.filter(a => a.segment.natureza === 'Marmelada');

                return (
                  <div key={day} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-brand-green-dark text-white text-center py-1.5">
                      <h3 className="font-bold text-xs font-display">{dayNamesFull[day]}</h3>
                      <p className="text-[9px] font-mono opacity-80">{attendees.length} {attendees.length === 1 ? 'criança' : 'crianças'}</p>
                    </div>

                    <div className="p-2 space-y-3">
                      {/* Melaço group */}
                      <div className="space-y-0.5">
                        <h4 className="text-[9px] font-bold uppercase text-brand-orange border-b border-brand-orange/30 pb-0.5 mb-1">Melaço</h4>
                        {melaco.map(a => (
                          <div key={a.segment.id} className="text-[9.5px] leading-snug">
                            • {a.student?.nome}{a.segment.periodo === 'Parcial' ? ' *' : ''}
                            {a.exceptionStatus === 'movido_para_ca' && <span className="text-brand-orange font-semibold"> (veio de outro dia)</span>}
                            {a.exceptionStatus === 'avulso' && <span className="text-emerald-700 font-semibold"> (diária)</span>}
                          </div>
                        ))}
                        {melaco.length === 0 && <p className="text-[9px] italic text-slate-400">Ninguém</p>}
                      </div>

                      {/* Marmelada group */}
                      <div className="space-y-0.5">
                        <h4 className="text-[9px] font-bold uppercase text-brand-green-light border-b border-brand-green-light/30 pb-0.5 mb-1">Marmelada</h4>
                        {marmelada.map(a => (
                          <div key={a.segment.id} className="text-[9.5px] leading-snug">
                            • {a.student?.nome}{a.segment.periodo === 'Parcial' ? ' *' : ''}
                            {a.exceptionStatus === 'movido_para_ca' && <span className="text-brand-orange font-semibold"> (veio de outro dia)</span>}
                            {a.exceptionStatus === 'avulso' && <span className="text-emerald-700 font-semibold"> (diária)</span>}
                          </div>
                        ))}
                        {marmelada.length === 0 && <p className="text-[9px] italic text-slate-400">Ninguém</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] italic text-slate-500 mt-3">* Crianças com saída antecipada às 15h (Parcial). As demais saem às 17h30.</p>
          </div>
        ) : (
          /* MONTHLY MATRIX PRINT */
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-green-dark font-display">Matriz Geral do Contraturno</h2>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border border-slate-200 border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-[10px] font-bold font-mono">
                    <th className="p-2 border-r border-slate-300">Estudante</th>
                    <th className="p-2 border-r border-slate-300">Turma Regular</th>
                    <th className="p-2 border-r border-slate-300">Grupo</th>
                    <th className="p-2 border-r border-slate-300 text-center">Seg</th>
                    <th className="p-2 border-r border-slate-300 text-center">Ter</th>
                    <th className="p-2 border-r border-slate-300 text-center">Qua</th>
                    <th className="p-2 border-r border-slate-300 text-center">Qui</th>
                    <th className="p-2 border-r border-slate-300 text-center">Sex</th>
                    <th className="p-2 text-center">Saída</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-[10px]">
                  {filteredAndSortedMatrix.map(({ segment: c, student, regularClass }) => {
                    return (
                      <tr key={c.id}>
                        <td className="p-2 border-r border-slate-300 font-semibold">
                          {student.nome}{c.periodo === 'Parcial' ? ' *' : ''}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-slate-600">{regularClass}</td>
                        <td className="p-2 border-r border-slate-300">{c.natureza}</td>
                        {daysOfWeek.map(day => (
                          <td key={day} className="p-2 border-r border-slate-300 text-center font-mono">
                            {c.diasSemana.includes(day) ? 'X' : ''}
                          </td>
                        ))}
                        <td className="p-2 text-center font-medium">{horarioSaida(c.periodo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] italic text-slate-500 mt-2">* Crianças com saída antecipada às 15h (Parcial).</p>
          </div>
        )}

        </div>

        <div className="mx-8 h-1 bg-brand-green-dark rounded-full mb-2" />
        <p className="text-center text-[9px] text-slate-400 pb-6">
          Sítio-Escola Geranium • Núcleo Rural de Taguatinga, Chácara 29 • (61) 9876-3154 — documento de circulação interna
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="schedule-dashboard">
      {/* Header and print button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider font-display">
            Contraturno
          </h2>
          <p className="text-xs text-slate-500">
            Acompanhe a lista de alunos presentes por dia e emita relatórios amigáveis para impressão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('semanal')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                viewMode === 'semanal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Semanal (Diário)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mensal')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                viewMode === 'mensal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Matriz Geral
            </button>
          </div>

          {/* Print button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            title="Imprimir Escala do Contraturno"
          >
            <Printer size={13} />
            Imprimir
          </button>
        </div>
      </div>

      {/* Dynamic Views */}
      {viewMode === 'semanal' ? (
        <div className="space-y-3">
          {/* Legend Banner with Target Year selector */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <Info size={15} className="text-amber-600 shrink-0" />
                <span>
                  <strong className="text-amber-900 font-bold">* Asterisco (*):</strong> Crianças com saída antecipada às 15h (Parcial). As demais saem às 17h30.
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-200/90 px-2.5 py-1 rounded border border-amber-400/90 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-600 animate-pulse"></span>
                <span className="text-[11px] font-bold text-amber-950">
                  Amarelo: Matrícula / Rematrícula {targetYear} Pendente
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold text-slate-600">Verificar Ano:</span>
              <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTargetYear(2026)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                    targetYear === 2026 ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir status do ano letivo 2026"
                >
                  2026
                </button>
                <button
                  type="button"
                  onClick={() => setTargetYear(2027)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                    targetYear === 2027 ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir status das rematrículas para 2027"
                >
                  2027 (Rematrícula)
                </button>
              </div>
            </div>
          </div>

          {/* Navegador de semana — define a qual data cada coluna corresponde */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
            <button
              type="button"
              onClick={() => {
                const [y, m, d] = referenceMonday.split('-').map(Number);
                const prev = new Date(y, m - 1, d - 7);
                setReferenceMonday(prev.toISOString().split('T')[0]);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
            >
              ← Semana anterior
            </button>
            <span className="text-xs font-bold text-slate-700">
              Semana de {new Date(referenceMonday + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(dateForDay('Sex') + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <button
              type="button"
              onClick={() => {
                const [y, m, d] = referenceMonday.split('-').map(Number);
                const next = new Date(y, m - 1, d + 7);
                setReferenceMonday(next.toISOString().split('T')[0]);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
            >
              Próxima semana →
            </button>
          </div>

          {/* WEEKLY DIARY COLUMNS */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3" id="weekly-columns-container">
            {daysOfWeek.map((day) => {
              const attendees = getAttendeesForDay(day);
              const melaco = attendees.filter(a => a.segment.natureza === 'Melaço');
              const marmelada = attendees.filter(a => a.segment.natureza === 'Marmelada');

              return (
                <div 
                  key={day} 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedInfo && draggedInfo.origemDia !== day && onAddDailyException) {
                      onAddDailyException({
                        data: dateForDay(day),
                        tipo: 'mover',
                        alunoId: draggedInfo.alunoId,
                        diaOrigemSemana: draggedInfo.origemDia,
                      });
                    }
                    setDraggedInfo(null);
                  }}
                  className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-[380px]"
                >
                  <div className="p-3 bg-slate-50 border-b border-slate-200 text-center space-y-0.5">
                    <h4 className="font-sans font-bold text-slate-800 text-xs">{dayNamesFull[day]}</h4>
                    <span className="inline-block text-[9px] uppercase tracking-wide font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                      {attendees.length} {attendees.length === 1 ? 'aluno' : 'alunos'}
                    </span>
                  </div>

                  <div className="p-3 space-y-4 flex-1 divide-y divide-slate-150">
                    {/* Melaço block (under 4) */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-700 tracking-wider flex items-center justify-between bg-slate-100 px-2 py-0.5 rounded">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          Melaço (Até 4)
                        </span>
                        <span>({melaco.length})</span>
                      </span>
                      <div className="space-y-1.5">
                        {melaco.map((item) => {
                          const { segment, student, isConfirmed, exceptionStatus, origemOuDestino } = item;
                          return (
                          <div 
                            key={segment.id} 
                            draggable={exceptionStatus !== 'movido_daqui' && exceptionStatus !== 'avulso'}
                            onDragStart={() => setDraggedInfo({ alunoId: student.id, origemDia: day })}
                            className={`p-2 rounded-md transition-all flex flex-col gap-1 border cursor-grab active:cursor-grabbing ${
                              exceptionStatus === 'faltou' || exceptionStatus === 'movido_daqui'
                                ? 'opacity-40 border-slate-200 bg-slate-50'
                                : exceptionStatus === 'movido_para_ca'
                                  ? 'bg-amber-50 border-brand-orange ring-1 ring-orange-300'
                                  : exceptionStatus === 'avulso'
                                    ? 'bg-emerald-50 border-emerald-400'
                                    : !isConfirmed 
                                      ? 'bg-amber-100/90 border-amber-400 ring-1 ring-amber-400/70 shadow-2xs hover:bg-amber-100' 
                                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-bold text-[11px] block leading-tight ${exceptionStatus === 'faltou' || exceptionStatus === 'movido_daqui' ? 'line-through text-slate-400' : !isConfirmed ? 'text-amber-950' : 'text-slate-800'}`}>
                                {student?.nome}
                                {segment.periodo === 'Parcial' && (
                                  <span className="text-amber-600 font-extrabold ml-1" title="Saída às 15h (Parcial)">*</span>
                                )}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                {onRemoveDailyException && (exceptionStatus === 'movido_para_ca' || exceptionStatus === 'avulso') ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const exc = dailyExceptions.find(e =>
                                        (e.tipo === 'mover' && e.data === dateForDay(day) && e.alunoId === student.id) ||
                                        (e.tipo === 'avulso_diaria' && e.data === dateForDay(day) && (e.alunoId === student.id || segment.id === `avulso_${e.id}`))
                                      );
                                      if (exc) onRemoveDailyException(exc.id);
                                    }}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Remover exceção"
                                  >
                                    <X size={11} />
                                  </button>
                                ) : exceptionStatus !== 'movido_daqui' && onAddDailyException && (
                                  <button
                                    type="button"
                                    onClick={() => onAddDailyException({ data: dateForDay(day), tipo: 'faltou', alunoId: student.id })}
                                    className="text-slate-400 hover:text-amber-600 cursor-pointer"
                                    title="Marcar falta hoje"
                                  >
                                    <CheckSquare size={11} />
                                  </button>
                                )}
                                {onUpdateContraturnoNatureza && exceptionStatus !== 'movido_para_ca' && exceptionStatus !== 'avulso' && (
                                  <button
                                    type="button"
                                    onClick={() => onUpdateContraturnoNatureza(student.id, segment.id, segment.natureza === 'Melaço' ? 'Marmelada' : 'Melaço')}
                                    className="text-slate-400 hover:text-brand-orange cursor-pointer shrink-0"
                                    title={`Mover para ${segment.natureza === 'Melaço' ? 'Marmelada' : 'Melaço'}`}
                                  >
                                    <MoveRight size={11} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {exceptionStatus === 'faltou' && (
                              <span className="text-[8px] font-bold text-slate-500 uppercase">faltou hoje</span>
                            )}
                            {exceptionStatus === 'movido_daqui' && origemOuDestino && (
                              <span className="text-[8px] font-bold text-slate-500 uppercase">foi para {origemOuDestino}</span>
                            )}
                            {exceptionStatus === 'movido_para_ca' && (
                              <span className="text-[8px] font-bold text-brand-orange uppercase">veio de {origemOuDestino || '—'}</span>
                            )}
                            {exceptionStatus === 'avulso' && (
                              <span className="text-[8px] font-bold text-emerald-700 uppercase">diária · externo</span>
                            )}

                            {!exceptionStatus && !isConfirmed && (
                              <div className="flex items-center justify-between text-[9px] font-bold text-amber-900 pt-1 border-t border-amber-300/80">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                  Rematrícula {targetYear}
                                </span>
                                <span className="uppercase text-[8px] bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded font-extrabold border border-amber-400/80">
                                  Pendente
                                </span>
                              </div>
                            )}
                          </div>
                          );
                        })}
                        {melaco.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhum ativo.</p>
                        )}
                      </div>
                    </div>

                    {/* Marmelada block (5+) */}
                    <div className="space-y-1.5 pt-3">
                      <span className="text-[9px] uppercase font-bold text-slate-700 tracking-wider flex items-center justify-between bg-slate-100 px-2 py-0.5 rounded">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Marmelada (5+)
                        </span>
                        <span>({marmelada.length})</span>
                      </span>
                      <div className="space-y-1.5">
                        {marmelada.map((item) => {
                          const { segment, student, isConfirmed, exceptionStatus, origemOuDestino } = item;
                          return (
                          <div 
                            key={segment.id} 
                            draggable={exceptionStatus !== 'movido_daqui' && exceptionStatus !== 'avulso'}
                            onDragStart={() => setDraggedInfo({ alunoId: student.id, origemDia: day })}
                            className={`p-2 rounded-md transition-all flex flex-col gap-1 border cursor-grab active:cursor-grabbing ${
                              exceptionStatus === 'faltou' || exceptionStatus === 'movido_daqui'
                                ? 'opacity-40 border-slate-200 bg-slate-50'
                                : exceptionStatus === 'movido_para_ca'
                                  ? 'bg-amber-50 border-brand-orange ring-1 ring-orange-300'
                                  : exceptionStatus === 'avulso'
                                    ? 'bg-emerald-50 border-emerald-400'
                                    : !isConfirmed 
                                      ? 'bg-amber-100/90 border-amber-400 ring-1 ring-amber-400/70 shadow-2xs hover:bg-amber-100' 
                                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-bold text-[11px] block leading-tight ${exceptionStatus === 'faltou' || exceptionStatus === 'movido_daqui' ? 'line-through text-slate-400' : !isConfirmed ? 'text-amber-950' : 'text-slate-800'}`}>
                                {student?.nome}
                                {segment.periodo === 'Parcial' && (
                                  <span className="text-amber-600 font-extrabold ml-1" title="Saída às 15h (Parcial)">*</span>
                                )}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                {onRemoveDailyException && (exceptionStatus === 'movido_para_ca' || exceptionStatus === 'avulso') ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const exc = dailyExceptions.find(e =>
                                        (e.tipo === 'mover' && e.data === dateForDay(day) && e.alunoId === student.id) ||
                                        (e.tipo === 'avulso_diaria' && e.data === dateForDay(day) && (e.alunoId === student.id || segment.id === `avulso_${e.id}`))
                                      );
                                      if (exc) onRemoveDailyException(exc.id);
                                    }}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Remover exceção"
                                  >
                                    <X size={11} />
                                  </button>
                                ) : exceptionStatus !== 'movido_daqui' && onAddDailyException && (
                                  <button
                                    type="button"
                                    onClick={() => onAddDailyException({ data: dateForDay(day), tipo: 'faltou', alunoId: student.id })}
                                    className="text-slate-400 hover:text-amber-600 cursor-pointer"
                                    title="Marcar falta hoje"
                                  >
                                    <CheckSquare size={11} />
                                  </button>
                                )}
                                {onUpdateContraturnoNatureza && exceptionStatus !== 'movido_para_ca' && exceptionStatus !== 'avulso' && (
                                  <button
                                    type="button"
                                    onClick={() => onUpdateContraturnoNatureza(student.id, segment.id, segment.natureza === 'Melaço' ? 'Marmelada' : 'Melaço')}
                                    className="text-slate-400 hover:text-brand-orange cursor-pointer shrink-0"
                                    title={`Mover para ${segment.natureza === 'Melaço' ? 'Marmelada' : 'Melaço'}`}
                                  >
                                    <MoveRight size={11} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {exceptionStatus === 'faltou' && (
                              <span className="text-[8px] font-bold text-slate-500 uppercase">faltou hoje</span>
                            )}
                            {exceptionStatus === 'movido_daqui' && origemOuDestino && (
                              <span className="text-[8px] font-bold text-slate-500 uppercase">foi para {origemOuDestino}</span>
                            )}
                            {exceptionStatus === 'movido_para_ca' && (
                              <span className="text-[8px] font-bold text-brand-orange uppercase">veio de {origemOuDestino || '—'}</span>
                            )}
                            {exceptionStatus === 'avulso' && (
                              <span className="text-[8px] font-bold text-emerald-700 uppercase">diária · externo</span>
                            )}

                            {!exceptionStatus && !isConfirmed && (
                              <div className="flex items-center justify-between text-[9px] font-bold text-amber-900 pt-1 border-t border-amber-300/80">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                  Rematrícula {targetYear}
                                </span>
                                <span className="uppercase text-[8px] bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded font-extrabold border border-amber-400/80">
                                  Pendente
                                </span>
                              </div>
                            )}
                          </div>
                          );
                        })}
                        {marmelada.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhum ativo.</p>
                        )}
                      </div>
                    </div>

                    {/* Adicionar nome avulso (diária) para este dia */}
                    {onAddDailyException && (
                      <div className="pt-3">
                        {addingAvulsoForDay === day ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!avulsoNome.trim()) return;
                              onAddDailyException({ data: dateForDay(day), tipo: 'avulso_diaria', nomeAvulso: avulsoNome.trim() });
                              setAvulsoNome('');
                              setAddingAvulsoForDay(null);
                            }}
                            className="flex items-center gap-1"
                          >
                            <input
                              autoFocus
                              type="text"
                              value={avulsoNome}
                              onChange={(e) => setAvulsoNome(e.target.value)}
                              placeholder="Nome da criança"
                              className="flex-1 text-[10px] px-2 py-1 rounded-md border border-slate-200"
                            />
                            <button type="submit" className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md px-2 py-1 cursor-pointer">OK</button>
                            <button type="button" onClick={() => { setAddingAvulsoForDay(null); setAvulsoNome(''); }} className="text-[10px] text-slate-400 px-1 cursor-pointer">✕</button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingAvulsoForDay(day)}
                            className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 border border-dashed border-slate-300 rounded-md py-1.5 hover:bg-slate-50 cursor-pointer"
                          >
                            <UserPlus size={11} /> Adicionar avulso
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* GENERAL MATRIX / CHECKLIST VIEW WITH ADVANCED FILTERS */
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden" id="matrix-checklist-view">
          {/* Header */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <CheckSquare size={14} className="text-orange-500" />
                Matriz Geral de Presenças do Contraturno
              </h3>
              <p className="text-[10px] text-slate-500">Grade completa de presenças, turmas e opções de filtragem</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
              Exibindo {filteredAndSortedMatrix.length} de {activeContraturnos.length} alunos
            </span>
          </div>

          {/* FILTER TOOLBAR */}
          <div className="p-3 bg-slate-100/70 border-b border-slate-200 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {/* Search by name */}
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar aluno por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-800"
                />
                {searchTerm && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter by Turma Regular */}
              <div>
                <select
                  value={filterTurma}
                  onChange={(e) => setFilterTurma(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-800 font-medium"
                >
                  <option value="todas">Todas as Turmas Regulares</option>
                  {availableTurmas.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Contraturno Natureza */}
              <div>
                <select
                  value={filterNatureza}
                  onChange={(e) => setFilterNatureza(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-800 font-medium"
                >
                  <option value="todas">Todos os Grupos</option>
                  <option value="Melaço">Melaço (Até 4)</option>
                  <option value="Marmelada">Marmelada (5+)</option>
                </select>
              </div>

              {/* Filter by Day */}
              <div>
                <select
                  value={filterDia}
                  onChange={(e) => setFilterDia(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-800 font-medium"
                >
                  <option value="todos">Todos os Dias</option>
                  <option value="Seg">Segunda-feira</option>
                  <option value="Ter">Terça-feira</option>
                  <option value="Qua">Quarta-feira</option>
                  <option value="Qui">Quinta-feira</option>
                  <option value="Sex">Sexta-feira</option>
                </select>
              </div>

              {/* Filter by Status Matrícula */}
              <div>
                <select
                  value={filterStatusMatricula}
                  onChange={(e) => setFilterStatusMatricula(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-slate-800 font-medium"
                >
                  <option value="todas">Status Matrícula ({targetYear})</option>
                  <option value="confirmada">✓ Apenas Confirmadas</option>
                  <option value="pendente">⏳ Apenas Pendentes</option>
                </select>
              </div>

              {/* Sort selector */}
              <div>
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-1">
                  <ArrowUpDown size={12} className="text-slate-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="nome_asc">Nome (A - Z)</option>
                    <option value="nome_desc">Nome (Z - A)</option>
                    <option value="turma">Por Turma Regular</option>
                    <option value="natureza">Por Grupo Contraturno</option>
                    <option value="valor">Por Valor Mensal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Clear filters trigger if active */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Filter size={11} className="text-orange-500" />
                  Filtros ativos no momento
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-orange-600 hover:text-orange-800 text-[11px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Estudante</th>
                  <th className="p-3">Status ({targetYear})</th>
                  <th className="p-3">Turma Regular</th>
                  <th className="p-3">Grupo Contraturno</th>
                  {daysOfWeek.map(day => (
                    <th key={day} className="p-3 text-center">{day}</th>
                  ))}
                  <th className="p-3 text-center">Frequência</th>
                  <th className="p-3 text-center">Saída</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                {filteredAndSortedMatrix.map(({ segment: c, student, regularClass, isConfirmed }) => {
                  return (
                    <tr 
                      key={c.id} 
                      className={`transition-colors ${
                        !isConfirmed ? 'bg-amber-100/40 hover:bg-amber-100/70' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="p-3 font-bold text-slate-800">
                        {student.nome}
                        {c.periodo === 'Parcial' && (
                          <span className="text-amber-600 font-extrabold ml-1" title="Saída às 15h (Parcial)">*</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Confirmada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-400">
                            ⏳ Rematrícula {targetYear} Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
                          {regularClass}
                        </span>
                      </td>
                      <td className="p-3">
                        {onUpdateContraturnoNatureza ? (
                          <select
                            value={c.natureza}
                            onChange={(e) => onUpdateContraturnoNatureza(student.id, c.id, e.target.value as 'Melaço' | 'Marmelada')}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer focus:outline-none ${
                              c.natureza === 'Melaço' 
                                ? 'bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-200' 
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                            }`}
                            title="Clique para alterar a turma do contraturno"
                          >
                            <option value="Melaço">Melaço (Até 4)</option>
                            <option value="Marmelada">Marmelada (5+)</option>
                          </select>
                        ) : (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            c.natureza === 'Melaço' ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {c.natureza}
                          </span>
                        )}
                      </td>
                      {daysOfWeek.map(day => {
                        const attends = c.diasSemana.includes(day);
                        return (
                          <td key={day} className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (!onUpdateContraturnoDays) return;
                                const current = c.diasSemana || [];
                                let updatedDays: WeekDay[];
                                if (current.includes(day)) {
                                  if (current.length === 1) return; // Keep at least 1 day
                                  updatedDays = current.filter(d => d !== day);
                                } else {
                                  updatedDays = [...current, day];
                                }
                                const sortedDays = daysOfWeek.filter(d => updatedDays.includes(d));
                                onUpdateContraturnoDays(student.id, c.id, sortedDays);
                              }}
                              disabled={!onUpdateContraturnoDays}
                              title={onUpdateContraturnoDays ? (attends ? `Clique para remover ${day}` : `Clique para incluir ${day}`) : undefined}
                              className={`w-6 h-6 rounded inline-flex items-center justify-center font-bold text-xs transition-all ${
                                onUpdateContraturnoDays ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                              } ${
                                attends 
                                  ? 'bg-emerald-600 text-white border border-emerald-600 shadow-2xs hover:bg-emerald-700' 
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200 hover:text-slate-600'
                              }`}
                            >
                              {attends ? '✓' : '•'}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold text-slate-500 text-[11px]">{c.diasSemana.length}x / sem</td>
                      <td className="p-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {horarioSaida(c.periodo)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredAndSortedMatrix.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-slate-400 space-y-2">
                      <p className="font-semibold text-sm">Nenhum aluno encontrado com os filtros selecionados.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <RotateCcw size={12} />
                          Limpar Filtros
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
