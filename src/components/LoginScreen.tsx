import React, { useState } from 'react';
import { Sprout, Lock, Mail, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { signIn, requestPasswordReset } from '../firebase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const friendlyError = (code: string): string => {
    switch (code) {
      case 'auth/invalid-email':
        return 'E-mail inválido.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
      default:
        return 'Não foi possível entrar. Tente novamente.';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }
    setError('');
    setResetSent(false);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      onLoginSuccess();
    } catch (err: any) {
      setError(friendlyError(err?.code || ''));
      setIsWiggling(true);
      setTimeout(() => setIsWiggling(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de redefinição.');
      return;
    }
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err: any) {
      setError(friendlyError(err?.code || ''));
    }
  };

  return (
    <div className="min-h-screen w-screen bg-brand-cream flex flex-col items-center justify-center p-4 font-sans text-slate-800" id="login-viewport">
      <motion.div
        animate={isWiggling ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col"
        id="login-card"
      >
        {/* Banner Section */}
        <div className="bg-brand-green-dark p-6 text-center text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-green-light/20 rounded-full blur-xl pointer-events-none"></div>

          <div className="mx-auto mb-3 flex items-center justify-center p-2 bg-white/95 rounded-xl shadow-md max-w-[180px]">
            <img
              src="https://sitioescolageranium.com.br/imagens/logo-sitio-escola-geranium.png"
              alt="Sítio-Escola Geranium"
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="font-display font-bold text-lg tracking-tight">Sítio-Escola Geranium</h1>
          <p className="text-[10px] text-brand-sand mt-1 uppercase tracking-wider font-bold">Gestor de Matrículas</p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Lock size={14} className="text-brand-orange" />
              Acesso Restrito
            </h2>
            <p className="text-[11px] text-slate-500">
              Entre com o e-mail e a senha da sua conta da equipe.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Mail size={11} /> E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setResetSent(false); }}
                placeholder="seuemail@geranium.com.br"
                autoFocus
                autoComplete="username"
                className="w-full text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-green-light focus:outline-none focus:ring-1 focus:ring-brand-green-light/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); setResetSent(false); }}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  className="w-full text-sm px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-green-light focus:outline-none focus:ring-1 focus:ring-brand-green-light/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1 text-rose-600 justify-center text-[11px] font-semibold">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
            )}
            {resetSent && (
              <div className="text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3">
                Enviamos um link de redefinição de senha para o seu e-mail.
              </div>
            )}

            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-center text-[11px] font-bold text-brand-orange hover:underline cursor-pointer"
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-brand-green-dark hover:bg-brand-green-light text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all uppercase tracking-wider font-display disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Acessar Sistema
          </button>

          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            Não tem uma conta? Peça à direção da escola para criar seu acesso.
          </p>
        </form>
      </motion.div>
      <div className="mt-4 text-[9px] text-slate-400 font-mono text-center">
        Sítio-Escola Geranium © {new Date().getFullYear()} • Todos os direitos reservados
      </div>
    </div>
  );
}
