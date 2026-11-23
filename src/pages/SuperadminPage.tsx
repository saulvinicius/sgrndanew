import React, { useEffect, useState } from 'react';
import { Shield, LogOut, RefreshCw } from 'lucide-react';
import { MarketingLayout } from '../components/layout/MarketingLayout.tsx';
import {
  Button,
  InlineAlert,
  SkeletonRows,
  StatusIndicator,
} from '../components/ui/Primitives.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest, getAdminToken, setAdminToken } from '../lib/api.ts';
import { formatBRL, formatIsoDateTimeBR } from '../lib/format.ts';

interface AdminOverview {
  metrics: {
    totalBusinesses: number;
    activeBusinesses: number;
    onboardingBusinesses: number;
    suspendedBusinesses: number;
    mrrCents: number;
    totalRevenueCents: number;
    totalAppointments: number;
  };
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    segment: string;
    status: string;
    appointmentsCount: number;
    subscription: {
      id: string;
      status: string;
      price_cents: number;
      current_period_end: string | null;
    } | null;
  }>;
  payments: Array<{
    id: string;
    business_name: string;
    amount_cents: number;
    status: string;
    provider_payment_id: string;
    created_at: string;
  }>;
  webhookEvents: Array<{
    id: string;
    event_id: string;
    event_type: string;
    payload_summary: string;
    processed_at: string;
  }>;
  auditLogs: Array<{
    id: string;
    actor_email: string;
    action: string;
    details: string;
    created_at: string;
  }>;
}

export function SuperadminPage() {
  const { showToast } = useToast();
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [bootstrap, setBootstrap] = useState<{
    requiresClaim: boolean;
    envPasscodeSet: boolean;
  } | null>(null);

  const [name, setName] = useState('Administrador AgendaFlat');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [tab, setTab] = useState<'businesses' | 'payments' | 'webhooks' | 'audit'>('businesses');

  useEffect(() => {
    apiRequest<{ requiresClaim: boolean; envPasscodeSet: boolean }>(
      '/api/admin/bootstrap-status',
      { authMode: 'none' },
    )
      .then(setBootstrap)
      .catch(() => setBootstrap({ requiresClaim: false, envPasscodeSet: false }));
  }, []);

  async function loadOverview() {
    setLoadingData(true);
    try {
      const data = await apiRequest<AdminOverview>('/api/admin/overview', { authMode: 'admin' });
      setOverview(data);
    } catch {
      setAdminToken(null);
      setAuthed(false);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (authed) {
      loadOverview();
    }
  }, [authed]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await apiRequest<{ token: string }>('/api/admin/claim', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ name, email, password }),
      });
      setAdminToken(res.token);
      setAuthed(true);
      showToast('Superadmin configurado e autenticado.');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await apiRequest<{ token: string }>('/api/admin/login', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ email, password }),
      });
      setAdminToken(res.token);
      setAuthed(true);
      showToast('Acesso administrativo liberado.');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function updateBusinessStatus(bizId: string, status: 'active' | 'suspended') {
    try {
      await apiRequest(`/api/admin/businesses/${bizId}/status`, {
        method: 'PATCH',
        authMode: 'admin',
        body: JSON.stringify({ status }),
      });
      showToast('Status do estabelecimento atualizado.');
      loadOverview();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  async function simulateWebhook(
    businessId: string,
    subscriptionId: string,
    status: 'approved' | 'rejected',
  ) {
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/webhooks/simulate', {
        method: 'POST',
        authMode: 'admin',
        body: JSON.stringify({ business_id: businessId, subscription_id: subscriptionId, status }),
      });
      showToast(res.message);
      loadOverview();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  if (!authed) {
    return (
      <MarketingLayout>
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[#116B45]">
              <Shield className="w-5 h-5" />
              <h1 className="font-display text-xl font-bold">
                {bootstrap?.requiresClaim
                  ? 'Configurar primeiro Superadmin'
                  : 'Administração Global AgendaFlat'}
              </h1>
            </div>
            <p className="mt-2 text-sm text-[#252D29]/75">
              {bootstrap?.requiresClaim
                ? 'Nenhum administrador foi definido neste ambiente. Crie a credencial inicial protegida no servidor.'
                : bootstrap?.envPasscodeSet
                  ? 'Informe o código administrativo configurado em ADMIN_PASSCODE.'
                  : 'Entre com suas credenciais de Superadmin.'}
            </p>

            <form
              onSubmit={bootstrap?.requiresClaim ? handleClaim : handleLogin}
              className="mt-6 space-y-4"
            >
              {authError ? <InlineAlert tone="error">{authError}</InlineAlert> : null}

              {bootstrap?.requiresClaim ? (
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">Nome</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
              ) : null}

              {!bootstrap?.envPasscodeSet ? (
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@agendaflat.com.br"
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-[#252D29]">
                  {bootstrap?.envPasscodeSet ? 'Código administrativo' : 'Senha (mín. 8 caracteres)'}
                </label>
                <input
                  type="password"
                  required
                  minLength={bootstrap?.requiresClaim ? 8 : 4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                />
              </div>

              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading
                  ? 'Autenticando...'
                  : bootstrap?.requiresClaim
                    ? 'Definir Superadmin e entrar'
                    : 'Entrar na administração'}
              </Button>
            </form>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-[#252D29]">
      <header className="bg-white border-b border-[#E3EAE6]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-[#116B45]">AgendaFlat Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={loadOverview}>
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdminToken(null);
                setAuthed(false);
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loadingData && !overview ? (
          <SkeletonRows count={5} />
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
                <div className="text-xs text-[#252D29]/70">MRR ativo</div>
                <div className="mt-1 font-mono text-2xl font-bold text-[#116B45] tabular-nums">
                  {formatBRL(overview.metrics.mrrCents)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
                <div className="text-xs text-[#252D29]/70">Receita acumulada</div>
                <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                  {formatBRL(overview.metrics.totalRevenueCents)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
                <div className="text-xs text-[#252D29]/70">Estabelecimentos</div>
                <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                  {overview.metrics.activeBusinesses} / {overview.metrics.totalBusinesses}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
                <div className="text-xs text-[#252D29]/70">Agendamentos na base</div>
                <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                  {overview.metrics.totalAppointments}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-[#DFE5E2] rounded-lg w-fit">
              {(
                [
                  ['businesses', 'Estabelecimentos'],
                  ['payments', 'Pagamentos'],
                  ['webhooks', 'Eventos Webhook'],
                  ['audit', 'Auditoria'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    tab === key
                      ? 'bg-[#168653] text-white'
                      : 'text-[#252D29]/75 hover:text-[#116B45]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'businesses' ? (
              <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                      <th className="py-3 px-4 font-medium">Estabelecimento</th>
                      <th className="py-3 px-4 font-medium">Segmento</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Assinatura</th>
                      <th className="py-3 px-4 font-medium text-right">Reservas</th>
                      <th className="py-3 px-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EEEC]">
                    {overview.businesses.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F5F7F6]/60">
                        <td className="py-3 px-4">
                          <div className="font-medium">{b.name}</div>
                          <div className="text-xs font-mono text-[#252D29]/60">/{b.slug}</div>
                        </td>
                        <td className="py-3 px-4 text-[#252D29]/80">{b.segment}</td>
                        <td className="py-3 px-4">
                          <StatusIndicator status={b.status} />
                        </td>
                        <td className="py-3 px-4">
                          {b.subscription ? <StatusIndicator status={b.subscription.status} /> : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {b.appointmentsCount}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {b.status === 'active' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => updateBusinessStatus(b.id, 'suspended')}
                              >
                                Suspender
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => updateBusinessStatus(b.id, 'active')}
                              >
                                Ativar
                              </Button>
                            )}
                            {b.subscription ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  simulateWebhook(b.id, b.subscription!.id, 'approved')
                                }
                              >
                                Simular renovação
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === 'payments' ? (
              <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                      <th className="py-3 px-4 font-medium">Estabelecimento</th>
                      <th className="py-3 px-4 font-medium">ID Provedor</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Valor</th>
                      <th className="py-3 px-4 font-medium text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EEEC]">
                    {overview.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-medium">{p.business_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#252D29]/70">
                          {p.provider_payment_id}
                        </td>
                        <td className="py-3 px-4">
                          <StatusIndicator status={p.status} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatBRL(p.amount_cents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {formatIsoDateTimeBR(p.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === 'webhooks' ? (
              <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                      <th className="py-3 px-4 font-medium">Evento</th>
                      <th className="py-3 px-4 font-medium">Tipo</th>
                      <th className="py-3 px-4 font-medium">Resumo</th>
                      <th className="py-3 px-4 font-medium text-right">Processado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EEEC]">
                    {overview.webhookEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[#252D29]/65">
                          Nenhum evento webhook recebido ainda.
                        </td>
                      </tr>
                    ) : (
                      overview.webhookEvents.map((w) => (
                        <tr key={w.id}>
                          <td className="py-3 px-4 font-mono text-xs">{w.event_id}</td>
                          <td className="py-3 px-4 font-mono text-xs">{w.event_type}</td>
                          <td className="py-3 px-4">{w.payload_summary}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                            {formatIsoDateTimeBR(w.processed_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === 'audit' ? (
              <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                      <th className="py-3 px-4 font-medium">Ator</th>
                      <th className="py-3 px-4 font-medium">Ação</th>
                      <th className="py-3 px-4 font-medium">Detalhes</th>
                      <th className="py-3 px-4 font-medium text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EEEC]">
                    {overview.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 font-mono text-xs">{log.actor_email}</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#116B45]">{log.action}</td>
                        <td className="py-3 px-4">{log.details}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {formatIsoDateTimeBR(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
