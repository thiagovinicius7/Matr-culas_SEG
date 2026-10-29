import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Users, Plus, X, Check, Loader2, ArrowLeft, ArrowRight, CalendarPlus, MessageCircle } from 'lucide-react';
import { watchAuthState, signInAsPublicVisitor } from '../firebase';
import type { Vivencia, VivenciaInscricao } from '../types';
import {
  carregarVivenciasAbertas, inscreverNaVivencia, VagasEsgotadasError, InscricoesEncerradasError,
  horario, faixaEtaria, textoIdade, idadeEm, vagasRestantes, novoId,
  COMO_CONHECEU_OPCOES, PARENTESCO_VIVENCIA,
} from '../vivencias';

/**
 * Página pública de inscrição nas vivências do sítio.
 *   ?vivencias=1      → lista todas as vivências com inscrição aberta
 *   ?vivencia=<id>    → abre direto o formulário daquela vivência
 * Renderizada fora do App principal (ver main.tsx): não carrega nenhum dado de
 * alunos, só lê as vivências abertas e grava as inscrições.
 */

interface CriancaForm { nome: string; nascimento: string; }

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const inputCls =
  'w-full h-12 text-[15px] px-4 rounded-xl border border-[#E7DFCB] bg-brand-cream text-slate-800 placeholder:text-slate-400 ' +
  'focus:bg-white focus:border-brand-green-light focus:ring-4 focus:ring-emerald-100 focus:outline-none transition';
const labelCls = 'block text-[13px] font-semibold text-slate-700 mb-1.5';

function partesData(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return { dia: String(d).padStart(2, '0'), mes: MESES_CURTOS[m - 1], semana: DIAS[dt.getUTCDay()], ano: a };
}

/** Link "Adicionar ao Google Agenda" (abre no navegador, não precisa de permissão). */
function linkAgenda(v: Vivencia): string {
  const d = v.data.replace(/-/g, '');
  const h = (x?: string) => (x ? x.replace(':', '') + '00' : '');
  const datas = v.horaInicio
    ? `${d}T${h(v.horaInicio)}/${d}T${h(v.horaFim || v.horaInicio)}`
    : `${d}/${d}`;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${v.titulo} · Sítio-Escola Geranium`,
    dates: datas,
    ctz: 'America/Sao_Paulo',
    details: 'Vivência no Sítio-Escola Geranium. sitioescolageranium.com.br',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* Folhagem decorativa do cabeçalho (desenho simples, só enfeite). */
function Folhas() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
      <g fill="#4E7A53" opacity="0.35">
        <path d="M-10 190 C 40 120, 110 120, 140 60 C 90 80, 30 110, -10 190 Z" />
        <path d="M330 -10 C 350 50, 420 70, 420 140 C 380 110, 340 70, 330 -10 Z" />
      </g>
      <g fill="none" stroke="#E06B3E" strokeWidth="1.4" opacity="0.5">
        <path d="M-10 190 C 40 150, 90 110, 140 60" />
        <path d="M330 -10 C 360 40, 390 90, 420 140" />
      </g>
      <g fill="#E06B3E" opacity="0.55">
        <circle cx="356" cy="168" r="4" /><circle cx="372" cy="182" r="2.5" /><circle cx="48" cy="40" r="3" />
      </g>
    </svg>
  );
}

function Cabecalho({ eyebrow, titulo }: { eyebrow: string; titulo?: string }) {
  return (
    <header className="relative overflow-hidden bg-brand-green-dark text-white px-6 pt-8 pb-16 sm:pb-20">
      <Folhas />
      <div className="relative max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="bg-white rounded-xl p-1.5 shadow-sm"><img src={LOGO} alt="Sítio-Escola Geranium" className="h-9 w-auto" referrerPolicy="no-referrer" /></span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200 font-semibold">{eyebrow}</span>
        </div>
        {titulo && <h1 className="mt-6 font-serif text-[28px] sm:text-[34px] leading-[1.15] font-semibold text-balance">{titulo}</h1>}
      </div>
    </header>
  );
}

function BilheteData({ v, compacto = false }: { v: Vivencia; compacto?: boolean }) {
  const p = partesData(v.data);
  const restantes = vagasRestantes(v);
  const faixa = faixaEtaria(v);
  return (
    <div className="flex items-stretch gap-4">
      <div className={`shrink-0 rounded-2xl bg-brand-orange text-white text-center flex flex-col justify-center ${compacto ? 'w-16 py-2' : 'w-20 py-3'}`}>
        <span className="text-[11px] uppercase tracking-wider font-semibold opacity-90">{p.mes}</span>
        <span className={`font-display font-bold leading-none ${compacto ? 'text-2xl' : 'text-[34px]'}`}>{p.dia}</span>
        <span className="text-[11px] font-semibold opacity-90">{p.semana}</span>
      </div>
      <div className="min-w-0 flex flex-col justify-center gap-1.5 text-[14px] text-slate-600">
        {horario(v) && <p className="flex items-center gap-2"><Clock size={15} className="text-brand-green-light shrink-0" /> {horario(v)}</p>}
        {faixa && <p className="flex items-center gap-2"><Users size={15} className="text-brand-green-light shrink-0" /> Crianças {faixa}</p>}
        {restantes !== null && (
          <p className={`text-[13px] font-semibold ${restantes === 0 ? 'text-rose-700' : restantes <= 5 ? 'text-brand-clay' : 'text-brand-green-light'}`}>
            {restantes === 0 ? 'Vagas esgotadas' : restantes === 1 ? 'Última vaga!' : `${restantes} vagas disponíveis`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function VivenciaPublica({ vivenciaIdInicial }: { vivenciaIdInicial: string | null }) {
  const [pronto, setPronto] = useState(false);
  const [erroCarga, setErroCarga] = useState('');
  const [vivencias, setVivencias] = useState<Vivencia[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(vivenciaIdInicial);
  const [enviada, setEnviada] = useState<{ v: Vivencia; criancas: string[] } | null>(null);

  // Login anônimo (as regras do Firestore exigem uma sessão) e leitura das vivências abertas.
  useEffect(() => {
    let jaCarregou = false;
    const unsub = watchAuthState(async (user) => {
      if (!user) {
        signInAsPublicVisitor().catch(() => setErroCarga('Não foi possível abrir a página. Atualize e tente de novo.'));
        return;
      }
      if (jaCarregou) return;
      jaCarregou = true;
      try {
        setVivencias(await carregarVivenciasAbertas());
      } catch {
        setErroCarga('Não foi possível carregar as vivências. Atualize a página e tente de novo.');
      } finally {
        setPronto(true);
      }
    });
    return unsub;
  }, []);

  const selecionada = vivencias.find(v => v.id === selecionadaId) || null;
  const linkInvalido = pronto && !!vivenciaIdInicial && selecionadaId === vivenciaIdInicial && !selecionada;
  const irPara = (id: string | null) => { setSelecionadaId(id); window.scrollTo(0, 0); };

  let titulo: string | undefined;
  let eyebrow = 'Vivências no Sítio';
  if (enviada) { eyebrow = 'Inscrição confirmada'; titulo = enviada.v.titulo; }
  else if (selecionada) { titulo = selecionada.titulo; }
  else if (pronto) { titulo = 'Venha viver um dia no Sítio-Escola Geranium'; }

  return (
    <div className="min-h-screen bg-brand-sand font-sans text-slate-800">
      <Cabecalho eyebrow={eyebrow} titulo={titulo} />

      <main className="relative max-w-xl mx-auto px-4 -mt-10 sm:-mt-12 pb-10">
        {!pronto && !erroCarga && (
          <div className="bg-white rounded-3xl shadow-sm p-10 flex flex-col items-center gap-3 text-sm text-slate-500">
            <Loader2 className="animate-spin text-brand-orange" size={28} /> Carregando…
          </div>
        )}

        {erroCarga && <div className="bg-white rounded-3xl shadow-sm p-6 text-sm text-rose-700">{erroCarga}</div>}

        {pronto && !erroCarga && enviada && (
          <Confirmacao v={enviada.v} criancas={enviada.criancas} onOutra={() => { setEnviada(null); irPara(null); }} temOutras={vivencias.length > 1} />
        )}

        {pronto && !erroCarga && !enviada && selecionada && (
          <FormularioInscricao
            v={selecionada}
            onVoltar={vivencias.length > 1 || !vivenciaIdInicial ? () => irPara(null) : undefined}
            onSucesso={(criancas, vAtualizada) => {
              setVivencias(vs => vs.map(x => (x.id === vAtualizada.id ? vAtualizada : x)));
              setEnviada({ v: vAtualizada, criancas });
              window.scrollTo(0, 0);
            }}
            onRecarregar={async () => setVivencias(await carregarVivenciasAbertas())}
          />
        )}

        {pronto && !erroCarga && !enviada && !selecionada && (
          <ListaVivencias vivencias={vivencias} linkInvalido={linkInvalido} onEscolher={irPara} />
        )}

        <p className="text-center text-[12px] text-slate-500 mt-8">Sítio-Escola Geranium · sitioescolageranium.com.br</p>
      </main>
    </div>
  );
}

function ListaVivencias({ vivencias, linkInvalido, onEscolher }: { vivencias: Vivencia[]; linkInvalido: boolean; onEscolher: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {linkInvalido && (
        <div className="bg-white rounded-3xl shadow-sm p-5 text-sm text-brand-clay">
          As inscrições para esta vivência foram encerradas ou o link mudou.{vivencias.length ? ' Veja abaixo as vivências com inscrição aberta.' : ''}
        </div>
      )}
      {vivencias.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm p-8 text-center space-y-2">
          <p className="font-serif text-xl text-brand-green-dark">Nenhuma vivência com inscrição aberta agora</p>
          <p className="text-sm text-slate-500">Acompanhe nosso Instagram para saber das próximas datas.</p>
        </div>
      ) : (
        <>
          {vivencias.map(v => {
            const esgotada = vagasRestantes(v) === 0;
            return (
              <button key={v.id} type="button" disabled={esgotada} onClick={() => onEscolher(v.id)}
                className="group w-full text-left bg-white rounded-3xl shadow-sm p-5 sm:p-6 transition hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
                <h2 className="font-serif text-[22px] leading-tight text-brand-green-dark mb-4">{v.titulo}</h2>
                <BilheteData v={v} compacto />
                {!esgotada && (
                  <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-brand-orange">
                    Quero me inscrever <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                  </span>
                )}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

function Descricao({ texto }: { texto: string }) {
  const longa = texto.length > 280 || texto.split('\n').length > 6;
  const [aberta, setAberta] = useState(!longa);
  return (
    <div>
      <p className={`text-[15px] leading-relaxed text-slate-700 whitespace-pre-line ${aberta ? '' : 'line-clamp-5'}`}>{texto}</p>
      {longa && (
        <button type="button" onClick={() => setAberta(a => !a)} className="mt-2 text-[14px] font-semibold text-brand-green-light hover:text-brand-green-dark">
          {aberta ? 'Mostrar menos' : 'Ler tudo'}
        </button>
      )}
    </div>
  );
}

function Etapa({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm p-5 sm:p-7 space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-brand-green-dark text-white font-display font-bold text-sm flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h3 className="font-display font-bold text-[17px] text-brand-green-dark leading-tight">{titulo}</h3>
          {sub && <p className="text-[13px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Chips({ opcoes, valor, onChange, nome }: { opcoes: string[]; valor: string; onChange: (v: string) => void; nome: string }) {
  return (
    <div role="radiogroup" aria-label={nome} className="flex flex-wrap gap-2">
      {opcoes.map(o => {
        const ativo = valor === o;
        return (
          <button key={o} type="button" role="radio" aria-checked={ativo} onClick={() => onChange(ativo && nome === 'Como conheceu' ? '' : o)}
            className={`px-3.5 h-10 rounded-full text-[14px] font-medium border transition ${ativo
              ? 'bg-brand-green-dark text-white border-brand-green-dark'
              : 'bg-brand-cream text-slate-700 border-[#E7DFCB] hover:border-brand-green-light'}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function FormularioInscricao({ v, onVoltar, onSucesso, onRecarregar }: {
  v: Vivencia;
  onVoltar?: () => void;
  onSucesso: (criancas: string[], v: Vivencia) => void;
  onRecarregar: () => Promise<void>;
}) {
  const [criancas, setCriancas] = useState<CriancaForm[]>([{ nome: '', nascimento: '' }]);
  const [responsavel, setResponsavel] = useState('');
  const [parentesco, setParentesco] = useState('Mãe');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [escolaAtual, setEscolaAtual] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const restantes = vagasRestantes(v);
  const esgotada = restantes === 0;

  const avisosIdade = useMemo(() => criancas.map(c => {
    const i = idadeEm(c.nascimento, v.data);
    if (i === null) return '';
    if ((v.idadeMin != null && i < v.idadeMin) || (v.idadeMax != null && i > v.idadeMax)) {
      return `Na data da vivência terá ${textoIdade(c.nascimento, v.data)}. Esta vivência é pensada para crianças ${faixaEtaria(v)}, mas você pode se inscrever mesmo assim e nossa equipe confirma com você.`;
    }
    return '';
  }), [criancas, v]);

  const atualizarCrianca = (idx: number, campo: keyof CriancaForm, valor: string) =>
    setCriancas(cs => cs.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (telefone.replace(/\D/g, '').length < 10) { setErro('Confira o WhatsApp: coloque o DDD e o número, por exemplo (61) 99999-9999.'); return; }
    if (restantes !== null && criancas.length > restantes) {
      setErro(restantes === 1 ? 'Só resta 1 vaga. Inscreva uma criança por vez ou fale com a escola.' : `Só restam ${restantes} vagas. Diminua o número de crianças ou fale com a escola.`);
      return;
    }
    setEnviando(true);
    const grupoId = novoId('grupo');
    const agora = new Date().toISOString();
    const inscricoes: VivenciaInscricao[] = criancas.map(c => ({
      id: novoId('insc'),
      vivenciaId: v.id,
      grupoId,
      criancaNome: c.nome.trim(),
      criancaNascimento: c.nascimento,
      responsavelNome: responsavel.trim(),
      parentesco,
      telefone: telefone.trim(),
      email: email.trim() || undefined,
      escolaAtual: escolaAtual.trim() || undefined,
      comoConheceu: comoConheceu || undefined,
      observacoes: observacoes.trim() || undefined,
      criadoEm: agora,
      presenca: 'pendente',
      origem: 'link',
    }));
    try {
      await inscreverNaVivencia(v.id, inscricoes);
      onSucesso(inscricoes.map(i => i.criancaNome), { ...v, inscritos: (v.inscritos || 0) + inscricoes.length });
    } catch (err) {
      if (err instanceof VagasEsgotadasError) {
        setErro(err.restantes === 0 ? 'As vagas acabaram enquanto você preenchia. Fale com a escola para entrar na lista de espera.' : `Agora só restam ${err.restantes} vagas. Diminua o número de crianças e envie de novo.`);
        onRecarregar().catch(() => {});
      } else if (err instanceof InscricoesEncerradasError) {
        setErro('As inscrições para esta vivência foram encerradas.');
      } else {
        setErro('Não foi possível enviar agora. Confira sua internet e tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <section className="bg-white rounded-3xl shadow-sm p-5 sm:p-7 space-y-5">
        {onVoltar && (
          <button type="button" onClick={onVoltar} className="text-[13px] font-semibold text-slate-500 hover:text-brand-green-dark inline-flex items-center gap-1">
            <ArrowLeft size={15} /> Outras vivências
          </button>
        )}
        <BilheteData v={v} />
        {v.descricao && <div className="pt-5 border-t border-[#EFE8D6]"><Descricao texto={v.descricao} /></div>}
      </section>

      {esgotada ? (
        <section className="bg-white rounded-3xl shadow-sm p-6 text-[15px] text-brand-clay">
          As vagas desta vivência estão esgotadas. Fale com a escola para entrar na lista de espera.
        </section>
      ) : (
        <>
          <Etapa n={1} titulo="Quem vem com você" sub="Os dados da criança">
            {criancas.map((c, idx) => (
              <div key={idx} className={criancas.length > 1 ? 'rounded-2xl bg-brand-sand/50 p-4 space-y-4' : 'space-y-4'}>
                {criancas.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-brand-green-dark">{idx + 1}ª criança</span>
                    <button type="button" onClick={() => setCriancas(cs => cs.filter((_, i) => i !== idx))} className="text-[13px] text-slate-500 hover:text-rose-600 inline-flex items-center gap-1">
                      <X size={14} /> Remover
                    </button>
                  </div>
                )}
                <div>
                  <label className={labelCls} htmlFor={`cn-${idx}`}>Nome completo</label>
                  <input id={`cn-${idx}`} required autoComplete="off" className={inputCls} value={c.nome} onChange={e => atualizarCrianca(idx, 'nome', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor={`cd-${idx}`}>Data de nascimento</label>
                  <input id={`cd-${idx}`} type="date" required className={inputCls} value={c.nascimento} onChange={e => atualizarCrianca(idx, 'nascimento', e.target.value)} />
                  {c.nascimento && !avisosIdade[idx] && textoIdade(c.nascimento, v.data) && (
                    <p className="text-[13px] text-brand-green-light mt-1.5">Terá {textoIdade(c.nascimento, v.data)} no dia da vivência.</p>
                  )}
                  {avisosIdade[idx] && <p className="text-[13px] text-brand-clay mt-1.5">{avisosIdade[idx]}</p>}
                </div>
              </div>
            ))}
            {(restantes === null || criancas.length < restantes) && criancas.length < 6 && (
              <button type="button" onClick={() => setCriancas(cs => [...cs, { nome: '', nascimento: '' }])}
                className="w-full h-12 rounded-xl border-2 border-dashed border-[#E7DFCB] text-[14px] font-semibold text-brand-green-light hover:border-brand-green-light hover:bg-emerald-50/40 inline-flex items-center justify-center gap-2 transition">
                <Plus size={17} /> Inscrever irmão ou irmã
              </button>
            )}
          </Etapa>

          <Etapa n={2} titulo="Seus dados" sub="Para falarmos com você">
            <div>
              <label className={labelCls} htmlFor="r-nome">Seu nome</label>
              <input id="r-nome" required autoComplete="name" className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>Você é</span>
              <Chips nome="Parentesco" opcoes={PARENTESCO_VIVENCIA} valor={parentesco} onChange={setParentesco} />
            </div>
            <div>
              <label className={labelCls} htmlFor="r-tel">WhatsApp com DDD</label>
              <input id="r-tel" type="tel" inputMode="tel" autoComplete="tel" required placeholder="(61) 99999-9999" className={inputCls} value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="r-email">E-mail <span className="font-normal text-slate-400">(opcional)</span></label>
              <input id="r-email" type="email" autoComplete="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </Etapa>

          <Etapa n={3} titulo="Para nos conhecermos" sub="Tudo aqui é opcional">
            <div>
              <label className={labelCls} htmlFor="r-escola">Escola atual da criança</label>
              <input id="r-escola" className={inputCls} value={escolaAtual} onChange={e => setEscolaAtual(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>Como conheceu o Sítio-Escola Geranium?</span>
              <Chips nome="Como conheceu" opcoes={COMO_CONHECEU_OPCOES} valor={comoConheceu} onChange={setComoConheceu} />
            </div>
            <div>
              <label className={labelCls} htmlFor="r-obs">Alergias, cuidados ou algo que devemos saber</label>
              <textarea id="r-obs" rows={3} className={`${inputCls} h-auto py-3 resize-y`} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </div>
          </Etapa>

          <section className="bg-white rounded-3xl shadow-sm p-5 sm:p-7 space-y-4">
            <label htmlFor="r-aceite" className="flex items-start gap-3 cursor-pointer">
              <input id="r-aceite" type="checkbox" required checked={aceite} onChange={e => setAceite(e.target.checked)} className="peer sr-only" />
              <span className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-100 ${aceite ? 'bg-brand-green-dark border-brand-green-dark' : 'bg-brand-cream border-[#D8CDB2]'}`}>
                {aceite && <Check size={15} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-[14px] text-slate-600 leading-snug">Autorizo o Sítio-Escola Geranium a usar estes dados para organizar a vivência e entrar em contato comigo.</span>
            </label>

            {erro && <p className="text-[14px] text-rose-700 bg-rose-50 rounded-xl p-3" role="alert">{erro}</p>}

            <button type="submit" disabled={enviando}
              className="w-full h-14 rounded-2xl bg-brand-orange hover:bg-brand-orange-hover active:scale-[0.99] text-white font-display font-bold text-[17px] inline-flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60">
              {enviando ? <><Loader2 size={18} className="animate-spin" /> Enviando…</> : <>Confirmar inscrição <ArrowRight size={18} /></>}
            </button>
          </section>
        </>
      )}
    </form>
  );
}

function Confirmacao({ v, criancas, onOutra, temOutras }: { v: Vivencia; criancas: string[]; onOutra: () => void; temOutras: boolean }) {
  const nomes = criancas.join(', ').replace(/, ([^,]*)$/, ' e $1');
  return (
    <section className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-3">
        <span className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center"><Check size={34} className="text-emerald-700" strokeWidth={2.6} /></span>
        <h2 className="font-serif text-[26px] text-brand-green-dark">Que bom ter vocês!</h2>
        <p className="text-[15px] text-slate-600">Inscrição feita para <b className="text-slate-800">{nomes}</b>.</p>
      </div>
      <div className="rounded-2xl bg-brand-sand/60 p-4">
        <BilheteData v={{ ...v, vagas: 0 }} compacto />
      </div>
      <p className="text-[15px] text-slate-600 text-center flex items-start justify-center gap-2">
        <MessageCircle size={17} className="text-brand-green-light shrink-0 mt-0.5" />
        <span>Nossa equipe vai falar com você pelo WhatsApp com as orientações.</span>
      </p>
      <a href={linkAgenda(v)} target="_blank" rel="noopener noreferrer"
        className="w-full h-12 rounded-xl border border-[#E7DFCB] bg-brand-cream text-[15px] font-semibold text-brand-green-dark inline-flex items-center justify-center gap-2 hover:border-brand-green-light transition">
        <CalendarPlus size={17} /> Salvar na agenda
      </a>
      {temOutras && (
        <button type="button" onClick={onOutra} className="w-full text-[14px] font-semibold text-brand-green-light hover:text-brand-green-dark">Ver outras vivências</button>
      )}
    </section>
  );
}
