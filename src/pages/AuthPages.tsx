import React, { useState } from 'react';
import { MarketingLayout } from '../components/layout/MarketingLayout.tsx';
import { Button, InlineAlert } from '../components/ui/Primitives.tsx';
import { AuthBusiness, AuthUser, useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { SEGMENTS } from '../lib/format.ts';
import { Link, useRouter } from '../lib/router.tsx';

export function LoginPage() {
  const { setSession } = useAuth();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{
        token: string;
        user: AuthUser;
        business: AuthBusiness | null;
      }>('/api/auth/login', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.user, res.business);
      showToast('Bem-vindo de volta ao AgendaFlat.');
      if (res.business?.status === 'active') {
        navigate('/painel');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingLayout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#116B45]">Entrar no AgendaFlat</h1>
          <p className="mt-1.5 text-sm text-[#252D29]/75">
            Acesse o painel do seu estabelecimento para gerenciar sua agenda.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#252D29]">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@seunegocio.com.br"
                className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-medium text-[#252D29]">
                  Senha
                </label>
                <Link
                  to="/recuperar-senha"
                  className="text-xs font-medium text-[#116B45] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </Button>
          </form>

          <p className="mt-6 pt-5 border-t border-[#E8EEEC] text-sm text-center text-[#252D29]/75">
            Ainda não tem conta?{' '}
            <Link to="/cadastro" className="font-medium text-[#116B45] hover:underline">
              Cadastrar estabelecimento
            </Link>
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export function RegisterPage() {
  const { setSession } = useAuth();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [segment, setSegment] = useState<string>(SEGMENTS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{
        token: string;
        user: AuthUser;
        business: AuthBusiness;
      }>('/api/auth/register', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ name, email, password, businessName, segment }),
      });
      setSession(res.token, res.user, res.business);
      showToast('Conta criada. Continue a configuração inicial.');
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingLayout>
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#116B45]">
            Crie sua agenda no AgendaFlat
          </h1>
          <p className="mt-1.5 text-sm text-[#252D29]/75">
            Plano único de R$ 19,90/mês após a configuração inicial. Sem taxa por agendamento.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-[#252D29]">
                  Seu nome completo
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Mariana Souza"
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-segment" className="block text-sm font-medium text-[#252D29]">
                  Segmento
                </label>
                <select
                  id="reg-segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm bg-white focus:border-[#168653] focus:outline-none"
                >
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="reg-biz" className="block text-sm font-medium text-[#252D29]">
                Nome do estabelecimento ou nome profissional
              </label>
              <input
                id="reg-biz"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex.: Estúdio Mariana Souza"
                className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-[#252D29]">
                E-mail profissional
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@seunegocio.com.br"
                className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-pass" className="block text-sm font-medium text-[#252D29]">
                Senha (mínimo 6 caracteres)
              </label>
              <input
                id="reg-pass"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha segura"
                className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Criando conta...' : 'Continuar para configuração'}
            </Button>
          </form>

          <p className="mt-6 pt-5 border-t border-[#E8EEEC] text-sm text-center text-[#252D29]/75">
            Já possui conta?{' '}
            <Link to="/login" className="font-medium text-[#116B45] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export function ForgotPasswordPage() {
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [previewTokenHint, setPreviewTokenHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; previewResetToken?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          authMode: 'none',
          body: JSON.stringify({ email }),
        },
      );
      if (res.previewResetToken) {
        setPreviewTokenHint(res.previewResetToken);
        setToken(res.previewResetToken);
      }
      setStep('reset');
      showToast(res.message);
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar recuperação.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ token, password: newPassword }),
      });
      showToast(res.message);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingLayout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#116B45]">Recuperar senha</h1>
          <p className="mt-1.5 text-sm text-[#252D29]/75">
            {step === 'request'
              ? 'Informe seu e-mail cadastrado para gerar um código de redefinição.'
              : 'Informe o token de recuperação e escolha uma nova senha.'}
          </p>

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="mt-6 space-y-4">
              {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
              <div>
                <label htmlFor="rec-email" className="block text-sm font-medium text-[#252D29]">
                  E-mail cadastrado
                </label>
                <input
                  id="rec-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Gerando código...' : 'Solicitar recuperação'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="mt-6 space-y-4">
              {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
              {previewTokenHint ? (
                <InlineAlert tone="info">
                  Ambiente de demonstração sem SMTP: código preenchido automaticamente ({previewTokenHint}).
                </InlineAlert>
              ) : null}
              <div>
                <label htmlFor="rec-token" className="block text-sm font-medium text-[#252D29]">
                  Código / Token de recuperação
                </label>
                <input
                  id="rec-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm font-mono focus:border-[#168653] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="rec-pass" className="block text-sm font-medium text-[#252D29]">
                  Nova senha
                </label>
                <input
                  id="rec-pass"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
}
