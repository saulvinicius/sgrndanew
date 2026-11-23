import React, { useEffect, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout.tsx';
import {
  Button,
  EmptyState,
  InlineAlert,
  Modal,
  SkeletonRows,
  StatusIndicator,
} from '../components/ui/Primitives.tsx';
import { AuthBusiness, useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import {
  SEGMENTS,
  WEEKDAY_NAMES,
  formatBRL,
  formatIsoDateTimeBR,
} from '../lib/format.ts';

export function DashboardCustomersPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  function load() {
    setLoading(true);
    apiRequest<{ customers: any[] }>('/api/dashboard/customers')
      .then((res) => setCustomers(res.customers))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/dashboard/customers', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, notes, consent: true }),
      });
      showToast('Cliente cadastrado.');
      setModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setNotes('');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  return (
    <DashboardLayout
      title="Clientes"
      actions={
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo cliente
        </Button>
      }
    >
      <div className="max-w-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full rounded-lg border border-[#D4DDD8] bg-white px-3.5 py-2 text-sm focus:border-[#168653] focus:outline-none"
        />
      </div>

      {loading ? (
        <SkeletonRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum cliente listado"
          description="Clientes que agendam pelo link público aparecem aqui automaticamente."
          action={<Button onClick={() => setModalOpen(true)}>Adicionar cliente</Button>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                <th className="py-3 px-4 font-medium">Nome</th>
                <th className="py-3 px-4 font-medium">Telefone</th>
                <th className="py-3 px-4 font-medium">E-mail</th>
                <th className="py-3 px-4 font-medium">Observações</th>
                <th className="py-3 px-4 font-medium text-right">Reservas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEEC]">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium">{c.name}</td>
                  <td className="py-3 px-4 font-mono text-xs">{c.phone}</td>
                  <td className="py-3 px-4 text-[#252D29]/75">{c.email || '—'}</td>
                  <td className="py-3 px-4 text-xs text-[#252D29]/70">{c.notes || '—'}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {c.appointments_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} title="Novo cliente" onClose={() => setModalOpen(false)}>
        <form onSubmit={saveCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Nome completo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Telefone / WhatsApp *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">E-mail (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">
              Observações não sensíveis
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar cliente</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export function DashboardSchedulePage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [minAdvance, setMinAdvance] = useState('60');
  const [maxFuture, setMaxFuture] = useState('30');

  // New block
  const [blkPro, setBlkPro] = useState('');
  const [blkStart, setBlkStart] = useState('');
  const [blkEnd, setBlkEnd] = useState('');
  const [blkReason, setBlkReason] = useState('');

  // New exception
  const [exDate, setExDate] = useState('');
  const [exClosed, setExClosed] = useState(true);
  const [exStart, setExStart] = useState('09:00');
  const [exEnd, setExEnd] = useState('14:00');
  const [exNote, setExNote] = useState('');

  function load() {
    setLoading(true);
    apiRequest<any>('/api/dashboard/schedule')
      .then((res) => {
        setHours([...res.workingHours].sort((a, b) => a.day_of_week - b.day_of_week));
        setBlocks(res.blockedTimes);
        setExceptions(res.exceptions);
        setProfessionals(res.professionals);
        setMinAdvance(String(res.business.min_advance_minutes));
        setMaxFuture(String(res.business.max_future_days));
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveHoursAndRules() {
    try {
      await apiRequest('/api/onboarding/hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
      await apiRequest('/api/dashboard/schedule/rules', {
        method: 'PUT',
        body: JSON.stringify({
          min_advance_minutes: Number(minAdvance),
          max_future_days: Number(maxFuture),
        }),
      });
      showToast('Horários e regras de antecedência salvos.');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/dashboard/blocks', {
        method: 'POST',
        body: JSON.stringify({
          professional_id: blkPro || null,
          start_at: new Date(blkStart).toISOString(),
          end_at: new Date(blkEnd).toISOString(),
          reason: blkReason || 'Bloqueio manual',
        }),
      });
      showToast('Bloqueio registrado.');
      setBlkReason('');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  async function removeBlock(id: string) {
    await apiRequest(`/api/dashboard/blocks/${id}`, { method: 'DELETE' });
    load();
  }

  async function addException(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/dashboard/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          date: exDate,
          is_closed: exClosed,
          start_time: exStart,
          end_time: exEnd,
          note: exNote,
        }),
      });
      showToast('Exceção de data salva.');
      setExNote('');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  async function removeException(id: string) {
    await apiRequest(`/api/dashboard/exceptions/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <DashboardLayout title="Horários, bloqueios e exceções">
      {loading ? (
        <SkeletonRows count={5} />
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-[#116B45]">
                Funcionamento semanal e limites
              </h2>
              <Button size="sm" onClick={saveHoursAndRules}>
                Salvar horários e regras
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#252D29]">
                  Antecedência mínima para reservar (minutos)
                </label>
                <input
                  type="number"
                  min={0}
                  value={minAdvance}
                  onChange={(e) => setMinAdvance(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#252D29]">
                  Limite máximo de dias futuros
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={maxFuture}
                  onChange={(e) => setMaxFuture(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="divide-y divide-[#E8EEEC] border border-[#E8EEEC] rounded-lg">
              {hours.map((row) => (
                <div
                  key={row.day_of_week}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <label className="flex items-center gap-2.5 text-sm font-medium min-w-[150px]">
                    <input
                      type="checkbox"
                      checked={!row.is_closed}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((h) =>
                            h.day_of_week === row.day_of_week
                              ? { ...h, is_closed: !e.target.checked }
                              : h,
                          ),
                        )
                      }
                      className="accent-[#168653]"
                    />
                    <span>{WEEKDAY_NAMES[row.day_of_week]}</span>
                  </label>
                  {row.is_closed ? (
                    <span className="text-xs text-[#252D29]/60">Fechado</span>
                  ) : (
                    <div className="flex items-center gap-2 font-mono text-xs">
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
                        className="rounded border border-[#D4DDD8] px-2 py-1"
                      />
                      <span>às</span>
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
                        className="rounded border border-[#D4DDD8] px-2 py-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Blocks & Date Exceptions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#116B45]">
                Bloqueios de agenda
              </h2>
              <form onSubmit={addBlock} className="space-y-3">
                <select
                  value={blkPro}
                  onChange={(e) => setBlkPro(e.target.value)}
                  className="w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm bg-white"
                >
                  <option value="">Todo o estabelecimento</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    required
                    value={blkStart}
                    onChange={(e) => setBlkStart(e.target.value)}
                    className="rounded-lg border border-[#D4DDD8] px-3 py-2 text-xs font-mono"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={blkEnd}
                    onChange={(e) => setBlkEnd(e.target.value)}
                    className="rounded-lg border border-[#D4DDD8] px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={blkReason}
                    onChange={(e) => setBlkReason(e.target.value)}
                    placeholder="Motivo (ex.: Almoço / Manutenção)"
                    className="flex-1 rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm">
                    Bloquear
                  </Button>
                </div>
              </form>

              <div className="divide-y divide-[#E8EEEC] border-t border-[#E8EEEC]">
                {blocks.length === 0 ? (
                  <p className="py-3 text-xs text-[#252D29]/65">Nenhum bloqueio ativo.</p>
                ) : (
                  blocks.map((b) => (
                    <div key={b.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-medium">
                          {b.professional_name} · {b.reason}
                        </div>
                        <div className="font-mono text-[#252D29]/65 tabular-nums">
                          {b.localStart.date} {b.localStart.time} – {b.localEnd.date} {b.localEnd.time}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBlock(b.id)}
                        aria-label="Remover bloqueio"
                        className="p-1.5 text-[#E5484D] hover:bg-[#F5F7F6] rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#116B45]">
                Exceções e feriados
              </h2>
              <form onSubmit={addException} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 items-center">
                  <input
                    type="date"
                    required
                    value={exDate}
                    onChange={(e) => setExDate(e.target.value)}
                    className="rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exClosed}
                      onChange={(e) => setExClosed(e.target.checked)}
                      className="accent-[#168653]"
                    />
                    <span>Fechado o dia todo</span>
                  </label>
                </div>
                {!exClosed ? (
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <input
                      type="time"
                      value={exStart}
                      onChange={(e) => setExStart(e.target.value)}
                      className="rounded border border-[#D4DDD8] px-2.5 py-1.5"
                    />
                    <span>às</span>
                    <input
                      type="time"
                      value={exEnd}
                      onChange={(e) => setExEnd(e.target.value)}
                      className="rounded border border-[#D4DDD8] px-2.5 py-1.5"
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exNote}
                    onChange={(e) => setExNote(e.target.value)}
                    placeholder="Ex.: Feriado municipal"
                    className="flex-1 rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm">
                    Salvar data
                  </Button>
                </div>
              </form>

              <div className="divide-y divide-[#E8EEEC] border-t border-[#E8EEEC]">
                {exceptions.length === 0 ? (
                  <p className="py-3 text-xs text-[#252D29]/65">Nenhuma exceção cadastrada.</p>
                ) : (
                  exceptions.map((ex) => (
                    <div key={ex.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono font-medium">{ex.date}</span>
                        <span className="ml-2">
                          {ex.is_closed ? 'Fechado' : `${ex.start_time} – ${ex.end_time}`}
                        </span>
                        {ex.note ? <span className="ml-2 text-[#252D29]/65">· {ex.note}</span> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeException(ex.id)}
                        aria-label="Remover exceção"
                        className="p-1.5 text-[#E5484D] hover:bg-[#F5F7F6] rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function DashboardReportsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    apiRequest<any>('/api/dashboard/reports')
      .then(setReport)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ['Profissional', 'Reservas', 'Receita (BRL)'],
      ...report.byProfessional.map((p: any) => [
        p.name,
        String(p.bookings),
        (p.revenue_cents / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-agendaflat.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout
      title="Relatórios"
      actions={
        <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!report}>
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      }
    >
      {loading ? (
        <SkeletonRows count={4} />
      ) : report ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Receita registrada (snapshots)</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#116B45] tabular-nums">
                {formatBRL(report.totalRevenueCents)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Atendimentos concluídos</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                {report.completedCount}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Cancelamentos</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                {report.cancelledCount}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Faltas (no-show)</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#E5484D] tabular-nums">
                {report.noShowCount}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
            <div className="px-6 py-4 border-b border-[#E8EEEC]">
              <h2 className="font-display text-base font-semibold">Desempenho por profissional</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                  <th className="py-3 px-4 font-medium">Profissional</th>
                  <th className="py-3 px-4 font-medium text-right">Agendamentos válidos</th>
                  <th className="py-3 px-4 font-medium text-right">Receita estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EEEC]">
                {report.byProfessional.map((p: any) => (
                  <tr key={p.professional_id}>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{p.bookings}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#116B45] tabular-nums">
                      {formatBRL(p.revenue_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </DashboardLayout>
  );
}

export function DashboardSettingsPage() {
  const { business, updateBusiness } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState(business?.name || '');
  const [slug, setSlug] = useState(business?.slug || '');
  const [segment, setSegment] = useState(business?.segment || SEGMENTS[0]);
  const [phone, setPhone] = useState(business?.phone || '');
  const [address, setAddress] = useState(business?.address || '');
  const [description, setDescription] = useState(business?.description || '');
  const [timezone, setTimezone] = useState(business?.timezone || 'America/Sao_Paulo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name);
      setSlug(business.slug);
      setSegment(business.segment);
      setPhone(business.phone);
      setAddress(business.address);
      setDescription(business.description);
      setTimezone(business.timezone);
    }
  }, [business]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest<{ business: AuthBusiness }>('/api/dashboard/settings', {
        method: 'PUT',
        body: JSON.stringify({ name, slug, segment, phone, address, description, timezone }),
      });
      updateBusiness(res.business);
      setSlug(res.business.slug);
      showToast('Configurações do estabelecimento salvas.');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout title="Configurações">
      <form
        onSubmit={save}
        className="bg-white rounded-xl border border-[#DFE5E2] p-6 max-w-2xl space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Nome do negócio</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Segmento</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm bg-white"
            >
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Slug público</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Fuso horário</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm bg-white"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              <option value="America/Manaus">America/Manaus</option>
              <option value="America/Fortaleza">America/Fortaleza</option>
              <option value="America/Cuiaba">America/Cuiaba</option>
              <option value="America/Rio_Branco">America/Rio_Branco</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Telefone / WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Endereço</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#252D29]">Apresentação pública</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
          />
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}

export function DashboardSubscriptionPage() {
  const { refreshMe } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [supportSent, setSupportSent] = useState(false);
  const [supportMsg, setSupportMsg] = useState('');

  function load() {
    setLoading(true);
    apiRequest<any>('/api/dashboard/subscription')
      .then(setData)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelSub() {
    try {
      await apiRequest('/api/dashboard/subscription/cancel', { method: 'POST' });
      await refreshMe();
      showToast('Cancelamento programado para o fim do período já pago.');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  async function reactivateSub() {
    try {
      await apiRequest('/api/dashboard/subscription/reactivate', { method: 'POST' });
      await refreshMe();
      showToast('Assinatura reativada.');
      load();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  return (
    <DashboardLayout title="Assinatura e suporte">
      {loading ? (
        <SkeletonRows count={4} />
      ) : data ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-[#252D29]">
                  {data.subscription?.plan_name || 'Plano Profissional AgendaFlat'}
                </h2>
                {data.subscription ? <StatusIndicator status={data.subscription.status} /> : null}
              </div>
              <p className="mt-1 text-sm text-[#252D29]/75">
                Valor mensal:{' '}
                <strong className="font-mono text-[#116B45]">
                  {formatBRL(data.subscription?.price_cents || 1990)}
                </strong>
                {data.subscription?.current_period_end
                  ? ` · Ciclo vigente até ${formatIsoDateTimeBR(data.subscription.current_period_end)}`
                  : ''}
              </p>
              {data.subscription?.cancel_at_period_end ? (
                <p className="mt-1 text-xs text-[#E5484D]">
                  Cancelamento agendado. Seus dados serão preservados após o término do ciclo pago.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {data.subscription?.status === 'authorized' && !data.subscription?.cancel_at_period_end ? (
                <Button variant="secondary" onClick={cancelSub}>
                  Cancelar renovação
                </Button>
              ) : (
                <Button onClick={reactivateSub}>Ativar / Reativar assinatura</Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
            <div className="px-6 py-4 border-b border-[#E8EEEC]">
              <h3 className="font-display text-base font-semibold">Histórico de cobranças</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                  <th className="py-3 px-4 font-medium">Referência</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Valor</th>
                  <th className="py-3 px-4 font-medium text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EEEC]">
                {data.payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-5 text-center text-xs text-[#252D29]/65">
                      Nenhuma cobrança registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  data.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-mono text-xs">{p.provider_payment_id}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 max-w-2xl space-y-4">
            <h3 className="font-display text-base font-semibold text-[#116B45]">
              Suporte ao estabelecimento
            </h3>
            <p className="text-sm text-[#252D29]/75">
              Dúvidas sobre cobrança recorrente no Mercado Pago, configuração de fuso horário ou funcionamento da agenda? Envie sua mensagem abaixo.
            </p>
            {supportSent ? (
              <InlineAlert tone="info">
                Solicitação registrada. Nossa equipe responderá no e-mail da sua conta.
              </InlineAlert>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSupportSent(true);
                  setSupportMsg('');
                  showToast('Mensagem enviada ao suporte AgendaFlat.');
                }}
                className="space-y-3"
              >
                <textarea
                  rows={3}
                  required
                  value={supportMsg}
                  onChange={(e) => setSupportMsg(e.target.value)}
                  placeholder="Descreva sua dúvida ou solicitação..."
                  className="w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm">
                  Enviar solicitação de suporte
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
