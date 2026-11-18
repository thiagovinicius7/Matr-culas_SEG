import React, { useEffect, useState } from 'react';
import { Shirt, Loader2, Plus, Send, CheckCircle2, Undo2, Trash2, Info } from 'lucide-react';
import { watchAuthState, signInAsPublicVisitor } from '../firebase';
import { separarLista } from '../uniformes/uniformes';
import { carregarCatalogo } from '../uniformes/uniformesDb';
import { enviarProposta, novoIdProposta, type PecaProposta } from '../uniformes/catalogoPropostas';

/**
 * Formulário público (?catalogoUniformes=1 ou /uniformes-catalogo/) para atualizar o catálogo de
 * uniformes: preços, peças, cores, tamanhos e observações. Quem recebe o link vê o catálogo atual,
 * ajusta e envia. O envio vira uma PROPOSTA que a equipe confere e aplica na aba Uniformes —
 * o catálogo em si não é alterado por este formulário.
 */

const LOGO = 'https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png';
const inputCls = 'w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-green-light focus:outline-none';
const labelCls = 'text-[11px] font-bold text-slate-500';

interface Linha { id: string; nome: string; cores: string; tamanhos: string; preco: string; obs: string; ativo: boolean; original: boolean }

const precoNum = (s: string) => Number(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

export default function CatalogoUniformesPublica() {
  const [pronto, setPronto] = useState(false);
  const [erroSessao, setErroSessao] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [obsGeral, setObsGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const unsub = watchAuthState((user) => {
      if (!user) {
        signInAsPublicVisitor().catch(() => setErroSessao('Não foi possível abrir o formulário. Atualize a página e tente de novo.'));
        return;
      }
      carregarCatalogo()
        .then(cat => {
          setLinhas(cat.map(p => ({
            id: p.id, nome: p.nome, cores: p.cores.join(', '), tamanhos: p.tamanhos.join(', '),
            preco: p.preco.toFixed(2).replace('.', ','), obs: p.obs || '', ativo: p.ativo, original: true,
          })));
          setPronto(true);
        })
        .catch(() => setErroSessao('Não foi possível carregar o catálogo agora. Tente de novo em alguns minutos.'));
    });
    return unsub;
  }, []);

  const mudar = (id: string, campo: keyof Linha, v: string | boolean) => setLinhas(ls => ls.map(l => (l.id === id ? { ...l, [campo]: v } : l)));
  const nova = () => setLinhas(ls => [...ls, {
    id: `novo-${Date.now().toString(36)}`, nome: '', cores: '', tamanhos: '2, 4, 6, 8, 10, 12, 14, P', preco: '', obs: '', ativo: true, original: false,
  }]);

  const enviar = async () => {
    setErro('');
    if (nome.trim().length < 2) { setErro('Escreva seu nome ou o nome da empresa.'); return; }
    const pecas: PecaProposta[] = [];
    for (const l of linhas) {
      if (!l.original && !l.nome.trim()) continue; // linha nova em branco
      const preco = precoNum(l.preco);
      const cores = separarLista(l.cores), tamanhos = separarLista(l.tamanhos);
      if (l.ativo && (!l.nome.trim() || !(preco > 0) || cores.length === 0 || tamanhos.length === 0)) {
        setErro(`Confira "${l.nome || 'peça nova'}": precisa de nome, preço, pelo menos uma cor e um tamanho.`); return;
      }
      pecas.push({ id: l.id, nome: l.nome.trim().slice(0, 100), cores: cores.slice(0, 20), tamanhos: tamanhos.slice(0, 30), preco: Number.isFinite(preco) ? Math.round(preco * 100) / 100 : 0, obs: l.obs.trim().slice(0, 300), ativo: l.ativo });
    }
    if (pecas.length === 0) { setErro('Nenhuma peça para enviar.'); return; }
    setEnviando(true);
    try {
      await enviarProposta({
        id: novoIdProposta(), criadaEm: new Date().toISOString(), nome: nome.trim().slice(0, 120), contato: contato.trim().slice(0, 60),
        obsGeral: obsGeral.trim().slice(0, 2000), pecas, status: 'nova',
      });
      setEnviado(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErro('Não foi possível enviar agora. Tente de novo em alguns minutos.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand/60 font-sans py-6 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-green-dark text-white px-6 py-7 text-center">
          <div className="bg-white inline-flex p-2 rounded-xl mb-3">
            <img src={LOGO} alt="Sítio-Escola Geranium" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight uppercase">Sítio-Escola Geranium</h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium mt-1 flex items-center justify-center gap-1.5">
            <Shirt size={14} /> Atualização do catálogo de uniformes
          </p>
        </div>

        <div className="p-5 sm:p-8 space-y-6">
          {!pronto && !erroSessao && (
            <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand-orange" size={28} /> Carregando…
            </div>
          )}
          {erroSessao && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erroSessao}</p>}

          {enviado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
              <p className="font-display font-bold text-lg text-brand-green-dark">Recebemos as informações. Obrigado!</p>
              <p className="text-sm text-slate-700">A equipe do Sítio-Escola Geranium vai conferir e atualizar o catálogo.</p>
              <button onClick={() => setEnviado(false)} className="text-sm font-bold text-brand-green-light underline">Voltar ao formulário</button>
            </div>
          )}

          {pronto && !enviado && (
            <>
              <p className="text-sm text-slate-600 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5 text-brand-green-light" />
                <span>Estas são as peças que o Sítio-Escola Geranium vende hoje. Ajuste o que mudou, inclua peças novas ou tire as que saíram, e clique em <strong>Enviar</strong>. Cores e tamanhos vão separados por vírgula.</span>
              </p>

              <div className="space-y-3">
                {linhas.map(l => (
                  <div key={l.id} className={`rounded-xl border p-4 space-y-3 ${!l.ativo ? 'border-slate-200 bg-slate-50 opacity-70' : l.original ? 'border-slate-200' : 'border-brand-orange/50 bg-orange-50/40'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <label className={labelCls}>{l.original ? 'Peça' : 'Peça nova'}</label>
                        <input className={inputCls} value={l.nome} onChange={e => mudar(l.id, 'nome', e.target.value)} disabled={!l.ativo} placeholder="Ex.: Bermuda moletom" />
                      </div>
                      <div className="w-32 space-y-1">
                        <label className={labelCls}>Preço (R$)</label>
                        <input className={inputCls} value={l.preco} onChange={e => mudar(l.id, 'preco', e.target.value)} inputMode="decimal" disabled={!l.ativo} placeholder="0,00" />
                      </div>
                    </div>
                    {l.ativo && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><label className={labelCls}>Cores</label><input className={inputCls} value={l.cores} onChange={e => mudar(l.id, 'cores', e.target.value)} placeholder="Laranja, Verde" /></div>
                        <div className="space-y-1"><label className={labelCls}>Tamanhos</label><input className={inputCls} value={l.tamanhos} onChange={e => mudar(l.id, 'tamanhos', e.target.value)} placeholder="2, 4, 6, 8, 10, 12, 14, P" /></div>
                        <div className="sm:col-span-2 space-y-1"><label className={labelCls}>Observação (opcional)</label><input className={inputCls} value={l.obs} onChange={e => mudar(l.id, 'obs', e.target.value)} placeholder="Aparece para as famílias no pedido (ex.: tecido, uso)" /></div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      {l.original ? (
                        <button type="button" onClick={() => mudar(l.id, 'ativo', !l.ativo)}
                          className={`text-xs font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${l.ativo ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                          {l.ativo ? <><Trash2 size={13} /> Não vende mais</> : <><Undo2 size={13} /> Voltar a vender</>}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setLinhas(ls => ls.filter(x => x.id !== l.id))}
                          className="text-xs font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                          <Trash2 size={13} /> Tirar esta linha
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={nova} className="w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2">
                  <Plus size={16} /> Incluir peça nova
                </button>
              </div>

              <div className="border-t border-slate-200 pt-5 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><label className={labelCls}>Seu nome ou empresa</label><input className={inputCls} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" /></div>
                  <div className="space-y-1"><label className={labelCls}>WhatsApp ou e-mail (opcional)</label><input className={inputCls} value={contato} onChange={e => setContato(e.target.value)} /></div>
                </div>
                <div className="space-y-1"><label className={labelCls}>Observações gerais (prazo de entrega, pedido mínimo…)</label><textarea rows={3} className={inputCls} value={obsGeral} onChange={e => setObsGeral(e.target.value)} /></div>
                {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" role="alert">{erro}</p>}
                <button type="button" onClick={enviar} disabled={enviando}
                  className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-bold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
