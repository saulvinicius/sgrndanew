import React, { useEffect, useState } from 'react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';
import { MarketingLayout } from '../components/layout/MarketingLayout.tsx';
import { Button, InlineAlert, SkeletonRows } from '../components/ui/Primitives.tsx';
import { AuthBusiness, useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { SEGMENTS, WEEKDAY_NAMES, formatBRL } from '../lib/format.ts';
import { useRouter } from '../lib/router.tsx';

interface WorkingHourRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface OnboardingState {
  business: AuthBusiness;
  services: Array<{
    id: string;
    name: string;
    price_cents: number;
    duration_minutes: number;
    buffer_minutes: number;
  }>;
  workingHours: WorkingHourRow[];
  subscription: {
    id: string;
    status: string;
    external_id: string;
  };
  mercadoPagoConfigured: boolean;
}

export function OnboardingPage() {
  const { user, refreshMe, updateBusiness } = useAuth();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<OnboardingState | null>(null);

  // Step 1
  const [bizName, setBizName] = useState('');
  const [slug, setSlug] = useState('');
  const [segment, setSegment] = useState<string>(SEGMENTS[0]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');

  // Step 2
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('60,00');
  const [svcDuration, setSvcDuration] = useState('45');
  const [svcBuffer, setSvcBuffer] = useState('0');

  // Step 3
  const [hours, setHours] = useState<WorkingHourRow[]>([]);

  // Step 4 sandbox confirmation
  const [checkoutPending, setCheckoutPending] = useState<{
    externalId: string;
    subscriptionId: string;
    businessId: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    apiRequest<OnboardingState>('/api/onboarding/state')
      .then((data) => {
        setState(data);
        setBizName(data.business.name);
        setSlug(data.business.slug);
        setSegment(data.business.segment);
        setPhone(data.business.phone);
        setAddress(data.business.address);
        setTimezone(data.business.timezone);
        const sortedHours = [...data.workingHours].sort((a, b) => a.day_of_week - b.day_of_week);
        setHours(sortedHours);
        if (data.business.status === 'active') {
          navigate('/painel');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  async function saveBusinessStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiRequest<{ business: AuthBusiness }>('/api/onboarding/business', {
        method: 'PUT',
        body: JSON.stringify({ name: bizName, slug, segment, phone, address, timezone }),
      });
      updateBusiness(res.business);
      setSlug(res.business.slug);
      setStep(2);
      showToast('Dados do estabelecimento salvos.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addServiceStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const normalized = Number(svcPrice.replace(/\./g, '').replace(',', '.'));
      const priceCents = Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
      const res = await apiRequest<{ service: OnboardingState['services'][0] }>(
        '/api/onboarding/service',
        {
          method: 'POST',
          body: JSON.stringify({
            name: svcName,
            price_cents: priceCents,
            duration_minutes: Number(svcDuration),
            buffer_minutes: Number(svcBuffer),
          }),
        },
      );
      setState((prev) => (prev ? { ...prev, services: [...prev.services, res.service] } : prev));
      setSvcName('');
      showToast('Serviço adicionado.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveHoursStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/onboarding/hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
      setStep(4);
      showToast('Horários de funcionamento atualizados.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout() {
    setError('');
    setSaving(true);
    try {
      const res = await apiRequest<{
        mode: 'mercadopago_live' | 'sandbox_preview';
        externalId: string;
        initPoint?: string;
        subscription: { id: string };
        businessId?: string;
      }>('/api/subscriptions/checkout', { method: 'POST' });

      if (res.mode === 'mercadopago_live' && res.initPoint) {
        window.location.href = res.initPoint;
        return;
      }

      setCheckoutPending({
        externalId: res.externalId,
        subscriptionId: res.subscription.id,
        businessId: state!.business.id,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmSandboxPayment() {
    if (!checkoutPending) return;
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/webhooks/mercadopago', {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({
          event_id: `evt_checkout_${checkoutPending.externalId}`,
          type: 'subscription_preapproval',
          business_id: checkoutPending.businessId,
          subscription_id: checkoutPending.subscriptionId,
          status: 'approved',
        }),
      });
      await refreshMe();
      showToast('Assinatura confirmada! Sua agenda pública está ativa.');
      navigate('/painel');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MarketingLayout>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <SkeletonRows count={5} />
        </div>
      </MarketingLayout>
    );
  }

  const steps = [
    { num: 1, label: 'Estabelecimento' },
    { num: 2, label: 'Serviços' },
    { num: 3, label: 'Horários' },
    { num: 4, label: 'Assinatura' },
  ] as const;

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#116B45]">
              Configuração inicial do estabelecimento
            </h1>
            <p className="mt-1 text-sm text-[#252D29]/75">
              Você pode salvar seu progresso e continuar depois. A agenda pública é liberada após confirmar a assinatura de R$ 19,90/mês.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/painel')}>
            Continuar depois no painel
          </Button>
        </div>

        {/* Stepper */}
        <div className="mt-6 grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const active = step === s.num;
            const done = step > s.num || (s.num === 2 && (state?.services.length ?? 0) > 0 && step > 2);
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[#168653] bg-[#E8F7EF] text-[#116B45]'
                    : 'border-[#DFE5E2] bg-white text-[#252D29]/75 hover:text-[#252D29]'
                }`}
              >
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {done ? <Check className="w-3.5 h-3.5 text-[#168653]" /> : `0${s.num}`}
                </span>
                <span className="text-xs font-medium truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
          {error ? (
            <div className="mb-5">
              <InlineAlert tone="error">{error}</InlineAlert>
            </div>
          ) : null}

          {step === 1 ? (
            <form onSubmit={saveBusinessStep} className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-[#252D29]">
                01. Dados do estabelecimento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">Nome</label>
                  <input
                    type="text"
                    required
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">Segmento</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm bg-white focus:border-[#168653] focus:outline-none"
                  >
                    {SEGMENTS.map((seg) => (
                      <option key={seg} value={seg}>
                        {seg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#252D29]">
                  Link exclusivo (slug)
                </label>
                <div className="mt-1.5 flex items-center rounded-lg border border-[#D4DDD8] overflow-hidden">
                  <span className="px-3 py-2.5 bg-[#F5F7F6] text-xs font-mono text-[#252D29]/70 border-r border-[#D4DDD8]">
                    /agenda/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">Fuso horário</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm bg-white focus:border-[#168653] focus:outline-none"
                  >
                    <option value="America/Sao_Paulo">America/Sao_Paulo (Brasília)</option>
                    <option value="America/Manaus">America/Manaus (Amazonas)</option>
                    <option value="America/Fortaleza">America/Fortaleza (Nordeste)</option>
                    <option value="America/Cuiaba">America/Cuiaba (Mato Grosso)</option>
                    <option value="America/Rio_Branco">America/Rio_Branco (Acre)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#252D29]">Endereço de atendimento</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro — Cidade/UF"
                  className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar e avançar'}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#252D29]">
                  02. Adicione ao menos um serviço
                </h2>
                <p className="mt-1 text-sm text-[#252D29]/70">
                  Informe duração e intervalo adicional opcional (ex.: higienização entre clientes).
                </p>
              </div>

              <form onSubmit={addServiceStep} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-[#252D29]">Nome do serviço</label>
                  <input
                    type="text"
                    required
                    value={svcName}
                    onChange={(e) => setSvcName(e.target.value)}
                    placeholder="Ex.: Corte Masculino"
                    className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#252D29]">Preço (R$)</label>
                  <input
                    type="text"
                    required
                    value={svcPrice}
                    onChange={(e) => setSvcPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#252D29]">Duração (min)</label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    required
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit" className="w-full" disabled={saving}>
                    Adicionar serviço
                  </Button>
                </div>
              </form>

              <div className="divide-y divide-[#E8EEEC] border-t border-b border-[#E8EEEC]">
                {state?.services.length === 0 ? (
                  <p className="py-4 text-sm text-[#252D29]/70">Nenhum serviço cadastrado ainda.</p>
                ) : (
                  state?.services.map((svc) => (
                    <div key={svc.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-[#252D29]">{svc.name}</span>
                        <span className="ml-2 text-xs text-[#252D29]/65 font-mono tabular-nums">
                          {svc.duration_minutes} min
                          {svc.buffer_minutes > 0 ? ` + ${svc.buffer_minutes} min intervalo` : ''}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-[#116B45] tabular-nums">
                        {formatBRL(svc.price_cents)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button
                  disabled={(state?.services.length ?? 0) === 0}
                  onClick={() => setStep(3)}
                >
                  Avançar para horários
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <form onSubmit={saveHoursStep} className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-[#252D29]">
                03. Horários de funcionamento
              </h2>

              <div className="divide-y divide-[#E8EEEC] border border-[#E8EEEC] rounded-lg">
                {hours.map((row) => (
                  <div
                    key={row.day_of_week}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <input
                        id={`day-${row.day_of_week}`}
                        type="checkbox"
                        checked={!row.is_closed}
                        onChange={(e) => {
                          setHours((prev) =>
                            prev.map((h) =>
                              h.day_of_week === row.day_of_week
                                ? { ...h, is_closed: !e.target.checked }
                                : h,
                            ),
                          );
                        }}
                        className="accent-[#168653] w-4 h-4"
                      />
                      <label htmlFor={`day-${row.day_of_week}`} className="text-sm font-medium">
                        {WEEKDAY_NAMES[row.day_of_week]}
                      </label>
                    </div>

                    {row.is_closed ? (
                      <span className="text-xs text-[#252D29]/60">Fechado</span>
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <input
                          type="time"
                          value={row.start_time}
                          onChange={(e) =>
                            setHours((prev) =>
                              prev.map((h) =>
                                h.day_of_week === row.day_of_week
                                  ? { ...h, start_time: e.target.value }
                                  : h,
                              ),
                            )
                          }
                          className="rounded-md border border-[#D4DDD8] px-2.5 py-1.5 text-sm"
                        />
                        <span className="text-[#252D29]/50">às</span>
                        <input
                          type="time"
                          value={row.end_time}
                          onChange={(e) =>
                            setHours((prev) =>
                              prev.map((h) =>
                                h.day_of_week === row.day_of_week
                                  ? { ...h, end_time: e.target.value }
                                  : h,
                              ),
                            )
                          }
                          className="rounded-md border border-[#D4DDD8] px-2.5 py-1.5 text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="secondary" type="button" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar e ir para assinatura'}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#252D29]">
                  04. Ativar assinatura recorrente
                </h2>
                <p className="mt-1 text-sm text-[#252D29]/75">
                  Assinatura mensal de <strong className="font-mono">R$ 19,90/mês</strong> processada via Mercado Pago. Não há teste grátis: a agenda pública é liberada assim que a confirmação do provedor for validada.
                </p>
              </div>

              <div className="rounded-xl border border-[#CBEAD9] bg-[#E8F7EF] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#116B45]">
                    Plano Profissional AgendaFlat
                  </div>
                  <div className="text-xs text-[#116B45]/80 mt-0.5">
                    Cobrança mensal recorrente · Sem comissão por reserva
                  </div>
                </div>
                <div className="font-mono text-2xl font-bold text-[#116B45] tabular-nums">
                  R$ 19,90/mês
                </div>
              </div>

              {!checkoutPending ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Voltar
                  </Button>
                  <Button
                    size="lg"
                    onClick={startCheckout}
                    disabled={saving || (state?.services.length ?? 0) === 0}
                  >
                    <CreditCard className="w-4 h-4" />
                    {saving ? 'Iniciando checkout...' : 'Autorizar assinatura no Mercado Pago'}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-[#D4DDD8] bg-[#F5F7F6] p-5 space-y-4">
                  <div className="flex items-start gap-2.5 text-sm text-[#252D29]">
                    <ShieldCheck className="w-5 h-5 text-[#168653] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Checkout Mercado Pago (Ambiente de Pré-visualização)</div>
                      <p className="mt-1 text-xs text-[#252D29]/75">
                        Identificador gerado: <span className="font-mono">{checkoutPending.externalId}</span>. Clique abaixo para simular o retorno aprovado do webhook idempotente do Mercado Pago e liberar o estabelecimento.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setCheckoutPending(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={confirmSandboxPayment} disabled={saving}>
                      {saving ? 'Validando webhook...' : 'Confirmar pagamento R$ 19,90'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </MarketingLayout>
  );
}
