import React, { useEffect, useState } from 'react';
import { MarketingLayout } from '../components/layout/MarketingLayout.tsx';
import {
  Button,
  EmptyState,
  InlineAlert,
  SkeletonRows,
  StatusIndicator,
} from '../components/ui/Primitives.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatBRL, formatDateBR, formatIsoDateTimeBR } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';

interface CancelDetails {
  id: string;
  status: string;
  business_name: string;
  business_slug: string;
  business_address: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  professional_name: string;
  customer_name: string;
  start_at: string;
  end_at: string;
  local: { date: string; time: string };
  timezone: string;
  history: Array<{ at: string; action: string; actor: string; note?: string }>;
}

export function CancelBookingPage({ token }: { token: string }) {
  const { showToast } = useToast();
  const [booking, setBooking] = useState<CancelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ booking: CancelDetails }>(`/api/public/cancel/${encodeURIComponent(token)}`, {
      authMode: 'none',
    })
      .then((res) => setBooking(res.booking))
      .catch((err) => setError(err.message || 'Link inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCancel() {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/public/cancel/${encodeURIComponent(token)}`, {
        method: 'POST',
        authMode: 'none',
        body: JSON.stringify({ reason: reason || 'Cancelado pelo cliente' }),
      });
      const updated = await apiRequest<{ booking: CancelDetails }>(
        `/api/public/cancel/${encodeURIComponent(token)}`,
        { authMode: 'none' },
      );
      setBooking(updated.booking);
      showToast('Agendamento cancelado.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MarketingLayout>
      <div className="max-w-xl mx-auto px-4 py-12">
        {loading ? (
          <SkeletonRows count={4} />
        ) : error && !booking ? (
          <EmptyState
            title="Reserva não localizada"
            description={error}
            action={
              <Link to="/" className="text-sm font-medium text-[#116B45] hover:underline">
                Voltar ao início
              </Link>
            }
          />
        ) : booking ? (
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#116B45]">{booking.business_name}</p>
                <h1 className="mt-1 font-display text-2xl font-bold text-[#252D29]">
                  Gerenciar agendamento
                </h1>
              </div>
              <StatusIndicator status={booking.status} />
            </div>

            {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

            <div className="rounded-lg bg-[#F5F7F6] border border-[#E3EAE6] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Cliente</span>
                <span className="font-medium">{booking.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Serviço</span>
                <span className="font-medium">{booking.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Profissional</span>
                <span className="font-medium">{booking.professional_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Data e horário</span>
                <span className="font-mono tabular-nums">
                  {formatDateBR(booking.local.date)} · {booking.local.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252D29]/70">Valor</span>
                <span className="font-mono font-semibold text-[#116B45] tabular-nums">
                  {formatBRL(booking.price_cents)}
                </span>
              </div>
            </div>

            {booking.status === 'cancelled' ? (
              <InlineAlert tone="info">
                Este agendamento foi cancelado e o horário já foi liberado na agenda do estabelecimento.
              </InlineAlert>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#252D29]">
                    Motivo do cancelamento (opcional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex.: Imprevisto no trabalho"
                    className="mt-1.5 w-full rounded-lg border border-[#D4DDD8] px-3.5 py-2.5 text-sm focus:border-[#168653] focus:outline-none"
                  />
                </div>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  {submitting ? 'Cancelando...' : 'Confirmar cancelamento do horário'}
                </Button>
              </div>
            )}

            <div className="pt-4 border-t border-[#E8EEEC]">
              <h2 className="text-xs font-semibold text-[#252D29]/70">Histórico de alterações</h2>
              <ul className="mt-2 space-y-1.5 text-xs text-[#252D29]/75">
                {booking.history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {h.action} {h.note ? `— ${h.note}` : ''}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatIsoDateTimeBR(h.at, booking.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <Link
                to={`/agenda/${booking.business_slug}`}
                className="text-sm font-medium text-[#116B45] hover:underline"
              >
                Agendar um novo horário em {booking.business_name}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </MarketingLayout>
  );
}
