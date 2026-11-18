import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Shirt, Loader2, Search, Copy, Check, MessageCircle, ShieldCheck, Send, CheckCircle2, ChevronDown, Info,
} from 'lucide-react';
import { watchAuthState, signInAsPublicVisitor, getDocumentById } from '../firebase';
import {
  COLECAO_SITUACAO, PIX_CHAVE, PIX_CHAVE_FORMATADA, ZAP_FINANCEIRO_FORMATADO,
  cpfValido, hashCpf, soDigitos, gerarPixCopiaECola, moeda,
} from '../situacao/situacao';
import type { SituacaoDoc } from '../situacao/situacao';
import {
  juntarItens, totalItens, qtdPecas, novoCodigo, situacaoDoEnvio, ROTULO_SITUACAO, dataHoraBR,
  linkZapComprovanteUniforme, linkZapDuvidaUniforme,
  type PecaCatalogo, type CampanhaUniforme, type PedidoUniformeDoc, type EnvioUniforme,
} from '../uniformes/uniformes';
import { carregarCatalogo, carregarCampanhas, pedidosDaFamilia, acrescentarEnvio } from '../uniformes/uniformesDb';
import SeletorUniformes, { itensDaSelecao, selecaoIncompleta, type SelecaoUniformes, type CriancaUniforme } from './SeletorUniformes';

/**
 * Página pública (?uniformes=1 ou /uniformes/): a família digita o CPF do responsável financeiro,
 * vê as crianças matriculadas para 2027 e faz o pedido de uniformes. Paga por Pix e manda o
 * comprovante para o WhatsApp do financeiro. Pelo mesmo CPF consulta os pedidos já feitos.
 * Renderizada fora do App principal (ver main.tsx): não carrega dados de alunos.
 */

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const inputCls = 'w-full text-base px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none';

const mascaraCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
};
const mascaraTel = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

interface Familia { hash: string; criancas: CriancaUniforme[]; pedidos: PedidoUniformeDoc[] }

export default function UniformesPublica() {
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [erroSessao, setErroSessao] = useState('');
  const [catalogo, setCatalogo] = useState<PecaCatalogo[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaUniforme[]>([]);
  const [cpf, setCpf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [familia, setFamilia] = useState<Familia | null | undefined>(undefined);
  const [enviado, setEnviado] = useState<EnvioUniforme | null>(null);

  useEffect(() => {
    const unsub = watchAuthState((user) => {
      if (!user) {
        signInAsPublicVisitor().catch(() => setErroSessao('Não foi possível abrir a página. Atualize e tente de novo.'));
        return;
      }
      Promise.all([carregarCatalogo(), carregarCampanhas()])
        .then(([cat, camp]) => { setCatalogo(cat); setCampanhas(camp); setSessaoPronta(true); })
        .catch(() => setErroSessao('Não foi possível carregar os uniformes agora. Tente de novo em alguns minutos.'));
    });
    return unsub;
  }, []);

  const aberta = campanhas.find(c => c.aberta) || null;

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!cpfValido(cpf)) { setErro('Confira o CPF: ele precisa ter 11 números e ser válido.'); return; }
    setBuscando(true);
    try {
      const hash = await hashCpf(cpf);
      const situacao = await getDocumentById<SituacaoDoc>(COLECAO_SITUACAO, hash);
      if (!situacao || situacao.criancas.length === 0) { setFamilia(null); return; }
      const pedidos = await pedidosDaFamilia(hash, campanhas);
      setFamilia({ hash, criancas: situacao.criancas.map(c => ({ nome: c.nome, turma: c.turma })), pedidos });
    } catch {
      setErro('Não foi possível consultar agora. Tente de novo em alguns minutos ou fale com o financeiro.');
    } finally {
      setBuscando(false);
    }
  };

  const recarregarPedidos = async () => {
    if (!familia) return;
    const pedidos = await pedidosDaFamilia(familia.hash, campanhas).catch(() => familia.pedidos);
    setFamilia({ ...familia, pedidos });
  };

  const limpar = () => { setFamilia(undefined); setCpf(''); setErro(''); setEnviado(null); };

  return (
    <div className="min-h-screen bg-brand-sand/60 font-sans py-6 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-green-dark text-white px-6 py-7 text-center">
          <div className="bg-white inline-flex p-2 rounded-xl mb-3">
            <img src={LOGO} alt="Sítio-Escola Geranium" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <Shirt size={14} /> Pedido de uniformes{aberta ? ` · ${aberta.nome}` : ''}
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {!sessaoPronta && !erroSessao && (
            <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand-orange" size={28} /> Carregando…
            </div>
          )}
          {erroSessao && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erroSessao}</p>}

          {sessaoPronta && familia === undefined && (
            <form onSubmit={consultar} className="space-y-4">
              {aberta ? (
                <>
                  {aberta.aviso && <p className="text-sm text-slate-700 bg-brand-cream border border-slate-200 rounded-lg p-3 whitespace-pre-line">{aberta.aviso}</p>}
                  <p className="text-sm text-slate-600">
                    Digite o CPF do responsável financeiro. Vamos mostrar as crianças matriculadas para você escolher as peças de cada uma.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Os pedidos de uniforme estão fechados no momento. Você ainda pode consultar um pedido já feito pelo CPF.
                </p>
              )}
              <div className="space-y-1">
                <label htmlFor="cpf-uniforme" className="text-[11px] font-bold text-slate-500">CPF do responsável financeiro</label>
                <input id="cpf-uniforme" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))}
                  className="w-full text-lg tracking-wide px-3 py-3 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none" />
              </div>
              {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{erro}</p>}
              <button type="submit" disabled={buscando}
                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} {aberta ? 'Continuar' : 'Consultar meu pedido'}
              </button>
              <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <ShieldCheck size={13} className="shrink-0 mt-0.5" /> O CPF é usado só para localizar a matrícula e não fica guardado nesta página.
              </p>
            </form>
          )}

          {sessaoPronta && familia === null && (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
                Não encontramos uma matrícula 2027 com esse CPF. Confira se é o CPF do responsável financeiro ou fale com a escola, que fazemos o pedido para você.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={linkZapDuvidaUniforme('Olá! Quero fazer o pedido de uniformes, mas não encontrei a matrícula pelo CPF.')} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2">
                  <MessageCircle size={16} /> Falar com o financeiro
                </a>
                <button onClick={limpar} className="flex-1 border border-slate-300 text-slate-700 font-bold rounded-xl py-3 text-sm">Tentar outro CPF</button>
              </div>
            </div>
          )}

          {sessaoPronta && familia && (
            <div className="space-y-6">
              {enviado && <EnvioConfirmado envio={enviado} onFechar={() => setEnviado(null)} />}

              {!enviado && aberta && (
                <NovoPedido
                  campanha={aberta} catalogo={catalogo} familia={familia}
                  onEnviado={async (e) => { setEnviado(e); window.scrollTo({ top: 0, behavior: 'smooth' }); await recarregarPedidos(); }}
                />
              )}

              <MeusPedidos familia={familia} campanhas={campanhas} />

              <button onClick={limpar} className="w-full border border-slate-300 text-slate-600 font-bold rounded-xl py-2.5 text-sm">Sair / usar outro CPF</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-4">Dúvidas? Financeiro: {ZAP_FINANCEIRO_FORMATADO}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NovoPedido({ campanha, catalogo, familia, onEnviado }: {
  campanha: CampanhaUniforme; catalogo: PecaCatalogo[]; familia: Familia; onEnviado: (e: EnvioUniforme) => void;
}) {
  const [responsavel, setResponsavel] = useState('');
  const [telefone, setTelefone] = useState('');
  const [selecao, setSelecao] = useState<SelecaoUniformes>({});
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const itens = useMemo(() => itensDaSelecao(selecao, catalogo, familia.criancas), [selecao, catalogo, familia.criancas]);
  const total = totalItens(itens);

  const enviar = async () => {
    setErro('');
    if (responsavel.trim().length < 3) { setErro('Escreva o nome do responsável.'); return; }
    if (soDigitos(telefone).length < 10) { setErro('Escreva um WhatsApp com DDD.'); return; }
    if (itens.length === 0) { setErro('Escolha pelo menos uma peça.'); return; }
    if (selecaoIncompleta(selecao)) { setErro('Escolha o tamanho e a cor de todas as peças.'); return; }
    const juntos = juntarItens(itens);
    const envio: EnvioUniforme = {
      codigo: novoCodigo(), criadoEm: new Date().toISOString(),
      responsavel: responsavel.trim(), telefone: telefone.trim(),
      itens: juntos, total: totalItens(juntos),
      pago: false, entregue: false, cancelado: false, origem: 'link',
      ...(obs.trim() ? { obs: obs.trim().slice(0, 1000) } : {}),
    };
    setEnviando(true);
    try {
      await acrescentarEnvio(campanha.id, familia.hash, envio);
      setSelecao({}); setObs('');
      onEnviado(envio);
    } catch {
      setErro('Não foi possível enviar o pedido. Os pedidos podem ter sido encerrados; atualize a página ou fale com o financeiro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Novo pedido</h2>
        <div className="space-y-1">
          <label htmlFor="resp" className="text-[11px] font-bold text-slate-500">Nome do responsável</label>
          <input id="resp" className={inputCls} value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Seu nome completo" autoComplete="name" />
        </div>
        <div className="space-y-1">
          <label htmlFor="tel" className="text-[11px] font-bold text-slate-500">WhatsApp</label>
          <input id="tel" className={inputCls} value={telefone} onChange={e => setTelefone(mascaraTel(e.target.value))} placeholder="(61) 9…" inputMode="tel" autoComplete="tel" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Escolha as peças de cada criança</h2>
        <SeletorUniformes catalogo={catalogo} criancas={familia.criancas} selecao={selecao} onChange={setSelecao} />
      </div>

      <div className="space-y-1">
        <label htmlFor="obs" className="text-[11px] font-bold text-slate-500">Observação (opcional)</label>
        <textarea id="obs" rows={2} className={inputCls} value={obs} onChange={e => setObs(e.target.value)} placeholder="Algo que a escola precisa saber sobre o pedido" />
      </div>

      <div className="sticky bottom-3 bg-white border border-slate-200 shadow-lg rounded-xl p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{qtdPecas(itens)} {qtdPecas(itens) === 1 ? 'peça' : 'peças'} · total</div>
          <div className="text-xl font-black text-brand-green-dark">{moeda(total)}</div>
        </div>
        <button type="button" onClick={enviar} disabled={enviando || itens.length === 0}
          className="bg-brand-orange hover:bg-brand-orange-hover text-white font-bold rounded-xl px-5 py-3 text-sm flex items-center gap-2 disabled:opacity-50">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar pedido
        </button>
      </div>
      {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{erro}</p>}
      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" /> Depois de enviar, aparece o Pix do valor total. Para mudar um pedido já enviado, fale com o financeiro.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EnvioConfirmado({ envio, onFechar }: { envio: EnvioUniforme; onFechar: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
        <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
        <p className="font-display font-bold text-lg text-brand-green-dark">Pedido enviado!</p>
        <p className="text-sm text-slate-700">Número do pedido: <strong>{envio.codigo}</strong></p>
        <p className="text-sm text-slate-700">Agora é só pagar o Pix e mandar o comprovante para o financeiro.</p>
      </div>
      <PixPedido envio={envio} />
      <button onClick={onFechar} className="w-full border border-slate-300 text-slate-700 font-bold rounded-xl py-2.5 text-sm">Fazer outro pedido</button>
    </div>
  );
}

function PixPedido({ envio }: { envio: EnvioUniforme }) {
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState<'pix' | 'chave' | ''>('');
  const codigo = gerarPixCopiaECola(envio.total);

  useEffect(() => {
    QRCode.toDataURL(codigo, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [codigo]);

  const copiar = async (texto: string, qual: 'pix' | 'chave') => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(''), 2500); } catch { /* a pessoa copia na mão */ }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-brand-green-dark p-4 space-y-3">
        <h3 className="text-sm font-bold text-brand-green-dark">Pague via Pix · {moeda(envio.total)}</h3>
        {qr && <img src={qr} alt={`QR code do Pix de ${moeda(envio.total)}`} className="w-56 h-56 mx-auto rounded-lg border border-slate-200" />}
        <p className="text-xs text-slate-600 text-center">Abra o app do seu banco, escolha <strong>Pix → Ler QR code</strong> ou <strong>Pix copia e cola</strong>.</p>
        <button type="button" onClick={() => copiar(codigo, 'pix')}
          className="w-full bg-brand-green-dark text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2">
          {copiado === 'pix' ? <Check size={16} /> : <Copy size={16} />} {copiado === 'pix' ? 'Código copiado!' : 'Copiar Pix copia e cola'}
        </button>
        <div className="text-xs text-slate-600 text-center space-y-1">
          <p>Ou pague pela chave Pix (CNPJ do Sítio-Escola Geranium):</p>
          <button type="button" onClick={() => copiar(PIX_CHAVE, 'chave')} className="font-bold text-slate-800 underline underline-offset-2">
            {copiado === 'chave' ? 'Chave copiada!' : PIX_CHAVE_FORMATADA}
          </button>
          <p>Valor: <strong>{moeda(envio.total)}</strong></p>
        </div>
      </div>
      <a href={linkZapComprovanteUniforme(envio)} target="_blank" rel="noopener noreferrer"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2">
        <MessageCircle size={18} /> Já paguei: enviar comprovante
      </a>
      <p className="text-[11px] text-slate-500 text-center">Vai abrir o WhatsApp do financeiro com a mensagem pronta. É só anexar o comprovante e enviar.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MeusPedidos({ familia, campanhas }: { familia: Familia; campanhas: CampanhaUniforme[] }) {
  const lista = familia.pedidos
    .flatMap(p => p.envios.map(e => ({ e, lote: campanhas.find(c => c.id === p.campanhaId)?.nome || '' })))
    .sort((a, b) => b.e.criadoEm.localeCompare(a.e.criadoEm));

  if (lista.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Meus pedidos</h2>
      {lista.map(({ e, lote }) => <React.Fragment key={e.codigo}><CartaoEnvio e={e} lote={lote} /></React.Fragment>)}
    </div>
  );
}

function CartaoEnvio({ e, lote }: { e: EnvioUniforme; lote: string }) {
  const [aberto, setAberto] = useState(false);
  const s = situacaoDoEnvio(e);
  return (
    <section className="border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto}
        className="w-full text-left px-4 py-3 bg-brand-cream flex items-start justify-between gap-3">
        <span className="space-y-1 min-w-0">
          <span className="block text-sm font-bold text-slate-800">Pedido {e.codigo} · {moeda(e.total)}</span>
          <span className="block text-[11px] text-slate-500">{dataHoraBR(e.criadoEm)}{lote ? ` · ${lote}` : ''}</span>
          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${ROTULO_SITUACAO[s].chip}`}>{ROTULO_SITUACAO[s].familia}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 mt-1 text-slate-500 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="px-4 py-3 space-y-3">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Peça</th><th className="py-1 text-center">Qtd</th><th className="py-1 text-right">Valor</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {e.itens.map((i, n) => (
                <tr key={n}>
                  <td className="py-1.5"><span className="font-semibold text-slate-800">{i.peca}</span><br /><span className="text-slate-500">{i.crianca} · {i.cor} · tam. {i.tamanho}</span></td>
                  <td className="py-1.5 text-center">{i.qtd}</td>
                  <td className="py-1.5 text-right">{moeda(i.preco * i.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s === 'aguardando' && <PixPedido envio={e} />}
        </div>
      )}
    </section>
  );
}
