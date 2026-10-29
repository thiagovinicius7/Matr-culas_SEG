import React, { useEffect, useMemo, useState } from 'react';
import { Sprout, CalendarDays, Clock, Users, Plus, Trash2, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { watchAuthState, signInAsPublicVisitor } from '../firebase';
import type { Vivencia, VivenciaInscricao } from '../types';
import {
  carregarVivenciasAbertas, inscreverNaVivencia, VagasEsgotadasError, InscricoesEncerradasError,
  dataPorExtenso, horario, faixaEtaria, textoIdade, idadeEm, vagasRestantes, novoId,
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
const inputCls = 'w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none';
const labelCls = 'text-[11px] font-bold text-slate-500';

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

  return (
    <div className="min-h-screen bg-brand-sand/60 font-sans py-6 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-green-dark text-white px-6 py-7 text-center">
          <div className="bg-white inline-flex p-2 rounded-xl mb-3">
            <img src={LOGO} alt="Sítio-Escola Geranium" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <Sprout size={14} /> Inscrição nas Vivências
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {!pronto && !erroCarga && (
            <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand-orange" size={28} /> Carregando…
            </div>
          )}

          {erroCarga && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erroCarga}</p>}

          {pronto && !erroCarga && enviada && (
            <Confirmacao v={enviada.v} criancas={enviada.criancas} onOutra={() => { setEnviada(null); setSelecionadaId(null); }} temOutras={vivencias.length > 1} />
          )}

          {pronto && !erroCarga && !enviada && selecionada && (
            <FormularioInscricao
              v={selecionada}
              onVoltar={vivencias.length > 1 || !vivenciaIdInicial ? () => setSelecionadaId(null) : undefined}
              onSucesso={(criancas, vAtualizada) => {
                setVivencias(vs => vs.map(x => (x.id === vAtualizada.id ? vAtualizada : x)));
                setEnviada({ v: vAtualizada, criancas });
                window.scrollTo(0, 0);
              }}
              onRecarregar={async () => setVivencias(await carregarVivenciasAbertas())}
            />
          )}

          {pronto && !erroCarga && !enviada && !selecionada && (
            <ListaVivencias vivencias={vivencias} linkInvalido={linkInvalido} onEscolher={(id) => { setSelecionadaId(id); window.scrollTo(0, 0); }} />
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-4">Sítio-Escola Geranium · sitioescolageranium.com.br</p>
    </div>
  );
}

function ResumoVivencia({ v }: { v: Vivencia }) {
  const restantes = vagasRestantes(v);
  const faixa = faixaEtaria(v);
  return (
    <div className="space-y-1.5 text-sm text-slate-600">
      <p className="flex items-center gap-2"><CalendarDays size={15} className="text-brand-green-light shrink-0" /> <span className="first-letter:uppercase">{dataPorExtenso(v.data, true)}</span></p>
      {horario(v) && <p className="flex items-center gap-2"><Clock size={15} className="text-brand-green-light shrink-0" /> {horario(v)}</p>}
      {(faixa || restantes !== null) && (
        <p className="flex items-center gap-2"><Users size={15} className="text-brand-green-light shrink-0" />
          {[faixa && `Para crianças ${faixa}`, restantes !== null && (restantes > 0 ? `${restantes} ${restantes === 1 ? 'vaga' : 'vagas'}` : 'Vagas esgotadas')].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}

function ListaVivencias({ vivencias, linkInvalido, onEscolher }: { vivencias: Vivencia[]; linkInvalido: boolean; onEscolher: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {linkInvalido && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          As inscrições para esta vivência foram encerradas ou o link mudou.{vivencias.length ? ' Veja abaixo as vivências com inscrição aberta.' : ''}
        </p>
      )}
      {vivencias.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="font-display font-bold text-brand-green-dark text-lg">Nenhuma vivência com inscrição aberta agora</p>
          <p className="text-sm text-slate-500">Acompanhe nosso Instagram para saber das próximas datas.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">Escolha a vivência em que quer inscrever sua família.</p>
          <div className="space-y-3">
            {vivencias.map(v => {
              const esgotada = vagasRestantes(v) === 0;
              return (
                <button key={v.id} type="button" disabled={esgotada} onClick={() => onEscolher(v.id)}
                  className="w-full text-left border border-slate-200 rounded-xl p-4 hover:border-brand-green-light hover:bg-emerald-50/40 transition disabled:opacity-60 disabled:hover:bg-white disabled:cursor-not-allowed">
                  <p className="font-display font-bold text-brand-green-dark text-base mb-2">{v.titulo}</p>
                  <ResumoVivencia v={v} />
                  {!esgotada && <p className="mt-3 text-sm font-bold text-brand-orange">Inscrever →</p>}
                </button>
              );
            })}
          </div>
        </>
      )}
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
    if (telefone.replace(/\D/g, '').length < 10) { setErro('Confira o telefone: coloque o DDD e o número, por exemplo (61) 99999-9999.'); return; }
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
    <form onSubmit={enviar} className="space-y-6">
      {onVoltar && (
        <button type="button" onClick={onVoltar} className="text-xs font-bold text-slate-500 hover:text-brand-green-dark flex items-center gap-1">
          <ArrowLeft size={14} /> Outras vivências
        </button>
      )}

      <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-4 space-y-2">
        <h2 className="font-display font-bold text-brand-green-dark text-lg leading-tight">{v.titulo}</h2>
        <ResumoVivencia v={v} />
        {v.descricao && <p className="text-sm text-slate-700 whitespace-pre-line pt-1">{v.descricao}</p>}
      </div>

      {esgotada ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">As vagas desta vivência estão esgotadas. Fale com a escola para entrar na lista de espera.</p>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">
              {criancas.length > 1 ? 'Crianças inscritas' : 'Criança inscrita'}
            </h3>
            {criancas.map((c, idx) => (
              <div key={idx} className={criancas.length > 1 ? 'border border-slate-200 rounded-xl p-3 space-y-3' : 'space-y-3'}>
                {criancas.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Criança {idx + 1}</span>
                    <button type="button" onClick={() => setCriancas(cs => cs.filter((_, i) => i !== idx))} className="text-xs text-rose-600 font-bold flex items-center gap-1">
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                )}
                <div className="space-y-1">
                  <label className={labelCls} htmlFor={`cn-${idx}`}>Nome completo da criança</label>
                  <input id={`cn-${idx}`} required className={inputCls} value={c.nome} onChange={e => atualizarCrianca(idx, 'nome', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor={`cd-${idx}`}>Data de nascimento</label>
                  <input id={`cd-${idx}`} type="date" required className={inputCls} value={c.nascimento} onChange={e => atualizarCrianca(idx, 'nascimento', e.target.value)} />
                  {c.nascimento && !avisosIdade[idx] && textoIdade(c.nascimento, v.data) && (
                    <p className="text-[11px] text-slate-500">Na data da vivência: {textoIdade(c.nascimento, v.data)}</p>
                  )}
                  {avisosIdade[idx] && <p className="text-[11px] text-amber-700">{avisosIdade[idx]}</p>}
                </div>
              </div>
            ))}
            {(restantes === null || criancas.length < restantes) && criancas.length < 6 && (
              <button type="button" onClick={() => setCriancas(cs => [...cs, { nome: '', nascimento: '' }])}
                className="text-sm font-bold text-brand-green-light flex items-center gap-1.5 hover:text-brand-green-dark">
                <Plus size={16} /> Inscrever mais uma criança (irmão/irmã)
              </button>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Responsável que acompanha {criancas.length > 1 ? 'as crianças' : 'a criança'}</h3>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="r-nome">Nome do responsável</label>
              <input id="r-nome" required className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls} htmlFor="r-par">Parentesco</label>
                <select id="r-par" className={inputCls} value={parentesco} onChange={e => setParentesco(e.target.value)}>
                  {PARENTESCO_VIVENCIA.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls} htmlFor="r-tel">WhatsApp (com DDD)</label>
                <input id="r-tel" type="tel" inputMode="tel" required placeholder="(61) 99999-9999" className={inputCls} value={telefone} onChange={e => setTelefone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="r-email">E-mail (opcional)</label>
              <input id="r-email" type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-green-dark uppercase tracking-wide border-b border-slate-100 pb-1">Para nos conhecermos</h3>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="r-escola">Escola atual da criança (opcional)</label>
              <input id="r-escola" className={inputCls} value={escolaAtual} onChange={e => setEscolaAtual(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="r-como">Como conheceu o Sítio-Escola Geranium?</label>
              <select id="r-como" className={inputCls} value={comoConheceu} onChange={e => setComoConheceu(e.target.value)}>
                <option value="">Selecione</option>
                {COMO_CONHECEU_OPCOES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="r-obs">Alergias, cuidados ou algo que devemos saber (opcional)</label>
              <textarea id="r-obs" rows={3} className={inputCls} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-600" htmlFor="r-aceite">
            <input id="r-aceite" type="checkbox" required checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-700" />
            Autorizo o Sítio-Escola Geranium a usar estes dados para organizar a vivência e entrar em contato comigo.
          </label>

          {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erro}</p>}

          <button type="submit" disabled={enviando}
            className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : 'Confirmar inscrição'}
          </button>
        </>
      )}
    </form>
  );
}

function Confirmacao({ v, criancas, onOutra, temOutras }: { v: Vivencia; criancas: string[]; onOutra: () => void; temOutras: boolean }) {
  return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
      <h2 className="font-display font-bold text-brand-green-dark text-xl">Inscrição confirmada!</h2>
      <p className="text-sm text-slate-600">
        Inscrição feita para <b>{criancas.join(', ').replace(/, ([^,]*)$/, ' e $1')}</b> na vivência <b>{v.titulo}</b>.
      </p>
      <div className="inline-block text-left bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
        <ResumoVivencia v={{ ...v, vagas: 0 }} />
      </div>
      <p className="text-sm text-slate-600">Nossa equipe vai entrar em contato pelo WhatsApp com as orientações. Até lá!</p>
      {temOutras && (
        <button type="button" onClick={onOutra} className="text-sm font-bold text-brand-green-light hover:text-brand-green-dark">Ver outras vivências</button>
      )}
    </div>
  );
}
