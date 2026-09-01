import React, { useState, useEffect, useRef } from 'react';
import { Student, Guardian, Enrollment, ContraturnoSegment, FinancialMovement, RegularClass, ContraturnoPrice, EstadoCivil, NegotiationHistoryEntry } from '../types';
import { REGULAR_CLASSES, calculateAgeAtCutoff, getRegularClassForAge, normalizeClassId, getFaseProcesso } from '../data';
import { User, Phone, Shield, Plus, Edit2, Trash2, Calendar, FileText, Check, X, AlertCircle, FileImage, Calculator, Lock, Ban, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import CartaIntencaoForm from './CartaIntencaoForm';
import NegotiationCalc from './NegotiationCalc';

interface StudentProfileProps {
  students: Student[];
  guardians: Guardian[];
  enrollments: Enrollment[];
  contraturnos: ContraturnoSegment[];
  movements: FinancialMovement[];
  negotiationHistory?: NegotiationHistoryEntry[];
  classPrices: RegularClass[];
  contraturnoPrices?: ContraturnoPrice[];
  activeYear?: number;
  selectedStudentId?: string;
  onSelectStudent?: (id: string) => void;
  onNavigateWithStudent?: (tabId: string, studentId: string) => void;
  onAddStudent: (student: Student, guardiansList: Omit<Guardian, 'id' | 'alunoId'>[], somenteContraturno?: boolean) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onAddGuardian: (guardian: Omit<Guardian, 'id'>) => void;
  onDeleteGuardian: (id: string) => void;
  onUpdateGuardian: (guardian: Guardian) => void;
  onUpdateEnrollmentClass: (alunoId: string, turmaRegularId: string) => void;
  onUpdateContraturnoNatureza?: (alunoId: string, segmentId: string, newNatureza: 'Melaço' | 'Marmelada') => void;
  onUpdateContraturnoDays?: (alunoId: string, segmentId: string, newDays: ('Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex')[]) => void;
  onSaveEnrollment?: (updatedEnrollment: Enrollment, logMovement?: boolean) => void;
  onConfirmNegotiation?: (
    alunoId: string,
    enrollmentData: Omit<Enrollment, 'id' | 'alunoId'>,
    contraturnoData: Omit<ContraturnoSegment, 'id' | 'alunoId'> | null
  ) => void;
}

export default function StudentProfile({
  students,
  guardians,
  enrollments,
  contraturnos,
  movements,
  negotiationHistory = [],
  classPrices,
  contraturnoPrices = [],
  activeYear = 2026,
  selectedStudentId: propSelectedStudentId,
  onSelectStudent,
  onNavigateWithStudent,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddGuardian,
  onDeleteGuardian,
  onUpdateGuardian,
  onUpdateEnrollmentClass,
  onUpdateContraturnoNatureza,
  onUpdateContraturnoDays,
  onSaveEnrollment,
  onConfirmNegotiation
}: StudentProfileProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(propSelectedStudentId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'trancado' | 'cancelado' | 'todos'>('ativo');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [showCartaModal, setShowCartaModal] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'visao_geral' | 'responsaveis' | 'financeiro' | 'contraturno' | 'matricula'>('visao_geral');

  useEffect(() => {
    // Ao trocar de aluno, sempre volta para a primeira aba — evita mostrar
    // a aba "Matrícula" de um aluno anterior por engano.
    setProfileTab('visao_geral');
  }, [selectedStudentId]);

  useEffect(() => {
    // Sincroniza com o valor vindo de fora (App.tsx) — inclusive para LIMPAR
    // a seleção (string vazia), não só para trocar de aluno. Sem isso, um
    // clique em "ver todos" nunca conseguia voltar para a tela de busca
    // quando a ficha de outro aluno já estava aberta.
    setSelectedStudentId(propSelectedStudentId || '');
  }, [propSelectedStudentId]);

  // Form states for new/editing student
  const [formNome, setFormNome] = useState('');
  const [formNascimento, setFormNascimento] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formStatus, setFormStatus] = useState<'ativo' | 'trancado' | 'cancelado' | 'inativo'>('ativo');
  const [formSomenteContraturno, setFormSomenteContraturno] = useState(false);
  const [formCpf, setFormCpf] = useState('');
  const [formComoConheceuEscola, setFormComoConheceuEscola] = useState('');
  const [formAutorizadosBuscar, setFormAutorizadosBuscar] = useState('');
  
  // Guardians list during student creation
  const [tempGuardians, setTempGuardians] = useState<Omit<Guardian, 'id' | 'alunoId'>[]>([
    { nome: '', parentesco: 'Mãe', telefone: '', financeiro: true }
  ]);

  // Form state for adding single guardian to existing student
  const [newGuardianNome, setNewGuardianNome] = useState('');
  const [newGuardianParentesco, setNewGuardianParentesco] = useState('Mãe');
  const [newGuardianParentescoOutro, setNewGuardianParentescoOutro] = useState('');
  const [newGuardianContato, setNewGuardianContato] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');
  const [newGuardianCpf, setNewGuardianCpf] = useState('');
  const [newGuardianRg, setNewGuardianRg] = useState('');
  const [newGuardianEndereco, setNewGuardianEndereco] = useState('');
  const [newGuardianDataNascimento, setNewGuardianDataNascimento] = useState('');
  const [newGuardianEstadoCivil, setNewGuardianEstadoCivil] = useState<EstadoCivil | ''>('');
  const [newGuardianFinanceiro, setNewGuardianFinanceiro] = useState(false);
  const [isAddingSingleGuardian, setIsAddingSingleGuardian] = useState(false);

  // Guardian editing states
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editGuardianNome, setEditGuardianNome] = useState('');
  const [editGuardianParentesco, setEditGuardianParentesco] = useState('Mãe');
  const [editGuardianParentescoOutro, setEditGuardianParentescoOutro] = useState('');
  const [editGuardianContato, setEditGuardianContato] = useState('');
  const [editGuardianEmail, setEditGuardianEmail] = useState('');
  const [editGuardianCpf, setEditGuardianCpf] = useState('');
  const [editGuardianRg, setEditGuardianRg] = useState('');
  const [editGuardianEndereco, setEditGuardianEndereco] = useState('');
  const [editGuardianDataNascimento, setEditGuardianDataNascimento] = useState('');
  const [editGuardianEstadoCivil, setEditGuardianEstadoCivil] = useState<EstadoCivil | ''>('');
  const [editGuardianFinanceiro, setEditGuardianFinanceiro] = useState(false);

  // Class override states
  const [isOverridingClass, setIsOverridingClass] = useState(false);
  const [overrideClassId, setOverrideClassId] = useState('');

  // Vínculo de irmãos
  const [isLinkingSibling, setIsLinkingSibling] = useState(false);
  const [siblingSearchQuery, setSiblingSearchQuery] = useState('');

  const PARENTESCO_OPCOES = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio', 'Tia', 'Outro'];

  const startEditGuardian = (g: Guardian) => {
    setEditingGuardianId(g.id);
    setEditGuardianNome(g.nome);
    const parentescoConhecido = PARENTESCO_OPCOES.includes(g.parentesco) && g.parentesco !== 'Outro';
    setEditGuardianParentesco(parentescoConhecido ? g.parentesco : 'Outro');
    setEditGuardianParentescoOutro(parentescoConhecido ? '' : g.parentesco.replace(/^Outro:\s*/, ''));
    setEditGuardianContato(g.telefone || g.contato || '');
    setEditGuardianEmail(g.email || '');
    setEditGuardianCpf(g.cpf || '');
    setEditGuardianRg(g.rg || '');
    setEditGuardianEndereco(g.endereco || '');
    setEditGuardianDataNascimento(g.dataNascimento || '');
    setEditGuardianEstadoCivil(g.estadoCivil || '');
    setEditGuardianFinanceiro(g.financeiro);
  };

  const cancelEditGuardian = () => {
    setEditingGuardianId(null);
  };

  // Só um responsável por aluno pode ser financeiro por vez — marcar um novo
  // remove automaticamente o financeiro do(s) outro(s) responsável(is) do mesmo aluno.
  const setGuardianAsFinanceiro = (guardianId: string) => {
    activeGuardians.forEach(g => {
      if (g.id === guardianId && !g.financeiro) {
        onUpdateGuardian({ ...g, financeiro: true });
      } else if (g.id !== guardianId && g.financeiro) {
        onUpdateGuardian({ ...g, financeiro: false });
      }
    });
  };

  const handleSaveGuardianEdit = (e: React.FormEvent, guardianId: string) => {
    e.preventDefault();
    if (!editGuardianNome.trim() || !editGuardianContato.trim()) {
      alert('Preencha o nome e o telefone do responsável.');
      return;
    }
    onUpdateGuardian({
      id: guardianId,
      alunoId: selectedStudentId,
      nome: editGuardianNome,
      parentesco: editGuardianParentesco === 'Outro' ? `Outro: ${editGuardianParentescoOutro}` : editGuardianParentesco,
      telefone: editGuardianContato,
      email: editGuardianEmail || undefined,
      cpf: editGuardianCpf || undefined,
      rg: editGuardianRg || undefined,
      endereco: editGuardianEndereco || undefined,
      dataNascimento: editGuardianDataNascimento || undefined,
      estadoCivil: editGuardianEstadoCivil || undefined,
      financeiro: editGuardianFinanceiro
    });
    setEditingGuardianId(null);
  };

  // Selected student computation
  const activeStudent = students.find(s => s.id === selectedStudentId);
  const activeGuardians = guardians.filter(g => g.alunoId === selectedStudentId);
  const activeGuardian = activeGuardians.find(g => g.financeiro) || activeGuardians[0];
  const activeEnrollments = enrollments.filter(e => e.alunoId === selectedStudentId);
  const activeEnrollment = activeEnrollments.find(e => e.ano === 2026) || activeEnrollments[0];
  const activeContraturnos = contraturnos.filter(c => c.alunoId === selectedStudentId);
  const activeContraturno = activeContraturnos.find(c => c.dataFim === null) || activeContraturnos[0];
  const activeMovements = movements.filter(m => m.alunoId === selectedStudentId).sort((a,b) => b.data.localeCompare(a.data));

  // Irmãos matriculados na escola (aba Visão Geral)
  const siblingStudents = (activeStudent?.irmaosIds || [])
    .map(id => students.find(s => s.id === id))
    .filter((s): s is Student => !!s);

  const siblingSearchResults = siblingSearchQuery.trim().length > 0
    ? students.filter(s =>
        s.id !== activeStudent?.id &&
        !(activeStudent?.irmaosIds || []).includes(s.id) &&
        s.nome.toLowerCase().includes(siblingSearchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const linkSibling = (otherId: string) => {
    if (!activeStudent) return;
    const otherStudent = students.find(s => s.id === otherId);
    if (!otherStudent) return;

    onUpdateStudent({
      ...activeStudent,
      irmaosIds: Array.from(new Set([...(activeStudent.irmaosIds || []), otherId])),
    });
    onUpdateStudent({
      ...otherStudent,
      irmaosIds: Array.from(new Set([...(otherStudent.irmaosIds || []), activeStudent.id])),
    });
    setSiblingSearchQuery('');
    setIsLinkingSibling(false);
  };

  const unlinkSibling = (otherId: string) => {
    if (!activeStudent) return;
    const otherStudent = students.find(s => s.id === otherId);

    onUpdateStudent({
      ...activeStudent,
      irmaosIds: (activeStudent.irmaosIds || []).filter(id => id !== otherId),
    });
    if (otherStudent) {
      onUpdateStudent({
        ...otherStudent,
        irmaosIds: (otherStudent.irmaosIds || []).filter(id => id !== activeStudent.id),
      });
    }
  };

  // Enrollment do ano ativo (usado na trilha da aba "Matrícula [ano]")
  const currentYearEnrollment = activeEnrollments.find(e => e.ano === activeYear);
  const currentYearFase = currentYearEnrollment ? getFaseProcesso(currentYearEnrollment) : null;
  const emProcessoDeMatricula = !!currentYearEnrollment && currentYearFase !== 'colheita';

  const faseLabels: Record<NonNullable<Enrollment['faseProcesso']>, { label: string; emoji: string }> = {
    preparo_terra: { label: 'Preparo da Terra', emoji: '🌾' },
    semeadura: { label: 'Semeadura', emoji: '🌱' },
    enraizamento: { label: 'Enraizamento', emoji: '🌿' },
    florescer: { label: 'Florescer', emoji: '🌸' },
    colheita: { label: 'Colheita', emoji: '🌾' },
  };
  const faseOrderList: (keyof typeof faseLabels)[] = ['preparo_terra', 'semeadura', 'enraizamento', 'florescer', 'colheita'];

  const profileRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportImage = async () => {
    if (!profileRef.current || !activeStudent) return;
    setIsExporting(true);
    try {
      const element = profileRef.current;
      // Get the full un-scrolled dimensions of the card
      const originalWidth = element.scrollWidth;
      const originalHeight = element.scrollHeight;

      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: '#FDFBF7', // match brand-cream perfectly
        width: originalWidth,
        height: originalHeight,
        style: {
          padding: '24px',
          borderRadius: '12px',
          overflow: 'visible',
          height: 'auto',
          maxHeight: 'none',
        },
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `Ficha_${activeStudent.nome.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Erro ao gerar imagem da ficha:', error);
      alert('Não foi possível gerar a imagem da ficha.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintFicha = () => {
    window.print();
  };

  // Age calculations
  const currentAge = activeStudent ? calculateAgeAtCutoff(activeStudent.nascimento, 2026) : 0;
  const suggestedClass = activeStudent ? getRegularClassForAge(currentAge) : null;

  // Status counts
  const activeCount = students.filter(s => s.status === 'ativo').length;
  const trancadoCount = students.filter(s => s.status === 'trancado').length;
  const canceladoCount = students.filter(s => s.status === 'cancelado').length;

  // Filter student list
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.nome.toLowerCase().includes(searchQuery.trim().toLowerCase());
    if (!matchesSearch) return false;

    // If typing a search query, show all matching students regardless of tab filter so they can easily find them
    if (searchQuery.trim().length > 0) return true;

    if (statusFilter === 'ativo') return student.status === 'ativo';
    if (statusFilter === 'trancado') return student.status === 'trancado';
    if (statusFilter === 'cancelado') return student.status === 'cancelado';
    return true; // 'todos'
  });

  // Busca/navegação por turma (tela de "Alunos cadastrados")
  const [browseMode, setBrowseMode] = useState<'nome' | 'turma'>('nome');
  const [browseTurmaId, setBrowseTurmaId] = useState<string | null>(null);

  const turmaCatalog = classPrices.length > 0 ? classPrices : REGULAR_CLASSES;
  const turmaCounts = turmaCatalog.map(cls => {
    const count = filteredStudents.filter(st => {
      const age = calculateAgeAtCutoff(st.nascimento, activeYear);
      return normalizeClassId(getRegularClassForAge(age).id) === normalizeClassId(cls.id);
    }).length;
    return { ...cls, count };
  });

  const studentsInBrowseTurma = browseTurmaId
    ? filteredStudents.filter(st => {
        const age = calculateAgeAtCutoff(st.nascimento, activeYear);
        return normalizeClassId(getRegularClassForAge(age).id) === normalizeClassId(browseTurmaId);
      })
    : [];

  const studentsToList = browseMode === 'turma' && browseTurmaId ? studentsInBrowseTurma : filteredStudents;

  const backToBrowse = () => {
    setSelectedStudentId('');
    onSelectStudent?.('');
    setIsAddingStudent(false);
    setIsEditingStudent(false);
  };

  const startAddStudent = () => {
    setFormNome('');
    setFormNascimento('');
    setFormObservacoes('');
    setFormStatus('ativo');
    setFormSomenteContraturno(false);
    setFormCpf('');
    setFormComoConheceuEscola('');
    setFormAutorizadosBuscar('');
    setTempGuardians([{ nome: '', parentesco: 'Mãe', telefone: '', financeiro: true }]);
    setIsAddingStudent(true);
    setMobileDetailOpen(true);
  };

  const saveNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome || !formNascimento) {
      alert('Por favor, preencha o Nome e a Data de Nascimento.');
      return;
    }

    const newStudent: Student = {
      id: 'student_' + Date.now(),
      nome: formNome,
      nascimento: formNascimento,
      dataEntrada: new Date().toISOString().split('T')[0],
      observacoes: formObservacoes,
      status: formStatus,
      cpf: formCpf || undefined,
      comoConheceuEscola: formComoConheceuEscola || undefined,
      autorizadosBuscar: formAutorizadosBuscar || undefined
    };

    // Filter out incomplete guardians
    const validTempGuardians = tempGuardians.filter(g => g.nome.trim() !== '');
    if (validTempGuardians.length === 0) {
      alert('Por favor, preencha os dados de ao menos um responsável.');
      return;
    }

    // Ensure at least one financial guardian
    const hasFinancial = validTempGuardians.some(g => g.financeiro);
    if (!hasFinancial) {
      validTempGuardians[0].financeiro = true;
    }

    onAddStudent(newStudent, validTempGuardians, formSomenteContraturno);
    setSelectedStudentId(newStudent.id);
    setIsAddingStudent(false);
  };

  const startEditStudent = () => {
    if (!activeStudent) return;
    setFormNome(activeStudent.nome);
    setFormNascimento(activeStudent.nascimento);
    setFormObservacoes(activeStudent.observacoes);
    setFormStatus(activeStudent.status);
    setFormCpf(activeStudent.cpf || '');
    setFormComoConheceuEscola(activeStudent.comoConheceuEscola || '');
    setFormAutorizadosBuscar(activeStudent.autorizadosBuscar || '');
    setIsEditingStudent(true);
    setMobileDetailOpen(true);
  };

  const saveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    onUpdateStudent({
      ...activeStudent,
      nome: formNome,
      nascimento: formNascimento,
      observacoes: formObservacoes,
      status: formStatus,
      cpf: formCpf || undefined,
      comoConheceuEscola: formComoConheceuEscola || undefined,
      autorizadosBuscar: formAutorizadosBuscar || undefined
    });
    setIsEditingStudent(false);
  };

  const addTempGuardianRow = () => {
    setTempGuardians([...tempGuardians, { nome: '', parentesco: 'Outro', telefone: '', financeiro: false }]);
  };

  const updateTempGuardian = (index: number, field: keyof Omit<Guardian, 'id' | 'alunoId'>, value: any) => {
    const updated = [...tempGuardians];
    if (field === 'financeiro' && value === true) {
      // Toggle off financial on all other temp guardians
      updated.forEach((g, idx) => {
        g.financeiro = idx === index;
      });
    } else {
      updated[index] = { ...updated[index], [field]: value } as any;
    }
    setTempGuardians(updated);
  };

  const removeTempGuardianRow = (index: number) => {
    if (tempGuardians.length === 1) return;
    setTempGuardians(tempGuardians.filter((_, idx) => idx !== index));
  };

  const handleAddSingleGuardian = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuardianNome.trim()) return;

    onAddGuardian({
      alunoId: selectedStudentId,
      nome: newGuardianNome,
      parentesco: newGuardianParentesco === 'Outro' ? `Outro: ${newGuardianParentescoOutro}` : newGuardianParentesco,
      telefone: newGuardianContato,
      email: newGuardianEmail || undefined,
      cpf: newGuardianCpf || undefined,
      rg: newGuardianRg || undefined,
      endereco: newGuardianEndereco || undefined,
      dataNascimento: newGuardianDataNascimento || undefined,
      estadoCivil: newGuardianEstadoCivil || undefined,
      financeiro: newGuardianFinanceiro
    });

    setNewGuardianNome('');
    setNewGuardianParentesco('Mãe');
    setNewGuardianParentescoOutro('');
    setNewGuardianContato('');
    setNewGuardianEmail('');
    setNewGuardianCpf('');
    setNewGuardianRg('');
    setNewGuardianEndereco('');
    setNewGuardianDataNascimento('');
    setNewGuardianEstadoCivil('');
    setNewGuardianFinanceiro(false);
    setIsAddingSingleGuardian(false);
  };

  const showBrowsePanel = !activeStudent && !isAddingStudent && !isEditingStudent;

  return (
    <div id="student-ficha-root">
      {showBrowsePanel && (
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Alunos cadastrados</h3>
          <button
            onClick={startAddStudent}
            className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <Plus size={14} />
            Novo Aluno
          </button>
        </div>

        <div className="relative space-y-2">
          <input
            type="text"
            placeholder="Buscar por nome do aluno..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none bg-slate-50/50"
          />

          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('ativo')}
              className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                statusFilter === 'ativo' ? 'bg-white text-emerald-800 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('trancado')}
              className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                statusFilter === 'trancado' ? 'bg-white text-amber-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trancados ({trancadoCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cancelado')}
              className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                statusFilter === 'cancelado' ? 'bg-white text-rose-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancelados ({canceladoCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[10px] font-bold w-fit">
            <button
              type="button"
              onClick={() => { setBrowseMode('nome'); setBrowseTurmaId(null); }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                browseMode === 'nome' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por nome
            </button>
            <button
              type="button"
              onClick={() => setBrowseMode('turma')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                browseMode === 'turma' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por turma
            </button>
          </div>
        </div>

        {browseMode === 'turma' && !browseTurmaId ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {turmaCounts.map(cls => (
              <button
                key={cls.id}
                onClick={() => setBrowseTurmaId(cls.id)}
                className="p-3 rounded-lg border border-slate-200 hover:border-brand-green-light hover:bg-emerald-50/40 text-left transition-colors cursor-pointer"
              >
                <p className="text-xs font-bold text-slate-800">{cls.nome}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{cls.count} aluno{cls.count !== 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>
        ) : (
        <>
          {browseMode === 'turma' && browseTurmaId && (
            <button
              onClick={() => setBrowseTurmaId(null)}
              className="text-[11px] font-bold text-brand-orange hover:underline cursor-pointer"
            >
              ← todas as turmas
            </button>
          )}
          <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100 pr-1 space-y-1">
            {studentsToList.map((st) => {
              const isSelected = st.id === selectedStudentId;
              const bAge = calculateAgeAtCutoff(st.nascimento, activeYear);
              const bClass = getRegularClassForAge(bAge);
              return (
                <div
                  key={st.id}
                  className={`w-full rounded-lg transition-all border ${
                    isSelected ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        onSelectStudent?.(st.id);
                        setIsAddingStudent(false);
                        setIsEditingStudent(false);
                        setIsAddingSingleGuardian(false);
                      }}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <h4 className="font-bold text-xs text-slate-800 truncate">{st.nome}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {bAge} anos • <span className="text-slate-700 font-semibold">{bClass.nome}</span>
                      </p>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(st.id);
                          onSelectStudent?.(st.id);
                          setShowNegotiationModal(true);
                        }}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title={`Abrir Calculadora de Acordo para ${st.nome}`}
                      >
                        <Calculator size={12} className="text-amber-800" />
                        <span>Acordo</span>
                      </button>

                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        st.status === 'ativo' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : st.status === 'trancado' 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : st.status === 'cancelado' 
                          ? 'bg-rose-100 text-rose-900 border border-rose-300' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {st.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {studentsToList.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                {browseMode === 'turma' ? 'Nenhum aluno nesta turma.' : `Nenhum aluno encontrado com "${searchQuery}".`}
              </p>
            )}
          </div>
        </>
        )}
      </div>
      )}

      {/* Painel da ficha (aluno selecionado, novo cadastro ou edição) — ocupa a tela toda */}
      <div className={showBrowsePanel ? 'hidden' : ''}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={backToBrowse}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900"
          >
            ‹ Voltar para a lista
          </button>
          {!isAddingStudent && (
            <button
              onClick={startAddStudent}
              className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
            >
              <Plus size={14} />
              Novo Aluno
            </button>
          )}
        </div>
        <AnimatePresence mode="wait">
          {isAddingStudent ? (
            /* ADD NEW STUDENT FORM */
            <motion.div
              key="add-student"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Ficha de Matrícula: Novo Aluno</h3>
                <button
                  onClick={() => setIsAddingStudent(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveNewStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Nome do Aluno</label>
                    <input
                      type="text"
                      required
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      placeholder="Nome completo da criança"
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Data de Nascimento</label>
                    <input
                      type="date"
                      required
                      value={formNascimento}
                      onChange={(e) => setFormNascimento(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">A data de corte para determinação de turma é 31/03.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">CPF do aluno (opcional)</label>
                    <input
                      type="text"
                      value={formCpf}
                      onChange={(e) => setFormCpf(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Como conheceu a escola (opcional)</label>
                    <input
                      type="text"
                      value={formComoConheceuEscola}
                      onChange={(e) => setFormComoConheceuEscola(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Outras pessoas autorizadas a buscar (opcional)</label>
                  <input
                    type="text"
                    placeholder="Nomes separados por vírgula"
                    value={formAutorizadosBuscar}
                    onChange={(e) => setFormAutorizadosBuscar(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Modalidade de Matrícula Inicial</label>
                  <div className="flex flex-wrap gap-4 items-center">
                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="modalidadeMatricula"
                        checked={!formSomenteContraturno}
                        onChange={() => setFormSomenteContraturno(false)}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Ensino Regular (+ Contraturno opcional)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="modalidadeMatricula"
                        checked={formSomenteContraturno}
                        onChange={() => setFormSomenteContraturno(true)}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="font-bold text-orange-900 bg-orange-100/80 px-2 py-0.5 rounded border border-orange-200">
                        Somente Contraturno (sem Ensino Regular)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Observações de Saúde/Pedagógicas</label>
                  <textarea
                    rows={2}
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    placeholder="Restrições alimentares, alergias, cuidados médicos ou notas gerais"
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                {/* Subform: Guardians list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Responsáveis Familiares</h4>
                    <button
                      type="button"
                      onClick={addTempGuardianRow}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      Adicionar Responsável
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {tempGuardians.map((tg, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-md border border-slate-150 space-y-2 relative">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase pt-1">Responsável {idx + 1}</span>
                          <button
                            type="button"
                            disabled={tempGuardians.length === 1}
                            onClick={() => removeTempGuardianRow(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Nome</label>
                            <input
                              type="text"
                              required
                              placeholder="Nome do responsável"
                              value={tg.nome}
                              onChange={(e) => updateTempGuardian(idx, 'nome', e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Telefone / WhatsApp</label>
                            <input
                              type="text"
                              required
                              placeholder="(11) 99999-9999"
                              value={tg.telefone}
                              onChange={(e) => updateTempGuardian(idx, 'telefone', e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Parentesco</label>
                            <select
                              value={tg.parentesco}
                              onChange={(e) => updateTempGuardian(idx, 'parentesco', e.target.value)}
                              className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white"
                            >
                              {['Mãe', 'Pai', 'Avó', 'Avô', 'Tio', 'Tia', 'Outro'].map(op => <option key={op} value={op}>{op}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">E-mail</label>
                            <input
                              type="email"
                              value={tg.email || ''}
                              onChange={(e) => updateTempGuardian(idx, 'email', e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">CPF</label>
                            <input
                              type="text"
                              value={tg.cpf || ''}
                              onChange={(e) => updateTempGuardian(idx, 'cpf', e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">RG</label>
                            <input
                              type="text"
                              value={tg.rg || ''}
                              onChange={(e) => updateTempGuardian(idx, 'rg', e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Estado civil</label>
                            <select
                              value={tg.estadoCivil || ''}
                              onChange={(e) => updateTempGuardian(idx, 'estadoCivil', e.target.value)}
                              className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white"
                            >
                              <option value="">—</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União estável">União estável</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Endereço completo</label>
                          <input
                            type="text"
                            placeholder="Rua, número, bairro, cidade, CEP"
                            value={tg.endereco || ''}
                            onChange={(e) => updateTempGuardian(idx, 'endereco', e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <input
                            type="checkbox"
                            id={`fin-${idx}`}
                            checked={tg.financeiro}
                            onChange={(e) => updateTempGuardian(idx, 'financeiro', e.target.checked)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded"
                          />
                          <label htmlFor={`fin-${idx}`} className="text-xs text-slate-600 font-bold select-none cursor-pointer">Responsável financeiro</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => setIsAddingStudent(false)}
                    className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    Matricular Aluno
                  </button>
                </div>
              </form>
            </motion.div>
          ) : isEditingStudent && activeStudent ? (
            /* EDIT INDIVIDUAL STUDENT FORM */
            <motion.div
              key="edit-student"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Editar Aluno: {activeStudent.nome}</h3>
                <button
                  onClick={() => setIsEditingStudent(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveEditStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Nome do Aluno</label>
                    <input
                      type="text"
                      required
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Data de Nascimento</label>
                    <input
                      type="date"
                      required
                      value={formNascimento}
                      onChange={(e) => setFormNascimento(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Status Operacional</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none bg-white font-medium"
                    >
                      <option value="ativo">Ativo (Matriculado)</option>
                      <option value="trancado">Trancado (Matrícula Trancada)</option>
                      <option value="cancelado">Cancelado (Matrícula Cancelada)</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Data de Entrada</label>
                    <input
                      type="text"
                      disabled
                      value={new Date(activeStudent.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">CPF do aluno</label>
                    <input
                      type="text"
                      value={formCpf}
                      onChange={(e) => setFormCpf(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Como conheceu a escola</label>
                    <input
                      type="text"
                      value={formComoConheceuEscola}
                      onChange={(e) => setFormComoConheceuEscola(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Outras pessoas autorizadas a buscar</label>
                  <input
                    type="text"
                    placeholder="Nomes separados por vírgula"
                    value={formAutorizadosBuscar}
                    onChange={(e) => setFormAutorizadosBuscar(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Observações</label>
                  <textarea
                    rows={3}
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(false)}
                    className="px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          ) : activeStudent ? (
            /* COMPREHENSIVE STUDENT DETAILS (FICHA) */
            <motion.div
              key="student-ficha-details"
              ref={profileRef}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-4"
            >
              {/* Header Ficha card */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 flex gap-1">
                  <button
                    onClick={startEditStudent}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                    title="Editar ficha básica"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir o cadastro de ${activeStudent.nome}?`)) {
                        onDeleteStudent(activeStudent.id);
                        backToBrowse();
                      }
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                    title="Excluir cadastro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {activeStudent.status === 'trancado' && (
                  <div className="mb-4 bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-md flex items-center justify-between gap-3 text-amber-900 text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-amber-600 shrink-0" />
                      <div>
                        <strong className="font-bold block text-amber-900">Matrícula Trancada</strong>
                        <p className="text-[11px] text-amber-800">O aluno não aparece nas chamadas diárias, mas todo o seu histórico permanece gravado.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onUpdateStudent({ ...activeStudent, status: 'ativo' });
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <RefreshCw size={12} />
                      Reativar Matrícula
                    </button>
                  </div>
                )}

                {activeStudent.status === 'cancelado' && (
                  <div className="mb-4 bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-md flex items-center justify-between gap-3 text-rose-900 text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Ban size={16} className="text-rose-600 shrink-0" />
                      <div>
                        <strong className="font-bold block text-rose-900">Matrícula Cancelada</strong>
                        <p className="text-[11px] text-rose-800">Cadastro arquivado. Você pode reativá-lo a qualquer momento para restaurar o aluno.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onUpdateStudent({ ...activeStudent, status: 'ativo' });
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shrink-0 cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <RefreshCw size={12} />
                      Reativar Matrícula
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-lg uppercase shadow-xs border border-emerald-200">
                    {activeStudent.nome.charAt(0)}
                  </div>
                  <div className="space-y-1 pr-16">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{activeStudent.nome}</h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        activeStudent.status === 'ativo' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : activeStudent.status === 'trancado' 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : activeStudent.status === 'cancelado' 
                          ? 'bg-rose-100 text-rose-900 border border-rose-300' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {activeStudent.status === 'ativo' ? 'Ativo' : activeStudent.status === 'trancado' ? 'Trancado' : activeStudent.status === 'cancelado' ? 'Cancelado' : activeStudent.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>Nascimento: <strong className="font-bold">{new Date(activeStudent.nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
                      <span>•</span>
                      <span>Idade (Corte 31/03): <strong className="font-bold">{currentAge} anos</strong></span>
                    </p>

                    <p className="text-[10px] text-slate-400">
                      Inscrito no Sítio em: {new Date(activeStudent.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Direct Actions bar requested by user */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2" id="student-profile-actions-bar">
                  <button
                    onClick={() => setShowCartaModal(true)}
                    className="px-3.5 py-1.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-[11px] font-bold font-display uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Carta de Intenção de Rematrícula 2027"
                  >
                    <FileText size={13} />
                    Carta de Intenção 2027
                  </button>

                  <button
                    onClick={() => setShowNegotiationModal(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title={`Abrir Calculadora de Acordo para ${activeStudent.nome}`}
                  >
                    <Calculator size={13} />
                    Calculadora de Acordo
                  </button>

                  {activeStudent.status === 'ativo' ? (
                    <div className="relative">
                      <select
                        value=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'trancado' && confirm(`Deseja trancar a matrícula de ${activeStudent.nome}? Ele deixará de constar nas listas de chamada ativas.`)) {
                            onUpdateStudent({ ...activeStudent, status: 'trancado' });
                          } else if (value === 'cancelado' && confirm(`Deseja cancelar a matrícula de ${activeStudent.nome}?`)) {
                            onUpdateStudent({ ...activeStudent, status: 'cancelado' });
                          }
                          e.target.value = '';
                        }}
                        className="appearance-none pl-3 pr-7 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 text-[11px] font-bold rounded-md border border-rose-200 cursor-pointer"
                        title="Alterar status da matrícula"
                      >
                        <option value="" disabled>Alterar status...</option>
                        <option value="trancado">🔒 Trancar Matrícula</option>
                        <option value="cancelado">🚫 Cancelar Matrícula</option>
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onUpdateStudent({ ...activeStudent, status: 'ativo' });
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-300"
                    >
                      <CheckCircle size={13} />
                      Reativar Matrícula (Retornar)
                    </button>
                  )}
                  <button
                    onClick={handlePrintFicha}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText size={13} />
                    Salvar em PDF / Imprimir
                  </button>
                </div>

                {activeStudent.observacoes && (
                  <div className="mt-3 p-3 bg-orange-50/50 border border-orange-200 rounded-md text-xs text-slate-700">
                    <span className="font-bold text-orange-800 flex items-center gap-1.5 mb-0.5">
                      <AlertCircle size={14} /> Observações importantes
                    </span>
                    {activeStudent.observacoes}
                  </div>
                )}
              </div>

              {/* Barra de abas da ficha do aluno */}
              <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto border-b border-slate-200 px-1" id="student-profile-tabs">
                {([
                  { key: 'visao_geral', label: 'Visão Geral' },
                  { key: 'responsaveis', label: 'Responsáveis' },
                  { key: 'financeiro', label: 'Financeiro' },
                  { key: 'contraturno', label: 'Contraturno' },
                  ...(emProcessoDeMatricula ? [{ key: 'matricula', label: `Matrícula ${activeYear}` }] : []),
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key as typeof profileTab)}
                    className={`shrink-0 px-1.5 pb-2.5 pt-1 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                      profileTab === tab.key
                        ? (tab.key === 'matricula' ? 'border-brand-orange text-brand-orange' : 'border-brand-green-dark text-brand-green-dark')
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab.key === 'matricula' ? `🌿 ${tab.label}` : tab.label}
                  </button>
                ))}
              </div>

              {/* ===================== ABA: VISÃO GERAL ===================== */}
              {profileTab === 'visao_geral' && (
                <div className="space-y-4">
                  {emProcessoDeMatricula && currentYearEnrollment && (
                    <button
                      onClick={() => setProfileTab('matricula')}
                      className="w-full flex items-center justify-between bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-4 py-3 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-brand-clay">
                        {faseLabels[currentYearFase].emoji} Matrícula {activeYear} em {faseLabels[currentYearFase].label}
                      </span>
                      <span className="text-[10px] font-bold text-brand-orange">ver aba →</span>
                    </button>
                  )}

                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Dados do aluno</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">CPF</p>
                        <p className="font-semibold text-slate-800">{activeStudent.cpf || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Data de entrada</p>
                        <p className="font-semibold text-slate-800">{new Date(activeStudent.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Irmãos na escola</h4>
                      <button
                        onClick={() => setIsLinkingSibling(!isLinkingSibling)}
                        className="text-[10px] font-bold text-brand-orange hover:underline cursor-pointer"
                      >
                        {isLinkingSibling ? 'Cancelar' : '+ Vincular irmão'}
                      </button>
                    </div>

                    {isLinkingSibling && (
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          value={siblingSearchQuery}
                          onChange={(e) => setSiblingSearchQuery(e.target.value)}
                          placeholder="Buscar aluno pelo nome..."
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                        />
                        {siblingSearchResults.length > 0 && (
                          <div className="mt-1 border border-slate-150 rounded-md overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
                            {siblingSearchResults.map(s => (
                              <button
                                key={s.id}
                                onClick={() => linkSibling(s.id)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer"
                              >
                                {s.nome}
                              </button>
                            ))}
                          </div>
                        )}
                        {siblingSearchQuery.trim().length > 0 && siblingSearchResults.length === 0 && (
                          <p className="text-[10px] text-slate-400 mt-1 px-1">Nenhum aluno encontrado.</p>
                        )}
                      </div>
                    )}

                    {siblingStudents.length > 0 ? (
                      siblingStudents.map(sib => (
                        <div key={sib.id} className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center text-[10px] font-bold uppercase">
                              {sib.nome.split(' ').slice(0, 2).map(n => n[0]).join('')}
                            </div>
                            <span className="text-xs font-semibold text-slate-800">{sib.nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-brand-clay bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                              considerar no financeiro
                            </span>
                            <button
                              onClick={() => unlinkSibling(sib.id)}
                              className="text-slate-300 hover:text-rose-500 cursor-pointer"
                              title="Desvincular irmão"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      !isLinkingSibling && <p className="text-[11px] text-slate-400">Nenhum irmão vinculado.</p>
                    )}
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Contraturno</h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${activeContraturno ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                        {activeContraturno ? 'ativo' : 'sem contraturno'}
                      </span>
                    </div>
                    {activeContraturno ? (
                      <>
                        <div className="flex gap-1.5 flex-wrap">
                          {(['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const).map(dia => (
                            <span
                              key={dia}
                              className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                                activeContraturno.diasSemana.includes(dia)
                                  ? 'bg-emerald-50 text-emerald-900'
                                  : 'bg-slate-50 text-slate-300'
                              }`}
                            >
                              {dia}
                            </span>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs">
                          <div>
                            <p className="text-[10px] text-slate-400">Saída</p>
                            <p className="font-semibold text-slate-800">
                              {activeContraturno.periodo === 'Completo' ? '17h30 · completo' : '15h · parcial'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">Natureza</p>
                            <p className="font-semibold text-slate-800">{activeContraturno.natureza}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">Este aluno não está no contraturno atualmente.</p>
                    )}
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Origem e autorizações</h4>
                    <div>
                      <p className="text-[10px] text-slate-400">Como conheceu a escola</p>
                      <p className="text-xs font-semibold text-slate-800">{activeStudent.comoConheceuEscola || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Outras pessoas autorizadas a buscar</p>
                      <p className="text-xs font-semibold text-slate-800">{activeStudent.autorizadosBuscar || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================== ABA: RESPONSÁVEIS ===================== */}
              {profileTab === 'responsaveis' && (
              <div className="grid grid-cols-1 gap-4">
                {/* Guardians Ficha segment */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Responsáveis</h4>

                    <button
                      onClick={() => setIsAddingSingleGuardian(!isAddingSingleGuardian)}
                      className="text-xs text-orange-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      {isAddingSingleGuardian ? 'Cancelar' : '+ Adicionar'}
                    </button>
                  </div>

                  {isAddingSingleGuardian && (
                    <form onSubmit={handleAddSingleGuardian} className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={newGuardianNome}
                          onChange={(e) => setNewGuardianNome(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Parentesco</label>
                          <select
                            value={newGuardianParentesco}
                            onChange={(e) => setNewGuardianParentesco(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white bg-no-repeat"
                          >
                            {PARENTESCO_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>
                        </div>
                        {newGuardianParentesco === 'Outro' ? (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Especifique</label>
                            <input
                              type="text"
                              placeholder="ex: madrinha"
                              value={newGuardianParentescoOutro}
                              onChange={(e) => setNewGuardianParentescoOutro(e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">Data de nascimento</label>
                            <input
                              type="date"
                              value={newGuardianDataNascimento}
                              onChange={(e) => setNewGuardianDataNascimento(e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                            />
                          </div>
                        )}
                      </div>
                      {newGuardianParentesco === 'Outro' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Data de nascimento</label>
                          <input
                            type="date"
                            value={newGuardianDataNascimento}
                            onChange={(e) => setNewGuardianDataNascimento(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Telefone</label>
                          <input
                            type="text"
                            required
                            placeholder="(11) 99999-9999"
                            value={newGuardianContato}
                            onChange={(e) => setNewGuardianContato(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">E-mail</label>
                          <input
                            type="email"
                            value={newGuardianEmail}
                            onChange={(e) => setNewGuardianEmail(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">CPF</label>
                          <input
                            type="text"
                            value={newGuardianCpf}
                            onChange={(e) => setNewGuardianCpf(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">RG</label>
                          <input
                            type="text"
                            value={newGuardianRg}
                            onChange={(e) => setNewGuardianRg(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Estado civil</label>
                          <select
                            value={newGuardianEstadoCivil}
                            onChange={(e) => setNewGuardianEstadoCivil(e.target.value as EstadoCivil)}
                            className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white"
                          >
                            <option value="">—</option>
                            <option value="Solteiro(a)">Solteiro(a)</option>
                            <option value="Casado(a)">Casado(a)</option>
                            <option value="Divorciado(a)">Divorciado(a)</option>
                            <option value="Viúvo(a)">Viúvo(a)</option>
                            <option value="União estável">União estável</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Endereço completo</label>
                        <input
                          type="text"
                          placeholder="Rua, número, bairro, cidade, CEP"
                          value={newGuardianEndereco}
                          onChange={(e) => setNewGuardianEndereco(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="single-fin"
                          checked={newGuardianFinanceiro}
                          onChange={(e) => setNewGuardianFinanceiro(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-slate-500"
                        />
                        <label htmlFor="single-fin" className="text-xs text-slate-600 font-bold cursor-pointer">Responsável Financeiro</label>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-md transition-colors cursor-pointer"
                      >
                        Salvar Responsável
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {activeGuardians.map((g) => {
                      if (editingGuardianId === g.id) {
                        return (
                          <form 
                            key={g.id} 
                            onSubmit={(e) => handleSaveGuardianEdit(e, g.id)}
                            className="p-3 bg-slate-100 rounded-lg border border-orange-200 space-y-2 text-left"
                          >
                            <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">Editar Responsável</div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500">Nome</label>
                              <input
                                type="text"
                                required
                                value={editGuardianNome}
                                onChange={(e) => setEditGuardianNome(e.target.value)}
                                className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">Parentesco</label>
                                <select
                                  value={editGuardianParentesco}
                                  onChange={(e) => setEditGuardianParentesco(e.target.value)}
                                  className="w-full text-xs px-1.5 py-1 rounded-md border border-slate-300 bg-white"
                                >
                                  {PARENTESCO_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                              </div>
                              {editGuardianParentesco === 'Outro' ? (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-500">Especifique</label>
                                  <input
                                    type="text"
                                    value={editGuardianParentescoOutro}
                                    onChange={(e) => setEditGuardianParentescoOutro(e.target.value)}
                                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-500">Nascimento</label>
                                  <input
                                    type="date"
                                    value={editGuardianDataNascimento}
                                    onChange={(e) => setEditGuardianDataNascimento(e.target.value)}
                                    className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">Telefone</label>
                                <input
                                  type="text"
                                  required
                                  value={editGuardianContato}
                                  onChange={(e) => setEditGuardianContato(e.target.value)}
                                  className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">E-mail</label>
                                <input
                                  type="email"
                                  value={editGuardianEmail}
                                  onChange={(e) => setEditGuardianEmail(e.target.value)}
                                  className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">CPF</label>
                                <input
                                  type="text"
                                  value={editGuardianCpf}
                                  onChange={(e) => setEditGuardianCpf(e.target.value)}
                                  className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">RG</label>
                                <input
                                  type="text"
                                  value={editGuardianRg}
                                  onChange={(e) => setEditGuardianRg(e.target.value)}
                                  className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">Est. civil</label>
                                <select
                                  value={editGuardianEstadoCivil}
                                  onChange={(e) => setEditGuardianEstadoCivil(e.target.value as EstadoCivil)}
                                  className="w-full text-xs px-1 py-1 rounded-md border border-slate-300 bg-white"
                                >
                                  <option value="">—</option>
                                  <option value="Solteiro(a)">Solteiro(a)</option>
                                  <option value="Casado(a)">Casado(a)</option>
                                  <option value="Divorciado(a)">Divorciado(a)</option>
                                  <option value="Viúvo(a)">Viúvo(a)</option>
                                  <option value="União estável">União</option>
                                  <option value="Outro">Outro</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-500">Endereço</label>
                              <input
                                type="text"
                                value={editGuardianEndereco}
                                onChange={(e) => setEditGuardianEndereco(e.target.value)}
                                className="w-full text-xs px-2 py-1 rounded-md border border-slate-300 bg-white"
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  id={`edit-fin-${g.id}`}
                                  checked={editGuardianFinanceiro}
                                  onChange={(e) => setEditGuardianFinanceiro(e.target.checked)}
                                  className="w-3.5 h-3.5 text-emerald-600 rounded"
                                />
                                <label htmlFor={`edit-fin-${g.id}`} className="text-[11px] text-slate-700 font-bold cursor-pointer">Financeiro</label>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={cancelEditGuardian}
                                  className="px-2 py-1 border border-slate-300 text-[10px] font-bold text-slate-600 bg-white rounded-md hover:bg-slate-50"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-md"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div key={g.id} className={`p-3 rounded-lg border flex items-start justify-between gap-2 ${g.financeiro ? 'border-brand-clay bg-amber-50/40' : 'border-slate-100 hover:bg-slate-50 bg-slate-50'}`}>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-800">{g.nome}</span>
                              <span className="text-[10px] text-slate-500 font-semibold">({g.parentesco})</span>
                              {g.financeiro && (
                                <span className="text-[9px] bg-brand-clay text-white font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <Shield size={10} /> Responsável financeiro
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone size={12} className="text-slate-400" />
                              {g.telefone || g.contato || '—'}
                              {g.email && <span className="text-slate-400">• {g.email}</span>}
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                              {g.dataNascimento && <span>Nasc.: {new Date(g.dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                              {g.estadoCivil && <span>{g.estadoCivil}</span>}
                              {g.cpf && <span>CPF: {g.cpf}</span>}
                              {g.rg && <span>RG: {g.rg}</span>}
                            </div>
                            {g.endereco && (
                              <p className="text-[10px] text-slate-400">{g.endereco}</p>
                            )}
                            {!g.financeiro && (
                              <button
                                onClick={() => setGuardianAsFinanceiro(g.id)}
                                className="text-[10px] font-bold text-brand-clay border border-dashed border-brand-clay/50 rounded-md px-2 py-0.5 mt-1 hover:bg-amber-50 cursor-pointer"
                              >
                                tornar financeiro
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditGuardian(g)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer animate-none"
                              title="Editar responsável"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (activeGuardians.length === 1) {
                                  alert('O aluno precisa ter pelo menos 1 responsável cadastrado.');
                                  return;
                                }
                                if (g.financeiro) {
                                  alert('Escolha outro responsável financeiro antes de remover este.');
                                  return;
                                }
                                if (confirm(`Remover responsável ${g.nome}?`)) {
                                  onDeleteGuardian(g.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer animate-none"
                              title="Remover responsável"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}

              {/* ===================== ABA: FINANCEIRO ===================== */}
              {profileTab === 'financeiro' && (
              <div className="grid grid-cols-1 gap-4">
                {/* Enrollment Summary segment */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Matrícula Escolar Regular</h4>

                  {activeEnrollments.length > 0 ? (
                    activeEnrollments.map((e) => {
                      const isOnlyContraturno = e.turmaRegularId === 'sem_regular';
                      const regularClass = isOnlyContraturno 
                        ? null 
                        : (classPrices.find(rc => normalizeClassId(rc.id) === normalizeClassId(e.turmaRegularId)) || REGULAR_CLASSES.find(rc => normalizeClassId(rc.id) === normalizeClassId(e.turmaRegularId)) || suggestedClass);
                      const activeCont = activeContraturnos.find(c => c.dataFim === null);
                      const contraturnoVal = activeCont ? activeCont.valorMensal : 0;
                      const lancheVal = (e.adicionarLanche && regularClass?.natureza === 'Fundamental') ? (e.valorLanche || 0) : 0;
                      const almocoVal = e.adicionarAlmoco ? (e.valorAlmoco || 0) : 0;

                      const regularSubtotal = !isOnlyContraturno ? (e.valorFinalRegular + lancheVal) : 0;
                      const contraturnoSubtotal = contraturnoVal;
                      const almocoSubtotal = almocoVal;

                      const hasRegPont = e.descontoPontualidadeRegular !== undefined 
                        ? e.descontoPontualidadeRegular 
                        : (e.descontoPontualidade ?? false);
                      const hasContPont = e.descontoPontualidadeContraturno !== undefined 
                        ? e.descontoPontualidadeContraturno 
                        : false;

                      const pontualidadeRegVal = (hasRegPont && !isOnlyContraturno) ? Number((regularSubtotal * 0.03).toFixed(2)) : 0;
                      const pontualidadeContVal = (hasContPont && activeCont) ? Number((contraturnoSubtotal * 0.03).toFixed(2)) : 0;
                      const totalPontualidadeDisc = pontualidadeRegVal + pontualidadeContVal;

                      const totalBase = regularSubtotal + contraturnoSubtotal + almocoSubtotal;
                      const finalNetValue = totalBase - totalPontualidadeDisc;

                      return (
                        <div key={e.id} className="space-y-3" id="enrollment-summary">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-700">Turma de Matrícula</span>
                              {!isOverridingClass ? (
                                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                                  isOnlyContraturno 
                                    ? 'bg-amber-50 text-amber-900 border-amber-200' 
                                    : 'bg-white text-emerald-800 border-emerald-200'
                                }`}>
                                  {isOnlyContraturno ? 'Somente Contraturno (Isento do Regular)' : (regularClass?.nome || 'Nenhuma')}
                                </span>
                              ) : (
                                <select
                                  value={normalizeClassId(overrideClassId || e.turmaRegularId)}
                                  onChange={(evt) => setOverrideClassId(normalizeClassId(evt.target.value))}
                                  className="text-xs px-2 py-1 bg-white border border-slate-300 rounded-md focus:outline-none"
                                >
                                  <option value="sem_regular">Somente Contraturno (Isento do Regular)</option>
                                  {(classPrices.length > 0 ? classPrices : REGULAR_CLASSES).map((cls) => (
                                    <option key={cls.id} value={normalizeClassId(cls.id)}>
                                      {cls.nome} (R$ {cls.valorMensal})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center pt-1 border-t border-slate-100/60 mt-1">
                              <p className="text-[10px] text-slate-500">
                                {isOverridingClass ? 'Selecione a nova turma desejada para o aluno.' : 'Determinada automaticamente por idade (ou alterada manualmente).'}
                              </p>
                              {!isOverridingClass ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverrideClassId(e.turmaRegularId);
                                    setIsOverridingClass(true);
                                  }}
                                  className="text-[10px] font-bold text-orange-600 hover:underline flex items-center gap-0.5 bg-transparent border-0 cursor-pointer"
                                >
                                  Mudar Turma (Excepcional)
                                </button>
                              ) : (
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setIsOverridingClass(false)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateEnrollmentClass(activeStudent.id, overrideClassId);
                                      setIsOverridingClass(false);
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md"
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            {!isOnlyContraturno && (
                              <>
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>Valor Mensal Regular Base:</span>
                                  <span className="font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.valorRegularOriginal)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-rose-600">
                                  <span>Desconto Ensino Regular:</span>
                                  <span className="font-mono">-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.descontoMensal)}</span>
                                </div>
                              </>
                            )}
                            {activeCont && (
                              <div className="flex justify-between text-xs text-orange-800 font-medium">
                                <span>Contraturno Ativo ({activeCont.natureza}):</span>
                                <span className="font-mono">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeCont.valorMensal)}</span>
                              </div>
                            )}
                            {e.adicionarLanche && regularClass?.natureza === 'Fundamental' && (
                              <div className="flex justify-between text-xs text-orange-600 font-medium">
                                <span>Adicional Lanche (Fundamental):</span>
                                <span className="font-mono">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.valorLanche || 0)}</span>
                              </div>
                            )}
                            {e.adicionarAlmoco && (
                              <div className="flex justify-between text-xs text-amber-700 font-medium">
                                <span>Adicional Almoço (Contraturno):</span>
                                <span className="font-mono">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.valorAlmoco || 0)}</span>
                              </div>
                            )}
                            {pontualidadeRegVal > 0 && (
                              <div className="flex justify-between text-xs text-blue-600 font-medium">
                                <span>Pontualidade Ensino Regular (3%):</span>
                                <span className="font-mono">
                                  -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pontualidadeRegVal)}
                                </span>
                              </div>
                            )}
                            {pontualidadeContVal > 0 && (
                              <div className="flex justify-between text-xs text-blue-600 font-medium">
                                <span>Pontualidade Contraturno (3%):</span>
                                <span className="font-mono">
                                  -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pontualidadeContVal)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs font-bold text-slate-800 pt-1 border-t border-slate-100">
                              <span>{totalPontualidadeDisc > 0 ? 'Valor Final Líquido (Até Vencimento):' : 'Valor Final Mensal:'}</span>
                              <span className="font-mono text-slate-900">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalNetValue)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-slate-400">Negociação:</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              e.statusNegociacao === 'Confirmada' ? 'bg-emerald-100 text-emerald-800' :
                              e.statusNegociacao === 'Em Negociação' ? 'bg-orange-100 text-orange-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {e.statusNegociacao}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-505">Nenhuma matrícula registrada para 2026.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Vá até a aba de "Negociação" para criar uma matrícula.</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* ===================== ABA: CONTRATURNO ===================== */}
              {profileTab === 'contraturno' && (
              <div className="grid grid-cols-1 gap-4">
                {/* Contraturno segments */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Blocos de Vigência (Contraturno)</h4>

                  <div className="space-y-3">
                    {activeContraturnos.length > 0 ? (
                      activeContraturnos.map((c) => {
                        const isCurrentlyActive = c.dataFim === null;
                        return (
                          <div 
                            key={c.id} 
                            className={`p-3 rounded-lg border ${
                              isCurrentlyActive ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 border-slate-150'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-800">
                                  Contraturno:
                                </span>
                                {isCurrentlyActive && onUpdateContraturnoNatureza ? (
                                  <select
                                    value={c.natureza}
                                    onChange={(evt) => onUpdateContraturnoNatureza(activeStudent.id, c.id, evt.target.value as 'Melaço' | 'Marmelada')}
                                    className="text-xs font-bold px-2 py-0.5 rounded border border-orange-300 bg-white text-orange-900 cursor-pointer focus:outline-none"
                                    title="Alterar turma do contraturno"
                                  >
                                    <option value="Melaço">Melaço (Até 4)</option>
                                    <option value="Marmelada">Marmelada (5+)</option>
                                  </select>
                                ) : (
                                  <strong className="text-orange-800 font-bold text-xs">{c.natureza}</strong>
                                )}
                                <span className="text-xs text-slate-600">({c.periodo})</span>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                isCurrentlyActive ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {isCurrentlyActive ? 'Vigente' : 'Encerrado'}
                              </span>
                            </div>

                            <div className="mt-2 text-[10px] text-slate-500 font-semibold">
                              <span className="block mb-1">Dias: {c.diasSemana.join(', ')} ({c.diasSemana.length}x na semana)</span>
                              {isCurrentlyActive && onUpdateContraturnoDays && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {(['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const).map(d => {
                                    const active = c.diasSemana.includes(d);
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                          const current = c.diasSemana || [];
                                          let updated: ('Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex')[];
                                          if (current.includes(d)) {
                                            if (current.length === 1) return;
                                            updated = current.filter(x => x !== d);
                                          } else {
                                            updated = [...current, d];
                                          }
                                          const allDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;
                                          const sorted = allDays.filter(x => updated.includes(x));
                                          onUpdateContraturnoDays(activeStudent.id, c.id, [...sorted]);
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                          active 
                                            ? 'bg-emerald-600 text-white shadow-2xs' 
                                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-400 mt-1">
                              Vigência: {new Date(c.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} {c.dataFim ? `até ${new Date(c.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}` : '(Ativo)'}
                            </p>

                            <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100">
                              <span className="text-[10px] text-slate-500">Valor mensal do bloco:</span>
                              <span className="text-xs font-mono font-bold text-slate-900">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valorMensal)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                        Nenhum registro de contraturno cadastrado para este aluno.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* ===================== ABA: FINANCEIRO (cont.) — Extrato ===================== */}
              {profileTab === 'financeiro' && (
              <div className="grid grid-cols-1 gap-4">
                {/* Chronological financial statements */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Movimentações (Extrato)</h4>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {activeMovements.length > 0 ? (
                      activeMovements.map((mov) => (
                        <div key={mov.id} className="p-3 bg-slate-50 rounded-md border border-slate-150 relative">
                          <span className="absolute top-3 right-3 text-[9px] font-mono text-slate-400">
                            {new Date(mov.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-slate-800 tracking-wider">
                              {mov.tipo.replace('_', ' ')}
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed mt-0.5">{mov.descricao}</p>
                            
                            <div className="flex items-center gap-2 pt-1 mt-1 border-t border-slate-100/60 text-[10px]">
                              <span className="text-slate-400">Mensalidade:</span>
                              <span className="line-through text-slate-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valorAnterior)}</span>
                              <span className="text-slate-400">→</span>
                              <span className="font-mono font-bold text-slate-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valorNovo)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                        Nenhum registro financeiro registrado para este aluno.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* ===================== ABA: MATRÍCULA [ano] ===================== */}
              {profileTab === 'matricula' && currentYearEnrollment && (
                <div className="space-y-4">
                  {/* Trilha das 5 fases */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex items-stretch justify-between gap-1">
                      {faseOrderList.map((faseKey, idx) => {
                        const currentIdx = faseOrderList.indexOf(currentYearFase);
                        const isDone = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        return (
                          <React.Fragment key={faseKey}>
                            <div className="flex-1 flex flex-col items-center gap-1.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                  isDone
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : isCurrent
                                      ? 'bg-brand-orange border-brand-orange text-white'
                                      : 'bg-slate-50 border-slate-200 text-slate-300'
                                }`}
                              >
                                {isDone ? '✓' : faseLabels[faseKey].emoji}
                              </div>
                              <span className={`text-[9px] text-center leading-tight ${isCurrent ? 'font-bold text-slate-800' : 'text-slate-400'}`}>
                                {faseLabels[faseKey].label}
                              </span>
                            </div>
                            {idx < faseOrderList.length - 1 && (
                              <div className={`w-4 sm:w-8 h-0.5 self-center mt-[-14px] ${idx < currentIdx ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Checklist da fase atual */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
                      {faseLabels[currentYearFase].emoji} {faseLabels[currentYearFase].label}
                    </h4>

                    {currentYearFase === 'preparo_terra' && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">A negociação ainda não foi confirmada pela família.</p>
                        <button
                          onClick={() => setShowNegotiationModal(true)}
                          className="text-xs font-bold text-brand-orange hover:underline"
                        >
                          Abrir negociação →
                        </button>
                      </div>
                    )}

                    {currentYearFase === 'semeadura' && (
                      <p className="text-xs text-slate-500">
                        Aguardando confirmação dos dados do aluno e responsáveis (Ficha de Dados Gerais).
                      </p>
                    )}

                    {currentYearFase === 'enraizamento' && (
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-center justify-between">
                          <span>Contrato</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">pendente</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Termo de Uso de Imagem</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">pendente</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Ficha de Saúde</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">pendente</span>
                        </li>
                      </ul>
                    )}

                    {currentYearFase === 'florescer' && (
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-center justify-between">
                          <span>Calendário e Regras e Combinados</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">pendente</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Ficha de Anamnese</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">pendente</span>
                        </li>
                      </ul>
                    )}

                    {onSaveEnrollment && currentYearFase !== 'colheita' && (
                      <button
                        onClick={() => {
                          const nextIdx = faseOrderList.indexOf(currentYearFase) + 1;
                          const nextFase = faseOrderList[nextIdx];
                          if (nextFase) {
                            onSaveEnrollment({ ...currentYearEnrollment, faseProcesso: nextFase }, false);
                          }
                        }}
                        className="w-full mt-2 py-2 bg-brand-green-dark hover:bg-emerald-900 text-white text-xs font-bold rounded-md transition-colors cursor-pointer"
                      >
                        Confirmar etapa e avançar →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 shadow-xs text-center">
              <User size={48} className="text-slate-200 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-600">Nenhum aluno cadastrado no sistema.</p>
              <button
                onClick={startAddStudent}
                className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Cadastrar Primeiro Aluno
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Carta de Intenção Modal */}
      <AnimatePresence>
        {showCartaModal && activeStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
          >
            <div className="w-full max-w-4xl my-2 sm:my-6 relative">
              <CartaIntencaoForm
                student={activeStudent}
                guardian={activeGuardian}
                enrollment={activeEnrollment}
                activeContraturno={activeContraturno}
                classPrices={classPrices}
                contraturnoPrices={contraturnoPrices}
                onSave={(updatedEn, logMov) => {
                  if (onSaveEnrollment) {
                    onSaveEnrollment(updatedEn, logMov);
                  }
                  setShowCartaModal(false);
                }}
                onClose={() => setShowCartaModal(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculadora de Acordo Modal */}
      <AnimatePresence>
        {showNegotiationModal && activeStudent && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-xl shadow-2xl max-w-6xl w-full flex flex-col overflow-hidden border border-slate-200 my-4"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-brand-green-dark to-emerald-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                    <Calculator size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Calculadora de Acordo Comercial • {activeStudent.nome}
                    </h3>
                    <p className="text-xs text-emerald-200">
                      Simule valores, personalize mensalidades regulares e contraturnos e salve o acordo diretamente no Firebase.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNegotiationModal(false)}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Fechar Calculadora"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 bg-slate-50 overflow-y-auto max-h-[80vh]">
                <NegotiationCalc
                  students={students}
                  guardians={guardians}
                  enrollments={enrollments}
                  contraturnos={contraturnos}
                  classPrices={classPrices}
                  contraturnoPrices={contraturnoPrices}
                  activeYear={activeYear}
                  negotiationHistory={negotiationHistory}
                  selectedStudentId={activeStudent.id}
                  onSelectStudent={(id) => {
                    setSelectedStudentId(id);
                    onSelectStudent?.(id);
                  }}
                  onConfirmNegotiation={(alunoId, eData, cData) => {
                    if (onConfirmNegotiation) {
                      onConfirmNegotiation(alunoId, eData, cData);
                    }
                    setShowNegotiationModal(false);
                  }}
                />
              </div>

              {/* Footer */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowNegotiationModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-colors cursor-pointer"
                >
                  Fechar Calculadora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}