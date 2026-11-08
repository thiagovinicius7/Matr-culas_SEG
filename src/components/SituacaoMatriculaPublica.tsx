import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Sprout, Loader2, Search, CheckCircle2, Clock, FileText, Copy, Check, MessageCircle, ShieldCheck } from 'lucide-react';
import { watchAuthState, signInAsPublicVisitor, getDocumentById } from '../firebase';
import {
  COLECAO_SITUACAO, PIX_CHAVE, PIX_CHAVE_FORMATADA, ZAP_FINANCEIRO_FORMATADO, PERCENTUAL_DESCONTO_JANEIRO,
  cpfValido, hashCpf, soDigitos, gerarPixCopiaECola, linkZapComprovante, linkZapDuvida, moeda,
} from '../situacao/situacao';
import type { SituacaoDoc, CriancaSituacao } from '../situacao/situacao';

/**
 * Página pública (?situacao=1): a família digita o CPF da criança (ou do responsável) e vê a
 * situação da matrícula 2027, o valor da 1ª parcela da mensalidade de janeiro, o Pix e o botão
 * para mandar o comprovante pelo WhatsApp. Renderizada fora do App principal (ver main.tsx):
 * não carrega nenhum dado de alunos, só lê o resumo publicado para aquele CPF.
 */

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';

const mascaraCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export default function SituacaoMatriculaPublica() {
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [erroSessao, setErroSessao] = useState('');
  const [cpf, setCpf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<SituacaoDoc | null | undefined>(undefined);

  useEffect(() => {
    const unsub = watchAuthState((user) => {
      if (!user) {
        signInAsPublicVisitor().catch(() => setErroSessao('Não foi possível abrir a página. Atualize e tente de novo.'));
        return;
      }
      setSessaoPronta(true);
    });
    return unsub;
  }, []);

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!cpfValido(cpf)) { setErro('Confira o CPF: ele precisa ter 11 números e ser válido.'); return; }
    setBuscando(true);
    try {
      const id = await hashCpf(cpf);
      const doc = await getDocumentById<SituacaoDoc>(COLECAO_SITUACAO, id);
      setResultado(doc);
    } catch {
      setErro('Não foi possível consultar agora. Tente de novo em alguns minutos ou fale com o financeiro.');
    } finally {
      setBuscando(false);
    }
  };

  const limpar = () => { setResultado(undefined); setCpf(''); setErro(''); };

  return (
    <div className="min-h-screen bg-brand-sand/60 font-sans py-6 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-green-dark text-white px-6 py-7 text-center">
          <div className="bg-white inline-flex p-2 rounded-xl mb-3">
            <img src={LOGO} alt="Sítio-Escola Geranium" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <Sprout size={14} /> Situação da matrícula 2027
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {!sessaoPronta && !erroSessao && (
            <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand-orange" size={28} /> Carregando…
            </div>
          )}
          {erroSessao && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erroSessao}</p>}

          {sessaoPronta && resultado === undefined && (
            <form onSubmit={consultar} className="space-y-4">
              <p className="text-sm text-slate-600">
                Digite o CPF do responsável financeiro para ver a situação da matrícula, os contratos e o pagamento da 1ª parcela.
              </p>
              <div className="space-y-1">
                <label htmlFor="cpf-consulta" className="text-[11px] font-bold text-slate-500">CPF</label>
                <input
                  id="cpf-consulta" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))}
                  className="w-full text-lg tracking-wide px-3 py-3 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none"
                />
              </div>
              {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{erro}</p>}
              <button type="submit" disabled={buscando}
                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Consultar
              </button>
              <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <ShieldCheck size={13} className="shrink-0 mt-0.5" /> O CPF é usado só para localizar a matrícula e não fica guardado nesta página.
              </p>
            </form>
          )}

          {sessaoPronta && resultado === null && (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
                Não encontramos uma matrícula 2027 com esse CPF. Confira o número ou fale com a escola.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={linkZapDuvida()} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2">
                  <MessageCircle size={16} /> Falar com o financeiro
                </a>
                <button onClick={limpar} className="flex-1 border border-slate-300 text-slate-700 font-bold rounded-xl py-3 text-sm">Tentar outro CPF</button>
              </div>
            </div>
          )}

          {sessaoPronta && resultado && (
            <div className="space-y-6">
              {resultado.criancas.map(c => <CartaoCrianca key={c.nome} c={c} />)}
              <button onClick={limpar} className="w-full border border-slate-300 text-slate-600 font-bold rounded-xl py-2.5 text-sm">Consultar outro CPF</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-4">Dúvidas? Financeiro: {ZAP_FINANCEIRO_FORMATADO}</p>
    </div>
  );
}

function CartaoCrianca({ c }: { c: CriancaSituacao }) {
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState<'pix' | 'chave' | ''>('');
  const codigo = c.liberado ? gerarPixCopiaECola(c.novembro) : '';

  useEffect(() => {
    if (!codigo) return;
    QRCode.toDataURL(codigo, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [codigo]);

  const copiar = async (texto: string, qual: 'pix' | 'chave') => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(''), 2500); } catch { /* sem permissão: a pessoa copia na mão */ }
  };

  const rotuloAndamento = {
    assinado: { t: 'Contrato assinado', cls: 'bg-emerald-100 text-emerald-800', ic: <CheckCircle2 size={14} /> },
    aguardando: { t: 'Contrato enviado por e-mail, aguardando assinatura', cls: 'bg-amber-100 text-amber-900', ic: <Clock size={14} /> },
    preparando: { t: 'Contrato em preparação', cls: 'bg-slate-100 text-slate-700', ic: <FileText size={14} /> },
  }[c.andamento];

  return (
    <section className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-brand-cream px-4 py-4 border-b border-slate-200 space-y-2">
        <h2 className="font-display font-bold text-lg text-brand-green-dark leading-tight">{c.nome}</h2>
        <p className="text-sm text-slate-600">Turma em 2027: <strong className="text-slate-800">{c.turma}</strong></p>
        <p className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${rotuloAndamento.cls}`}>{rotuloAndamento.ic}{rotuloAndamento.t}</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Documentos</h3>
        <ul className="space-y-1.5">
          {c.contratos.map(d => (
            <li key={d.nome} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-700">{d.nome}</span>
              <span className={`text-xs font-bold ${d.status === 'assinado' ? 'text-emerald-700' : d.status === 'enviado' ? 'text-amber-800' : 'text-slate-500'}`}>
                {d.status === 'assinado' ? 'Assinado' : d.status === 'enviado' ? 'Aguardando assinatura' : 'Em preparação'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {c.liberado ? (
        <div className="px-4 pb-5 space-y-4">
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mensalidade de janeiro de 2027</h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">Valor da mensalidade</dt><dd className="font-bold text-slate-800">{moeda(c.mensalidade)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-emerald-700">Desconto de {PERCENTUAL_DESCONTO_JANEIRO}% (aceite em outubro)</dt><dd className="font-bold text-emerald-700">− {moeda(c.desconto)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5"><dt className="text-slate-600">Restante, dividido em duas parcelas iguais</dt><dd className="font-bold text-slate-800">{moeda(c.novembro + c.janeiro)}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg bg-brand-orange text-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide opacity-90">1ª parcela · novembro</div>
                <div className="text-xl font-black">{moeda(c.novembro)}</div>
                <div className="text-[11px] opacity-90">pague neste mês</div>
              </div>
              <div className="rounded-lg bg-slate-100 text-slate-800 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">2ª parcela · janeiro</div>
                <div className="text-xl font-black">{moeda(c.janeiro)}</div>
                <div className="text-[11px] text-slate-500">junto com o início do ano</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-brand-green-dark p-4 space-y-3">
            <h3 className="text-sm font-bold text-brand-green-dark">Pague a 1ª parcela via Pix</h3>
            {qr && <img src={qr} alt={`QR code do Pix de ${moeda(c.novembro)}`} className="w-56 h-56 mx-auto rounded-lg border border-slate-200" />}
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
              <p>Valor: <strong>{moeda(c.novembro)}</strong></p>
            </div>
          </div>

          <div className="space-y-2">
            <a href={linkZapComprovante(c)} target="_blank" rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2">
              <MessageCircle size={18} /> Já paguei: enviar comprovante
            </a>
            <p className="text-[11px] text-slate-500 text-center">Vai abrir o WhatsApp do financeiro com a mensagem pronta. É só anexar o comprovante e enviar.</p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-5 space-y-3">
          <div className="border-t border-slate-200 pt-4 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            O pagamento da 1ª parcela da mensalidade de janeiro desta família será combinado diretamente com o financeiro.
          </div>
          <a href={linkZapDuvida(c.nome)} target="_blank" rel="noopener noreferrer"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2">
            <MessageCircle size={16} /> Falar com o financeiro
          </a>
        </div>
      )}
    </section>
  );
}
