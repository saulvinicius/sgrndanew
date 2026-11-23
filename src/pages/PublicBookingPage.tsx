import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  MapPin,
  Phone,
  ArrowLeft,
} from 'lucide-react';
import {
  AvatarImage,
  Button,
  EmptyState,
  InlineAlert,
  SkeletonRows,
} from '../components/ui/Primitives.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import {
  WEEKDAY_NAMES,
  downloadCalendarICS,
  formatBRL,
  formatDateBR,
} from '../lib/format.ts';
import { Link } from '../lib/router.tsx';

interface PublicBusinessPayload {
  business: {
    id: string;
    name: string;
    slug: string;
    segment: string;
    phone: string;
    address: string;
    logo_url: string;
    description: string;
    timezone: string;
    max_future_days: number;
    min_advance_minutes: number;
  };
  bookingEnabled: boolean;
  bookingDisabledReason: string | null;
  services: Array<{
    id: string;
    name: string;
    description: string;
    price_cents: number;
    duration_minutes: number;
    buffer_minutes: number;
  }>;
  professionals: Array<{
    id: string;
    name: string;
    photo_url: string;
    description: string;
  }>;
  links: Array<{ professional_id: string; service_id: string }>;
  workingHours: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_closed: boolean;
  }>;
}

interface SlotItem {
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
}

interface BookingConfirmation {
  id: string;
  business_name: string;
  business_slug: string;
  business_address: string;
  business_phone: string;
  timezone: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  professional_name: string;
  customer_name: string;
  start_at: string;
  end_at: string;
  local: { date: string; time: string };
  cancel_token: string;
  status: string;
}

function getDateStrInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function getUpcomingDateStrings(maxDays: number, timeZone = 'America/Sao_Paulo'): string[] {
  const list: string[] = [];
  const count = Math.min(Math.max(maxDays, 7), 30);
  const todayStr = getDateStrInTimeZone(new Date(), timeZone);
  const [y, m, d] = todayStr.split('-').map(Number);
  for (let i = 0; i < count; i += 1) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    list.push(dt.toISOString().slice(0, 10));
  }
  return list;
}

export function PublicBookingPage({ slug }: { slug: string }) {
  const { showToast } = useToast();
  const [data, setData] = useState<PublicBusinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState('');

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProId, setSelectedProId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() =>
    getDateStrInTimeZone(new Date(Date.now() + 24 * 60 * 60 * 1000), 'America/Sao_Paulo'),
  );
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    setLoading(true);
    setNotFoundError('');
    setConfirmation(null);
    apiRequest<PublicBusinessPayload>(`/api/public/business/${encodeURIComponent(slug)}`, {
      authMode: 'none',
    })
      .then((res) => {
        setData(res);
        if (res.services.length > 0) {
          setSelectedServiceId(res.services[0].id);
        }
      })
      .catch((err) => setNotFoundError(err.message || 'Página não encontrada.'))
      .finally(() => setLoading(false));
  }, [slug]);

  const availableProfessionals = useMemo(() => {
    if (!data || !selectedServiceId) return [];
    const allowedProIds = new Set(
      data.links.filter((l) => l.service_id === selectedServiceId).map((l) => l.professional_id),
    );
    return data.professionals.filter((p) => allowedProIds.has(p.id));
  }, [data, selectedServiceId]);

  useEffect(() => {
    if (availableProfessionals.length > 0) {
      if (!availableProfessionals.some((p) => p.id === selectedProId)) {
        setSelectedProId(availableProfessionals[0].id);
      }
    } else {
      setSelectedProId('');
    }
  }, [availableProfessionals, selectedProId]);

  useEffect(() => {
    if (!data?.bookingEnabled || !selectedServiceId || !selectedProId || !selectedDate) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSlotsError('');
    setSelectedSlot(null);
    const qs = new URLSearchParams({
      serviceId: selectedServiceId,
      professionalId: selectedProId,
      date: selectedDate,
    });
    apiRequest<{ slots: SlotItem[] }>(
      `/api/public/business/${encodeURIComponent(slug)}/availability?${qs.toString()}`,
      { authMode: 'none' },
    )
      .then((res) => setSlots(res.slots))
      .catch((err) => {
        setSlots([]);
        setSlotsError(err.message);
      })
      .finally(() => setLoadingSlots(false));
  }, [data?.bookingEnabled, slug, selectedServiceId, selectedProId, selectedDate]);

  const selectedService = data?.services.find((s) => s.id === selectedServiceId) ?? null;
  const selectedPro = data?.professionals.find((p) => p.id === selectedProId) ?? null;

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedPro || !selectedSlot) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ booking: BookingConfirmation }>(
        `/api/public/business/${encodeURIComponent(slug)}/bookings`,
        {
          method: 'POST',
          authMode: 'none',
          body: JSON.stringify({
            service_id: selectedService.id,
            professional_id: selectedPro.id,
            date: selectedDate,
            start_time: selectedSlot.start_time,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            notes,
            consent,
          }),
        },
      );
      setConfirmation(res.booking);
      showToast('Agendamento confirmado!');
    } catch (err: any) {
      setSubmitError(err.message || 'Não foi possível concluir o agendamento.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7F6] py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <SkeletonRows count={6} />
        </div>
      </div>
    );
  }

  if (notFoundError || !data) {
    return (
      <div className="min-h-screen bg-[#F5F7F6] py-16 px-4">
        <div className="max-w-lg mx-auto">
          <EmptyState
            title="Estabelecimento não encontrado"
            description={notFoundError || 'Verifique o endereço informado.'}
            action={
              <Link to="/" className="text-sm font-medium text-[#116B45] hover:underline">
                Voltar para o AgendaFlat
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const dates = getUpcomingDateStrings(data.business.max_future_days, data.business.timezone);

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-[#252D29]">
      {/* Compact Public Top Header */}
      <header className="bg-white border-b border-[#E3EAE6]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#252D29]/70 hover:text-[#116B45]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>AgendaFlat</span>
          </Link>
          <span className="text-xs font-mono text-[#252D29]/60">
            Fuso: {data.business.timezone}
          </span>
        </div>
      </header>

      <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-8">
        {/* Business Header Card */}
        <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarImage
              src={data.business.logo_url}
              alt={data.business.name}
              name={data.business.name}
              className="w-16 h-16 rounded-xl"
            />
            <div>
              <div className="text-xs font-medium text-[#116B45]">{data.business.segment}</div>
              <h1 className="font-display text-2xl font-bold text-[#252D29]">
                {data.business.name}
              </h1>
              {data.business.description ? (
                <p className="mt-1 text-sm text-[#252D29]/75 max-w-2xl">
                  {data.business.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-[#252D29]/75 space-y-1 sm:text-right shrink-0">
            {data.business.address ? (
              <div className="flex items-center sm:justify-end gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#168653] shrink-0" />
                <span>{data.business.address}</span>
              </div>
            ) : null}
            {data.business.phone ? (
              <div className="flex items-center sm:justify-end gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-[#168653] shrink-0" />
                <span>{data.business.phone}</span>
              </div>
            ) : null}
          </div>
        </div>

        {!data.bookingEnabled ? (
          <div className="mt-6">
            <InlineAlert tone="error">
              {data.bookingDisabledReason ||
                'Este estabelecimento não está aceitando agendamentos online no momento.'}
            </InlineAlert>
          </div>
        ) : confirmation ? (
          <div className="mt-6 bg-white rounded-xl border border-[#CBEAD9] p-6 sm:p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 text-[#116B45]">
              <CheckCircle2 className="w-6 h-6 text-[#168653] shrink-0" />
              <div>
                <h2 className="font-display text-xl font-bold">Agendamento confirmado</h2>
                <p className="text-sm text-[#252D29]/75">
                  Guarde o link abaixo caso precise cancelar ou conferir sua reserva.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-[#F5F7F6] border border-[#E3EAE6] p-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Serviço</span>
                <span className="font-medium">{confirmation.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Profissional</span>
                <span className="font-medium">{confirmation.professional_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Data e horário</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatDateBR(confirmation.local.date)} · {confirmation.local.time} (
                  {confirmation.duration_minutes} min)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Valor registrado</span>
                <span className="font-mono font-semibold text-[#116B45] tabular-nums">
                  {formatBRL(confirmation.price_cents)}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#E3EAE6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#252D29]">Link seguro de cancelamento</div>
                <div className="text-xs font-mono text-[#116B45] truncate">
                  {`${window.location.origin}/cancelar/${confirmation.cancel_token}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${window.location.origin}/cancelar/${confirmation.cancel_token}`,
                    );
                    showToast('Link de cancelamento copiado.');
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </Button>
                <Link
                  to={`/cancelar/${confirmation.cancel_token}`}
                  className="text-xs font-medium text-[#E5484D] hover:underline px-2"
                >
                  Abrir
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCalendarICS({
                    title: `${confirmation.service_name} — ${confirmation.business_name}`,
                    description: `Profissional: ${confirmation.professional_name}`,
                    location: confirmation.business_address || confirmation.business_name,
                    startAtIso: confirmation.start_at,
                    endAtIso: confirmation.end_at,
                  })
                }
              >
                <Download className="w-4 h-4" />
                Adicionar ao calendário (.ics)
              </Button>
              <Button
                onClick={() => {
                  setConfirmation(null);
                  setSelectedSlot(null);
                }}
              >
                Fazer outro agendamento
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Booking Steps */}
            <div className="lg:col-span-8 space-y-6">
              {/* Step 1: Service */}
              <section className="bg-white rounded-xl border border-[#DFE5E2] p-6">
                <h2 className="font-display text-base font-semibold text-[#116B45]">
                  01. Escolha o serviço
                </h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.services.map((svc) => {
                    const active = svc.id === selectedServiceId;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setSelectedServiceId(svc.id)}
                        className={`text-left rounded-lg border p-4 transition-colors cursor-pointer ${
                          active
                            ? 'border-[#168653] bg-[#E8F7EF]'
                            : 'border-[#E2E8E5] bg-white hover:border-[#168653]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm text-[#252D29]">{svc.name}</span>
                          <span className="font-mono text-sm font-semibold text-[#116B45] tabular-nums shrink-0">
                            {formatBRL(svc.price_cents)}
                          </span>
                        </div>
                        {svc.description ? (
                          <p className="mt-1 text-xs text-[#252D29]/70 line-clamp-2">
                            {svc.description}
                          </p>
                        ) : null}
                        <div className="mt-2 text-xs font-mono text-[#252D29]/65 tabular-nums">
                          {svc.duration_minutes} min
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Step 2: Professional */}
              <section className="bg-white rounded-xl border border-[#DFE5E2] p-6">
                <h2 className="font-display text-base font-semibold text-[#116B45]">
                  02. Escolha o profissional
                </h2>
                {availableProfessionals.length === 0 ? (
                  <p className="mt-3 text-sm text-[#252D29]/70">
                    Nenhum profissional habilitado para este serviço no momento.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableProfessionals.map((pro) => {
                      const active = pro.id === selectedProId;
                      return (
                        <button
                          key={pro.id}
                          type="button"
                          onClick={() => setSelectedProId(pro.id)}
                          className={`text-left rounded-lg border p-3.5 flex items-center gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'border-[#168653] bg-[#E8F7EF]'
                              : 'border-[#E2E8E5] bg-white hover:border-[#168653]/50'
                          }`}
                        >
                          <AvatarImage
                            src={pro.photo_url}
                            alt={pro.name}
                            name={pro.name}
                            className="w-12 h-12 rounded-lg"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-[#252D29] truncate">
                              {pro.name}
                            </div>
                            <div className="text-xs text-[#252D29]/70 line-clamp-2">
                              {pro.description || 'Profissional habilitado'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Step 3: Date & Slots */}
              <section className="bg-white rounded-xl border border-[#DFE5E2] p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-base font-semibold text-[#116B45]">
                    03. Data e horário disponível
                  </h2>
                  <span className="text-xs text-[#252D29]/65 font-mono">
                    Intervalo exato verificado
                  </span>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {dates.map((d) => {
                    const active = d === selectedDate;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          active
                            ? 'border-[#168653] bg-[#168653] text-white'
                            : 'border-[#E2E8E5] bg-white text-[#252D29] hover:bg-[#F5F7F6]'
                        }`}
                      >
                        {formatDateBR(d)}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  {loadingSlots ? (
                    <SkeletonRows count={2} />
                  ) : slotsError ? (
                    <InlineAlert tone="error">{slotsError}</InlineAlert>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-[#252D29]/70 py-3">
                      Sem horários disponíveis nesta data para o serviço e profissional selecionados. Tente outro dia.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                      {slots.map((slot) => {
                        const active = selectedSlot?.start_at === slot.start_at;
                        return (
                          <button
                            key={slot.start_at}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2.5 px-3 rounded-lg border font-mono text-sm tabular-nums transition-colors cursor-pointer ${
                              active
                                ? 'border-[#168653] bg-[#168653] text-white font-semibold'
                                : 'border-[#D4DDD8] bg-white text-[#252D29] hover:border-[#168653] hover:bg-[#E8F7EF]'
                            }`}
                          >
                            {slot.start_time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Step 4: Customer Info */}
              {selectedSlot ? (
                <section className="bg-white rounded-xl border border-[#DFE5E2] p-6">
                  <h2 className="font-display text-base font-semibold text-[#116B45]">
                    04. Seus dados para confirmar (sem criar conta)
                  </h2>
                  <form onSubmit={handleConfirmBooking} className="mt-4 space-y-4">
                    {submitError ? <InlineAlert tone="error">{submitError}</InlineAlert> : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#252D29]">
                          Nome completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Seu nome"
                          className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#252D29]">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#252D29]">
                          E-mail (opcional)
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="voce@exemplo.com.br"
                          className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#252D29]">
                          Observação (opcional)
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Preferência simples de atendimento"
                          className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-[#252D29]/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 accent-[#168653] w-4 h-4 shrink-0"
                      />
                      <span>
                        Concordo em compartilhar meu nome e telefone com {data.business.name} exclusivamente para confirmação deste agendamento.
                      </span>
                    </label>

                    <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                      {submitting ? 'Confirmando horário...' : 'Confirmar agendamento'}
                    </Button>
                  </form>
                </section>
              ) : null}
            </div>

            {/* Summary Sidebar */}
            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5 space-y-4">
                <h3 className="font-display text-sm font-semibold text-[#116B45]">
                  Resumo do atendimento
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#252D29]/70">Serviço</span>
                    <span className="font-medium text-right">
                      {selectedService?.name ?? 'Selecione'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#252D29]/70">Profissional</span>
                    <span className="font-medium text-right">
                      {selectedPro?.name ?? 'Selecione'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#252D29]/70">Data</span>
                    <span className="font-mono text-right tabular-nums">
                      {formatDateBR(selectedDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#252D29]/70">Horário</span>
                    <span className="font-mono text-right tabular-nums">
                      {selectedSlot ? `${selectedSlot.start_time} – ${selectedSlot.end_time}` : 'A escolher'}
                    </span>
                  </div>
                </div>

                {selectedService ? (
                  <div className="pt-3 border-t border-[#E8EEEC] flex items-center justify-between">
                    <span className="text-xs text-[#252D29]/70 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedService.duration_minutes} min
                    </span>
                    <span className="font-mono text-lg font-bold text-[#116B45] tabular-nums">
                      {formatBRL(selectedService.price_cents)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#116B45]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Horários de funcionamento</span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  {[...data.workingHours]
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((wh) => (
                      <div key={wh.day_of_week} className="flex justify-between text-[#252D29]/80">
                        <span>{WEEKDAY_NAMES[wh.day_of_week]}</span>
                        <span className="font-mono tabular-nums">
                          {wh.is_closed ? 'Fechado' : `${wh.start_time} – ${wh.end_time}`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
