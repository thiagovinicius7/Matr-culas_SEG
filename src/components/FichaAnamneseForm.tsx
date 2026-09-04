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

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

function RadioGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {options.map(op => (
        <label key={op} className="flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" checked={value === op} onChange={() => onChange(op)}
            className="w-4 h-4 text-brand-orange border-slate-300 focus:ring-brand-orange cursor-pointer shrink-0" />
          <span className="text-xs text-slate-700">{op}</span>
        </label>
      ))}
    </div>
  );
}

function CheckGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {options.map(op => (
        <label key={op} className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={selected.includes(op)} onChange={() => onChange(toggleInArray(selected, op))}
            className="w-4 h-4 text-brand-orange rounded border-slate-300 focus:ring-brand-orange cursor-pointer shrink-0" />
          <span className="text-xs text-slate-700">{op}</span>
        </label>
      ))}
    </div>
  );
}

function OutroInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Outro (especifique)'}
      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200" />
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-500">{label}</label>
      <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-green-light focus:outline-none" />
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">{number}. {title}</h3>
      {children}
    </div>
  );
}

// Sub-bloco repetido em Leitura/Escrita/Matemática (Fundamental): "O que já
// faz bem" / "Onde pode avançar" / "O que costuma ajudar"
function TresBlocos({
  fazBem, fazBemOpcoes, onFazBem,
  avancar, avancarOpcoes, onAvancar, avancarOutro, onAvancarOutro,
  ajuda, ajudaOpcoes, onAjuda, ajudaOutro, onAjudaOutro,
}: {
  fazBem: string[]; fazBemOpcoes: string[]; onFazBem: (v: string[]) => void;
  avancar: string[]; avancarOpcoes: string[]; onAvancar: (v: string[]) => void; avancarOutro: string; onAvancarOutro: (v: string) => void;
  ajuda: string[]; ajudaOpcoes: string[]; onAjuda: (v: string[]) => void; ajudaOutro: string; onAjudaOutro: (v: string) => void;
}) {
  return (
    <div className="space-y-3 bg-slate-50 rounded-lg p-3">
      <Q label="O que já faz bem:"><CheckGroup options={fazBemOpcoes} selected={fazBem} onChange={onFazBem} /></Q>
      <Q label="Onde pode avançar:">
        <CheckGroup options={avancarOpcoes} selected={avancar} onChange={onAvancar} />
        {avancar.includes('Outro') && <OutroInput value={avancarOutro} onChange={onAvancarOutro} />}
      </Q>
      <Q label="O que costuma ajudar:">
        <CheckGroup options={ajudaOpcoes} selected={ajuda} onChange={onAjuda} />
        {ajuda.includes('Outro') && <OutroInput value={ajudaOutro} onChange={onAjudaOutro} />}
      </Q>
    </div>
  );
}

export default function FichaAnamneseForm({ student, natureza, existingFicha, onSubmit }: FichaAnamneseFormProps) {
  const f = existingFicha;

  // ===== Infantil =====
  const [autonomiaDiaADia, setAutonomiaDiaADia] = useState(f?.autonomiaDiaADia || '');
  const [alimentacaoOpcoes, setAlimentacaoOpcoes] = useState<string[]>(f?.alimentacaoOpcoes || []);
  const [alimentacaoOutro, setAlimentacaoOutro] = useState(f?.alimentacaoOutro || '');
  const [banheiroOpcao, setBanheiroOpcao] = useState(f?.banheiroOpcao || '');
  const [reacaoMudancaRotina, setReacaoMudancaRotina] = useState(f?.reacaoMudancaRotina || '');
  const [relacionamentoOutrasCriancas, setRelacionamentoOutrasCriancas] = useState(f?.relacionamentoOutrasCriancas || '');
  const [quandoContrariado, setQuandoContrariado] = useState(f?.quandoContrariado || '');
  const [quandoConflito, setQuandoConflito] = useState(f?.quandoConflito || '');
  const [comoDemonstraSentimentos, setComoDemonstraSentimentos] = useState<string[]>(f?.comoDemonstraSentimentos || []);
  const [comoDemonstraSentimentosOutra, setComoDemonstraSentimentosOutra] = useState(f?.comoDemonstraSentimentosOutra || '');
  const [oQueAjudaTristeBravaFrustrada, setOQueAjudaTristeBravaFrustrada] = useState(f?.oQueAjudaTristeBravaFrustrada || '');
  const [atividadesInteresseInfantil, setAtividadesInteresseInfantil] = useState<string[]>(f?.atividadesInteresseInfantil || []);
  const [atividadesInteresseInfantilOutras, setAtividadesInteresseInfantilOutras] = useState(f?.atividadesInteresseInfantilOutras || '');
  const [quandoAtividadeDificil, setQuandoAtividadeDificil] = useState(f?.quandoAtividadeDificil || '');
  const [mantemEnvolvida, setMantemEnvolvida] = useState(f?.mantemEnvolvida || '');
  const [comoAprendeMelhor, setComoAprendeMelhor] = useState(f?.comoAprendeMelhor || '');
  const [jaFrequentouOutraEscola, setJaFrequentouOutraEscola] = useState<string>(f?.jaFrequentouOutraEscola || '');
  const [comoFoiExperienciaAnterior, setComoFoiExperienciaAnterior] = useState(f?.comoFoiExperienciaAnterior || '');
  const [adaptacaoNovosAmbientes, setAdaptacaoNovosAmbientes] = useState(f?.adaptacaoNovosAmbientes || '');
  const [situacaoEscolarPreocupacao, setSituacaoEscolarPreocupacao] = useState<string>(f?.situacaoEscolarPreocupacao || '');
  const [situacaoEscolarPreocupacaoQual, setSituacaoEscolarPreocupacaoQual] = useState(f?.situacaoEscolarPreocupacaoQual || '');
  const [principaisCaracteristicas, setPrincipaisCaracteristicas] = useState(f?.principaisCaracteristicas || '');
  const [oQueDeixaInseguro, setOQueDeixaInseguro] = useState(f?.oQueDeixaInseguro || '');
  const [oQueEscolaDeveSaberInfantil, setOQueEscolaDeveSaberInfantil] = useState(f?.oQueEscolaDeveSaberInfantil || '');
  const [expectativasFamilia, setExpectativasFamilia] = useState(f?.expectativasFamilia || '');
  const [outrasInformacoesInfantil, setOutrasInformacoesInfantil] = useState(f?.outrasInformacoesInfantil || '');

  // ===== Fundamental =====
  const [adaptacaoExperienciasAnteriores, setAdaptacaoExperienciasAnteriores] = useState(f?.adaptacaoExperienciasAnteriores || '');
  const [oQueFuncionouBem, setOQueFuncionouBem] = useState(f?.oQueFuncionouBem || '');
  const [experienciaAnteriorImportante, setExperienciaAnteriorImportante] = useState(f?.experienciaAnteriorImportante || '');

  const [leituraFazBem, setLeituraFazBem] = useState<string[]>(f?.leituraFazBem || []);
  const [leituraPodeAvancar, setLeituraPodeAvancar] = useState<string[]>(f?.leituraPodeAvancar || []);
  const [leituraPodeAvancarOutro, setLeituraPodeAvancarOutro] = useState(f?.leituraPodeAvancarOutro || '');
  const [leituraAjuda, setLeituraAjuda] = useState<string[]>(f?.leituraAjuda || []);
  const [leituraAjudaOutro, setLeituraAjudaOutro] = useState(f?.leituraAjudaOutro || '');

  const [escritaFazBem, setEscritaFazBem] = useState<string[]>(f?.escritaFazBem || []);
  const [escritaPodeAvancar, setEscritaPodeAvancar] = useState<string[]>(f?.escritaPodeAvancar || []);
  const [escritaPodeAvancarOutro, setEscritaPodeAvancarOutro] = useState(f?.escritaPodeAvancarOutro || '');
  const [escritaAjuda, setEscritaAjuda] = useState<string[]>(f?.escritaAjuda || []);
  const [escritaAjudaOutro, setEscritaAjudaOutro] = useState(f?.escritaAjudaOutro || '');

  const [matematicaFazBem, setMatematicaFazBem] = useState<string[]>(f?.matematicaFazBem || []);
  const [matematicaPodeAvancar, setMatematicaPodeAvancar] = useState<string[]>(f?.matematicaPodeAvancar || []);
  const [matematicaPodeAvancarOutro, setMatematicaPodeAvancarOutro] = useState(f?.matematicaPodeAvancarOutro || '');
  const [matematicaAjuda, setMatematicaAjuda] = useState<string[]>(f?.matematicaAjuda || []);
  const [matematicaAjudaOutro, setMatematicaAjudaOutro] = useState(f?.matematicaAjudaOutro || '');

  const [envolvimentoFazBem, setEnvolvimentoFazBem] = useState<string[]>(f?.envolvimentoFazBem || []);
  const [envolvimentoPodeAvancar, setEnvolvimentoPodeAvancar] = useState<string[]>(f?.envolvimentoPodeAvancar || []);
  const [envolvimentoAjuda, setEnvolvimentoAjuda] = useState<string[]>(f?.envolvimentoAjuda || []);
  const [envolvimentoAjudaOutro, setEnvolvimentoAjudaOutro] = useState(f?.envolvimentoAjudaOutro || '');

  const [convivenciaFazBem, setConvivenciaFazBem] = useState<string[]>(f?.convivenciaFazBem || []);
  const [convivenciaPodeAvancar, setConvivenciaPodeAvancar] = useState<string[]>(f?.convivenciaPodeAvancar || []);
  const [convivenciaOQueAjudaConflito, setConvivenciaOQueAjudaConflito] = useState(f?.convivenciaOQueAjudaConflito || '');
  const [convivenciaQuandoContrariada, setConvivenciaQuandoContrariada] = useState(f?.convivenciaQuandoContrariada || '');
  const [convivenciaQuandoContrariadaOutra, setConvivenciaQuandoContrariadaOutra] = useState(f?.convivenciaQuandoContrariadaOutra || '');

  const [interessesAtividadesFundamental, setInteressesAtividadesFundamental] = useState<string[]>(f?.interessesAtividadesFundamental || []);
  const [interessesAtividadesFundamentalOutras, setInteressesAtividadesFundamentalOutras] = useState(f?.interessesAtividadesFundamentalOutras || '');
  const [principaisQualidadesFundamental, setPrincipaisQualidadesFundamental] = useState(f?.principaisQualidadesFundamental || '');
  const [oQueMotiva, setOQueMotiva] = useState(f?.oQueMotiva || '');

  const [habilidadeDesenvolvidaRecentemente, setHabilidadeDesenvolvidaRecentemente] = useState(f?.habilidadeDesenvolvidaRecentemente || '');
  const [aspectoDesenvolverEsteAno, setAspectoDesenvolverEsteAno] = useState(f?.aspectoDesenvolverEsteAno || '');
  const [oQueProfessorDeveSaber, setOQueProfessorDeveSaber] = useState(f?.oQueProfessorDeveSaber || '');
  const [outrasInformacoesFundamental, setOutrasInformacoesFundamental] = useState(f?.outrasInformacoesFundamental || '');

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const ficha: Omit<FichaAnamnese, 'id'> = {
      alunoId: student.id,
      natureza,
      preenchidoEm: new Date().toISOString().split('T')[0],
      ...(natureza === 'Infantil' ? {
        autonomiaDiaADia: autonomiaDiaADia || undefined,
        alimentacaoOpcoes: alimentacaoOpcoes.length ? alimentacaoOpcoes : undefined,
        alimentacaoOutro: alimentacaoOutro || undefined,
        banheiroOpcao: banheiroOpcao || undefined,
        reacaoMudancaRotina: reacaoMudancaRotina || undefined,
        relacionamentoOutrasCriancas: relacionamentoOutrasCriancas || undefined,
        quandoContrariado: quandoContrariado || undefined,
        quandoConflito: quandoConflito || undefined,
        comoDemonstraSentimentos: comoDemonstraSentimentos.length ? comoDemonstraSentimentos : undefined,
        comoDemonstraSentimentosOutra: comoDemonstraSentimentosOutra || undefined,
        oQueAjudaTristeBravaFrustrada: oQueAjudaTristeBravaFrustrada || undefined,
        atividadesInteresseInfantil: atividadesInteresseInfantil.length ? atividadesInteresseInfantil : undefined,
        atividadesInteresseInfantilOutras: atividadesInteresseInfantilOutras || undefined,
        quandoAtividadeDificil: quandoAtividadeDificil || undefined,
        mantemEnvolvida: mantemEnvolvida || undefined,
        comoAprendeMelhor: comoAprendeMelhor || undefined,
        jaFrequentouOutraEscola: (jaFrequentouOutraEscola || undefined) as FichaAnamnese['jaFrequentouOutraEscola'],
        comoFoiExperienciaAnterior: jaFrequentouOutraEscola === 'Sim' ? (comoFoiExperienciaAnterior || undefined) : undefined,
        adaptacaoNovosAmbientes: adaptacaoNovosAmbientes || undefined,
        situacaoEscolarPreocupacao: (situacaoEscolarPreocupacao || undefined) as FichaAnamnese['situacaoEscolarPreocupacao'],
        situacaoEscolarPreocupacaoQual: situacaoEscolarPreocupacao === 'Sim' ? (situacaoEscolarPreocupacaoQual || undefined) : undefined,
        principaisCaracteristicas: principaisCaracteristicas || undefined,
        oQueDeixaInseguro: oQueDeixaInseguro || undefined,
        oQueEscolaDeveSaberInfantil: oQueEscolaDeveSaberInfantil || undefined,
        expectativasFamilia: expectativasFamilia || undefined,
        outrasInformacoesInfantil: outrasInformacoesInfantil || undefined,
      } : {
        adaptacaoExperienciasAnteriores: adaptacaoExperienciasAnteriores || undefined,
        oQueFuncionouBem: oQueFuncionouBem || undefined,
        experienciaAnteriorImportante: experienciaAnteriorImportante || undefined,
        leituraFazBem: leituraFazBem.length ? leituraFazBem : undefined,
        leituraPodeAvancar: leituraPodeAvancar.length ? leituraPodeAvancar : undefined,
        leituraPodeAvancarOutro: leituraPodeAvancarOutro || undefined,
        leituraAjuda: leituraAjuda.length ? leituraAjuda : undefined,
        leituraAjudaOutro: leituraAjudaOutro || undefined,
        escritaFazBem: escritaFazBem.length ? escritaFazBem : undefined,
        escritaPodeAvancar: escritaPodeAvancar.length ? escritaPodeAvancar : undefined,
        escritaPodeAvancarOutro: escritaPodeAvancarOutro || undefined,
        escritaAjuda: escritaAjuda.length ? escritaAjuda : undefined,
        escritaAjudaOutro: escritaAjudaOutro || undefined,
        matematicaFazBem: matematicaFazBem.length ? matematicaFazBem : undefined,
        matematicaPodeAvancar: matematicaPodeAvancar.length ? matematicaPodeAvancar : undefined,
        matematicaPodeAvancarOutro: matematicaPodeAvancarOutro || undefined,
        matematicaAjuda: matematicaAjuda.length ? matematicaAjuda : undefined,
        matematicaAjudaOutro: matematicaAjudaOutro || undefined,
        envolvimentoFazBem: envolvimentoFazBem.length ? envolvimentoFazBem : undefined,
        envolvimentoPodeAvancar: envolvimentoPodeAvancar.length ? envolvimentoPodeAvancar : undefined,
        envolvimentoAjuda: envolvimentoAjuda.length ? envolvimentoAjuda : undefined,
        envolvimentoAjudaOutro: envolvimentoAjudaOutro || undefined,
        convivenciaFazBem: convivenciaFazBem.length ? convivenciaFazBem : undefined,
        convivenciaPodeAvancar: convivenciaPodeAvancar.length ? convivenciaPodeAvancar : undefined,
        convivenciaOQueAjudaConflito: convivenciaOQueAjudaConflito || undefined,
        convivenciaQuandoContrariada: convivenciaQuandoContrariada || undefined,
        convivenciaQuandoContrariadaOutra: convivenciaQuandoContrariadaOutra || undefined,
        interessesAtividadesFundamental: interessesAtividadesFundamental.length ? interessesAtividadesFundamental : undefined,
        interessesAtividadesFundamentalOutras: interessesAtividadesFundamentalOutras || undefined,
        principaisQualidadesFundamental: principaisQualidadesFundamental || undefined,
        oQueMotiva: oQueMotiva || undefined,
        habilidadeDesenvolvidaRecentemente: habilidadeDesenvolvidaRecentemente || undefined,
        aspectoDesenvolverEsteAno: aspectoDesenvolverEsteAno || undefined,
        oQueProfessorDeveSaber: oQueProfessorDeveSaber || undefined,
        outrasInformacoesFundamental: outrasInformacoesFundamental || undefined,
      }),
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
          <h2 className="text-lg font-bold font-display text-brand-green-dark">Ficha recebida!</h2>
          <p className="text-sm text-slate-600">
            Obrigado por compartilhar essas informações sobre <strong>{student.nome}</strong>. Isso ajuda muito a
            equipe pedagógica a conhecê-lo(a) melhor.
          </p>
        </motion.div>
      </div>
    );
  }

  const AVANCAR_OPCOES = (base: string[]) => [...base, 'Outro'];

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
            <NotebookPen size={14} /> Ficha de Conhecimento e Acompanhamento da Criança
          </p>
          <p className="text-[11px] text-emerald-100 mt-2 font-semibold">{student.nome} — {natureza}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {natureza === 'Infantil' ? (
            <>
              <Section number={1} title="Rotina e Autonomia">
                <Q label="Como é a autonomia da criança no dia a dia?">
                  <RadioGroup options={['Muito independente', 'Realiza algumas atividades sozinha, mas ainda precisa de ajuda', 'Precisa de bastante auxílio', 'Está desenvolvendo sua autonomia']} value={autonomiaDiaADia} onChange={setAutonomiaDiaADia} />
                </Q>
                <Q label="Em relação à alimentação, a criança:">
                  <CheckGroup options={['Alimenta-se sozinha', 'Precisa de algum auxílio', 'Apresenta seletividade alimentar', 'Possui restrições/alergias alimentares']} selected={alimentacaoOpcoes} onChange={setAlimentacaoOpcoes} />
                  <OutroInput value={alimentacaoOutro} onChange={setAlimentacaoOutro} />
                </Q>
                <Q label="Em relação ao banheiro:">
                  <RadioGroup options={['Tem autonomia', 'Precisa de lembretes', 'Precisa de auxílio', 'Está em processo de desfralde', 'Usa fralda']} value={banheiroOpcao} onChange={setBanheiroOpcao} />
                </Q>
                <Q label="Como reage a mudanças na rotina?">
                  <RadioGroup options={['Adapta-se com facilidade', 'Precisa de um tempo para se adaptar', 'Demonstra resistência', 'Fica bastante incomodado(a)']} value={reacaoMudancaRotina} onChange={setReacaoMudancaRotina} />
                </Q>
              </Section>

              <Section number={2} title="Relações e Emoções">
                <Q label="Como costuma se relacionar com outras crianças?">
                  <RadioGroup options={['Interage com facilidade', 'Interage depois de algum tempo', 'Prefere brincar sozinho(a)', 'Precisa de incentivo para interagir']} value={relacionamentoOutrasCriancas} onChange={setRelacionamentoOutrasCriancas} />
                </Q>
                <Q label="Quando é contrariado(a), costuma:">
                  <RadioGroup options={['Aceitar e seguir a rotina', 'Ficar chateado(a), mas se reorganizar sozinho(a)', 'Precisar da ajuda de um adulto', 'Ter dificuldade para lidar com a frustração']} value={quandoContrariado} onChange={setQuandoContrariado} />
                </Q>
                <Q label="Quando acontece um conflito, geralmente:">
                  <RadioGroup options={['Tenta resolver sozinho(a)', 'Procura um adulto', 'Chora ou se afasta', 'Reage fisicamente/verbalmente', 'Tem dificuldade para explicar o que aconteceu']} value={quandoConflito} onChange={setQuandoConflito} />
                </Q>
                <Q label="Como demonstra seus sentimentos?">
                  <CheckGroup options={['Conversando', 'Chorando', 'Ficando quieto(a)/isolando-se', 'Demonstrando irritação']} selected={comoDemonstraSentimentos} onChange={setComoDemonstraSentimentos} />
                  <OutroInput value={comoDemonstraSentimentosOutra} onChange={setComoDemonstraSentimentosOutra} placeholder="Outra forma" />
                </Q>
                <TextArea label="O que costuma ajudar a criança quando está triste, brava ou frustrada?" value={oQueAjudaTristeBravaFrustrada} onChange={setOQueAjudaTristeBravaFrustrada} />
              </Section>

              <Section number={3} title="Aprendizagem e Interesses">
                <Q label="Quais atividades despertam maior interesse?">
                  <CheckGroup options={['Histórias/livros', 'Desenho e pintura', 'Música e dança', 'Jogos e brincadeiras', 'Natureza e animais', 'Construções/montagens', 'Escrita e leitura', 'Números e matemática', 'Experimentos/investigações']} selected={atividadesInteresseInfantil} onChange={setAtividadesInteresseInfantil} />
                  <OutroInput value={atividadesInteresseInfantilOutras} onChange={setAtividadesInteresseInfantilOutras} placeholder="Outras" />
                </Q>
                <Q label="Quando encontra uma atividade difícil, geralmente:">
                  <RadioGroup options={['Tenta novamente', 'Pede ajuda', 'Desiste rapidamente', 'Fica frustrado(a)', 'Procura outra estratégia']} value={quandoAtividadeDificil} onChange={setQuandoAtividadeDificil} />
                </Q>
                <Q label="A criança costuma manter-se envolvida em uma atividade?">
                  <RadioGroup options={['Com facilidade', 'Por períodos curtos', 'Precisa de estímulos e mediação', 'Apresenta bastante dificuldade']} value={mantemEnvolvida} onChange={setMantemEnvolvida} />
                </Q>
                <Q label="Como você percebe que seu/sua filho(a) aprende melhor?">
                  <RadioGroup options={['Fazendo e experimentando', 'Observando', 'Ouvindo explicações', 'Conversando e trocando ideias', 'Ainda não conseguimos perceber']} value={comoAprendeMelhor} onChange={setComoAprendeMelhor} />
                </Q>
              </Section>

              <Section number={4} title="Experiência Escolar">
                <Q label="A criança já frequentou outra escola?">
                  <RadioGroup options={['Não', 'Sim']} value={jaFrequentouOutraEscola} onChange={setJaFrequentouOutraEscola} />
                  {jaFrequentouOutraEscola === 'Sim' && <TextArea label="Como foi a experiência?" value={comoFoiExperienciaAnterior} onChange={setComoFoiExperienciaAnterior} />}
                </Q>
                <Q label="Como costuma ser a adaptação a novos ambientes e pessoas?">
                  <RadioGroup options={['Fácil', 'Gradual', 'Apresenta resistência inicialmente', 'Costuma ter bastante dificuldade']} value={adaptacaoNovosAmbientes} onChange={setAdaptacaoNovosAmbientes} />
                </Q>
                <Q label="Existe alguma situação escolar que já tenha sido motivo de preocupação para a família?">
                  <RadioGroup options={['Não', 'Sim']} value={situacaoEscolarPreocupacao} onChange={setSituacaoEscolarPreocupacao} />
                  {situacaoEscolarPreocupacao === 'Sim' && <TextArea label="Qual?" value={situacaoEscolarPreocupacaoQual} onChange={setSituacaoEscolarPreocupacaoQual} />}
                </Q>
              </Section>

              <Section number={5} title="Para Conhecermos Melhor">
                <TextArea label="Quais são as principais características/qualidades do seu/sua filho(a)?" value={principaisCaracteristicas} onChange={setPrincipaisCaracteristicas} />
                <TextArea label="Existe algo que costuma deixá-lo(a) inseguro(a), triste, irritado(a) ou desconfortável?" value={oQueDeixaInseguro} onChange={setOQueDeixaInseguro} />
                <TextArea label="O que vocês consideram importante que a escola saiba para acolher e acompanhar melhor a criança?" value={oQueEscolaDeveSaberInfantil} onChange={setOQueEscolaDeveSaberInfantil} />
                <TextArea label="Quais são as principais expectativas da família em relação à escola neste ano?" value={expectativasFamilia} onChange={setExpectativasFamilia} />
                <TextArea label="Há alguma informação sobre a criança que não foi perguntada e que vocês gostariam de compartilhar conosco?" value={outrasInformacoesInfantil} onChange={setOutrasInformacoesInfantil} />
              </Section>
            </>
          ) : (
            <>
              <Section number={1} title="Trajetória Escolar">
                <Q label="Como foi a adaptação da criança em experiências escolares anteriores?">
                  <RadioGroup options={['Adaptou-se com facilidade', 'Precisou de um período para criar vínculos', 'Precisou de bastante acompanhamento inicialmente', 'Apresentou dificuldades de adaptação']} value={adaptacaoExperienciasAnteriores} onChange={setAdaptacaoExperienciasAnteriores} />
                </Q>
                <TextArea label="O que funcionou bem nesse período?" value={oQueFuncionouBem} onChange={setOQueFuncionouBem} />
                <TextArea label="Existe alguma experiência escolar anterior que consideram importante compartilhar conosco?" value={experienciaAnteriorImportante} onChange={setExperienciaAnteriorImportante} />
              </Section>

              <Section number={2} title="Aprendizagem">
                <p className="text-xs font-bold text-slate-600">Leitura</p>
                <TresBlocos
                  fazBem={leituraFazBem} fazBemOpcoes={['Lê com autonomia', 'Demonstra interesse por livros e histórias', 'Compartilha o que lê', 'Escolhe espontaneamente o que gostaria de ler']} onFazBem={setLeituraFazBem}
                  avancar={leituraPodeAvancar} avancarOpcoes={AVANCAR_OPCOES(['Fluência', 'Compreensão', 'Interesse pela leitura', 'Autonomia'])} onAvancar={setLeituraPodeAvancar} avancarOutro={leituraPodeAvancarOutro} onAvancarOutro={setLeituraPodeAvancarOutro}
                  ajuda={leituraAjuda} ajudaOpcoes={AVANCAR_OPCOES(['Leitura compartilhada', 'Incentivo do adulto', 'Escolha dos próprios livros', 'Conversas sobre o que leu'])} onAjuda={setLeituraAjuda} ajudaOutro={leituraAjudaOutro} onAjudaOutro={setLeituraAjudaOutro}
                />
                <p className="text-xs font-bold text-slate-600 pt-2">Escrita</p>
                <TresBlocos
                  fazBem={escritaFazBem} fazBemOpcoes={['Escreve com autonomia', 'Gosta de produzir textos', 'Demonstra criatividade', 'Consegue organizar suas ideias por escrito']} onFazBem={setEscritaFazBem}
                  avancar={escritaPodeAvancar} avancarOpcoes={AVANCAR_OPCOES(['Ortografia', 'Organização das ideias', 'Produção textual', 'Autonomia'])} onAvancar={setEscritaPodeAvancar} avancarOutro={escritaPodeAvancarOutro} onAvancarOutro={setEscritaPodeAvancarOutro}
                  ajuda={escritaAjuda} ajudaOpcoes={AVANCAR_OPCOES(['Modelos e referências', 'Conversa antes da escrita', 'Revisão acompanhada', 'Tempo maior para realizar a proposta'])} onAjuda={setEscritaAjuda} ajudaOutro={escritaAjudaOutro} onAjudaOutro={setEscritaAjudaOutro}
                />
                <p className="text-xs font-bold text-slate-600 pt-2">Matemática</p>
                <TresBlocos
                  fazBem={matematicaFazBem} fazBemOpcoes={['Demonstra interesse', 'Resolve situações-problema', 'Utiliza diferentes estratégias', 'Realiza cálculos com autonomia']} onFazBem={setMatematicaFazBem}
                  avancar={matematicaPodeAvancar} avancarOpcoes={AVANCAR_OPCOES(['Cálculo', 'Raciocínio lógico', 'Resolução de problemas', 'Compreensão dos conceitos'])} onAvancar={setMatematicaPodeAvancar} avancarOutro={matematicaPodeAvancarOutro} onAvancarOutro={setMatematicaPodeAvancarOutro}
                  ajuda={matematicaAjuda} ajudaOpcoes={AVANCAR_OPCOES(['Materiais concretos', 'Desenhos e representações', 'Exemplos práticos', 'Resolução passo a passo'])} onAjuda={setMatematicaAjuda} ajudaOutro={matematicaAjudaOutro} onAjudaOutro={setMatematicaAjudaOutro}
                />
              </Section>

              <Section number={3} title="Envolvimento e Autonomia">
                <p className="text-xs text-slate-500">Durante as atividades, a criança:</p>
                <Q label="O que já faz bem:"><CheckGroup options={['Participa espontaneamente', 'Demonstra curiosidade', 'Faz perguntas', 'Tenta diferentes estratégias', 'Consegue trabalhar com autonomia']} selected={envolvimentoFazBem} onChange={setEnvolvimentoFazBem} /></Q>
                <Q label="Onde pode avançar:"><CheckGroup options={['Manter a atenção', 'Iniciar as atividades', 'Finalizar as propostas', 'Organizar materiais e tempo', 'Pedir ajuda quando necessário']} selected={envolvimentoPodeAvancar} onChange={setEnvolvimentoPodeAvancar} /></Q>
                <Q label="O que costuma ajudar:">
                  <CheckGroup options={['Orientações individuais', 'Dividir a atividade em etapas', 'Apoio visual', 'Incentivo do adulto', 'Tempo maior']} selected={envolvimentoAjuda} onChange={setEnvolvimentoAjuda} />
                  <OutroInput value={envolvimentoAjudaOutro} onChange={setEnvolvimentoAjudaOutro} />
                </Q>
              </Section>

              <Section number={4} title="Convivência e Relações">
                <p className="text-xs text-slate-500">Nas relações com os colegas, a criança:</p>
                <Q label="O que já faz bem:"><CheckGroup options={['Interage com facilidade', 'Coopera com os colegas', 'Compartilha ideias e materiais', 'Consegue trabalhar em grupo', 'Demonstra empatia']} selected={convivenciaFazBem} onChange={setConvivenciaFazBem} /></Q>
                <Q label="Onde pode avançar:"><CheckGroup options={['Esperar sua vez', 'Ouvir diferentes opiniões', 'Resolver conflitos', 'Expressar sentimentos e necessidades', 'Lidar com frustrações']} selected={convivenciaPodeAvancar} onChange={setConvivenciaPodeAvancar} /></Q>
                <TextArea label="Quando enfrenta um conflito, o que costuma ajudá-la?" value={convivenciaOQueAjudaConflito} onChange={setConvivenciaOQueAjudaConflito} />
                <Q label="Quando é contrariada ou algo não acontece como esperava, geralmente:">
                  <RadioGroup options={['Consegue se reorganizar sozinha', 'Precisa de algum tempo', 'Procura um adulto', 'Precisa de orientação para se reorganizar', 'Outra situação']} value={convivenciaQuandoContrariada} onChange={setConvivenciaQuandoContrariada} />
                  {convivenciaQuandoContrariada === 'Outra situação' && <OutroInput value={convivenciaQuandoContrariadaOutra} onChange={setConvivenciaQuandoContrariadaOutra} />}
                </Q>
              </Section>

              <Section number={5} title="Interesses e Potencialidades">
                <Q label="Quais atividades despertam maior interesse na criança?">
                  <CheckGroup options={['Leitura e histórias', 'Esportes e movimento', 'Escrita', 'Projetos e pesquisas', 'Matemática e desafios', 'Construção e criação', 'Ciências e natureza', 'Artes', 'Jogos e brincadeiras', 'Música', 'Tecnologia']} selected={interessesAtividadesFundamental} onChange={setInteressesAtividadesFundamental} />
                  <OutroInput value={interessesAtividadesFundamentalOutras} onChange={setInteressesAtividadesFundamentalOutras} placeholder="Outros" />
                </Q>
                <TextArea label="Quais você considera serem as principais qualidades e potencialidades do(a) seu/sua filho(a)?" value={principaisQualidadesFundamental} onChange={setPrincipaisQualidadesFundamental} />
                <TextArea label="O que costuma motivá-lo(a) a aprender e participar?" value={oQueMotiva} onChange={setOQueMotiva} />
              </Section>

              <Section number={6} title="Para a Escola Conhecer Melhor">
                <TextArea label="Existe alguma habilidade que vocês percebem que a criança desenvolveu bastante recentemente?" value={habilidadeDesenvolvidaRecentemente} onChange={setHabilidadeDesenvolvidaRecentemente} />
                <TextArea label="Existe algum aspecto que gostariam que a escola ajudasse a desenvolver neste ano?" value={aspectoDesenvolverEsteAno} onChange={setAspectoDesenvolverEsteAno} />
                <TextArea label="O que vocês consideram importante que o professor e a coordenação saibam para conhecer e acompanhar melhor seu/sua filho(a)?" value={oQueProfessorDeveSaber} onChange={setOQueProfessorDeveSaber} />
                <TextArea label="Há alguma outra informação que gostariam de compartilhar conosco?" value={outrasInformacoesFundamental} onChange={setOutrasInformacoesFundamental} />
              </Section>
            </>
          )}

          {erro && <p className="text-xs font-bold text-rose-600 text-center">{erro}</p>}

          <button type="submit" disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-bold font-display uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            {isSubmitting ? 'Enviando...' : existingFicha ? 'Atualizar Ficha de Anamnese' : 'Enviar Ficha de Anamnese'}
          </button>
        </form>
      </div>
    </div>
  );
}
