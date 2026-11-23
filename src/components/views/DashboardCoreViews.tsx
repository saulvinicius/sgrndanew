'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Plus, Sparkles } from 'lucide-react';
import { DashboardLayout } from '@/src/components/views/DashboardLayout';
import {
  AvatarImage,
  Button,
  EmptyState,
  InlineAlert,
  Modal,
  SkeletonRows,
  StatusIndicator,
} from '@/src/components/ui/Primitives';
import { useToast } from '@/src/context/ToastContext';
import { apiRequest } from '@/src/lib/api';
import {
  STUDIO_AVATARS,
  WEEKDAY_NAMES,
  formatBRL,
  formatDateBR,
} from '@/src/lib/format';

interface DashboardAppointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  professional_name: string;
  service_name_snapshot: string;
  price_cents_snapshot: number;
  duration_minutes_snapshot: number;
  status: string;
  origin: string;
  cancel_token: string;
  local: { date: string; time: string };
}

interface DashboardServiceItem {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  active: boolean;
}

interface DashboardProItem {
  id: string;
  name: string;
  description: string;
  photo_url: string;
  active: boolean;
}

interface WorkingHourEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
  professional_id?: string | null;
}

export function DashboardOverviewPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    business: { id: string; name: string; slug: string; status: string };
    publicBookingActive: boolean;
    counts: { services: number; professionals: number; customers: number; appointments: number };
    appointments: DashboardAppointment[];
  } | null>(null);

  function load() {
    setLoading(true);
    apiRequest<{
      business: { id: string; name: string; slug: string; status: string };
      publicBookingActive: boolean;
      counts: { services: number; professionals: number; customers: number; appointments: number };
      appointments: DashboardAppointment[];
    }>('/api/dashboard/overview')
      .then(setData)
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : 'Erro ao carregar visão geral.', 'error'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function seedDemo() {
    try {
      await apiRequest('/api/dashboard/seed-demo', { method: 'POST' });
      showToast('Dados de exemplo carregados no seu painel.');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao gerar dados.', 'error');
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiRequest(`/api/dashboard/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast('Status atualizado.');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar.', 'error');
    }
  }

  return (
    <DashboardLayout
      title="Visão geral"
      actions={
        data?.business ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(
                `${window.location.origin}/agenda/${data.business.slug}`,
              );
              showToast('Link da agenda pública copiado.');
            }}
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar link público
          </Button>
        ) : null
      }
    >
      {loading ? (
        <SkeletonRows count={5} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Serviços ativos</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#116B45] tabular-nums">
                {data.counts.services}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Profissionais</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                {data.counts.professionals}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Clientes cadastrados</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                {data.counts.customers}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
              <div className="text-xs text-[#252D29]/70">Total de reservas</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#252D29] tabular-nums">
                {data.counts.appointments}
              </div>
            </div>
          </div>

          {data.appointments.length === 0 ? (
            <EmptyState
              title="Sua agenda ainda está vazia"
              description="Cadastre reservas manualmente na aba Agenda, compartilhe seu link público ou carregue dados de exemplo para explorar os relatórios."
              action={
                <div className="flex flex-wrap gap-3">
                  <Button onClick={seedDemo}>
                    <Sparkles className="w-4 h-4" />
                    Carregar dados de exemplo
                  </Button>
                  <Link
                    href="/painel/agenda"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#116B45] border border-[#D4DDD8] rounded-lg bg-white"
                  >
                    Ir para Agenda
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E8EEEC] flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[#252D29]">
                  Próximos agendamentos
                </h2>
                <Link href="/painel/agenda" className="text-xs font-medium text-[#116B45] hover:underline">
                  Ver agenda completa
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                      <th className="py-3 px-4 font-medium">Data e hora</th>
                      <th className="py-3 px-4 font-medium">Cliente</th>
                      <th className="py-3 px-4 font-medium">Serviço</th>
                      <th className="py-3 px-4 font-medium">Profissional</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Valor</th>
                      <th className="py-3 px-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EEEC]">
                    {data.appointments.slice(0, 8).map((a) => (
                      <tr key={a.id} className="hover:bg-[#F5F7F6]/60">
                        <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                          {formatDateBR(a.local.date)} · {a.local.time}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{a.customer_name}</div>
                          <div className="text-xs font-mono text-[#252D29]/65">{a.customer_phone}</div>
                        </td>
                        <td className="py-3 px-4">{a.service_name_snapshot}</td>
                        <td className="py-3 px-4 text-[#252D29]/80">{a.professional_name}</td>
                        <td className="py-3 px-4">
                          <StatusIndicator status={a.status} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatBRL(a.price_cents_snapshot)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {a.status === 'confirmed' || a.status === 'pending' ? (
                            <div className="inline-flex gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => updateStatus(a.id, 'completed')}
                              >
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateStatus(a.id, 'no_show')}
                              >
                                Falta
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </DashboardLayout>
  );
}

export function DashboardAgendaPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [services, setServices] = useState<DashboardServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<DashboardProItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // Manual booking form
  const [serviceId, setServiceId] = useState('');
  const [proId, setProId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    apiRequest<{
      appointments: DashboardAppointment[];
      services: DashboardServiceItem[];
      professionals: DashboardProItem[];
    }>('/api/dashboard/appointments')
      .then((res) => {
        setAppointments(res.appointments);
        setServices(res.services);
        setProfessionals(res.professionals);
        if (res.services.length > 0 && !serviceId) setServiceId(res.services[0].id);
        if (res.professionals.length > 0 && !proId) setProId(res.professionals[0].id);
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : 'Erro ao carregar agenda.', 'error'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createManualBooking(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await apiRequest('/api/dashboard/appointments', {
        method: 'POST',
        body: JSON.stringify({
          service_id: serviceId,
          professional_id: proId,
          date,
          start_time: time,
          customer_name: custName,
          customer_phone: custPhone,
          notes,
        }),
      });
      showToast('Agendamento manual criado.');
      setModalOpen(false);
      setCustName('');
      setCustPhone('');
      setNotes('');
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar reserva.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await apiRequest(`/api/dashboard/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast('Status atualizado.');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar.', 'error');
    }
  }

  const filtered =
    filterStatus === 'all'
      ? appointments
      : appointments.filter((a) => a.status === filterStatus);

  return (
    <DashboardLayout
      title="Agenda"
      actions={
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo agendamento
        </Button>
      }
    >
      <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-[#DFE5E2] rounded-lg w-fit">
        {(
          [
            ['all', 'Todos'],
            ['confirmed', 'Confirmados'],
            ['completed', 'Concluídos'],
            ['no_show', 'Faltas'],
            ['cancelled', 'Cancelados'],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              filterStatus === val
                ? 'bg-[#168653] text-white'
                : 'text-[#252D29]/75 hover:text-[#116B45]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado"
          description="Ajuste os filtros ou crie um novo agendamento manual para um cliente."
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Criar agendamento manual
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                <th className="py-3 px-4 font-medium">Data e hora</th>
                <th className="py-3 px-4 font-medium">Cliente</th>
                <th className="py-3 px-4 font-medium">Serviço</th>
                <th className="py-3 px-4 font-medium">Profissional</th>
                <th className="py-3 px-4 font-medium">Origem</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Valor</th>
                <th className="py-3 px-4 font-medium text-right">Alterar status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEEC]">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#F5F7F6]/60">
                  <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                    {formatDateBR(a.local.date)} · {a.local.time}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{a.customer_name}</div>
                    <div className="text-xs font-mono text-[#252D29]/65">{a.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{a.service_name_snapshot}</div>
                    <div className="text-xs font-mono text-[#252D29]/65">
                      {a.duration_minutes_snapshot} min
                    </div>
                  </td>
                  <td className="py-3 px-4">{a.professional_name}</td>
                  <td className="py-3 px-4 text-xs text-[#252D29]/70">
                    {a.origin === 'public' ? 'Link público' : 'Admin'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusIndicator status={a.status} />
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {formatBRL(a.price_cents_snapshot)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      aria-label={`Status de ${a.customer_name}`}
                      value={a.status}
                      onChange={(e) => changeStatus(a.id, e.target.value)}
                      className="rounded-md border border-[#D4DDD8] px-2 py-1 text-xs bg-white"
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="completed">Concluído</option>
                      <option value="no_show">Não compareceu</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} title="Novo agendamento manual" onClose={() => setModalOpen(false)}>
        <form onSubmit={createManualBooking} className="space-y-4">
          {formError ? <InlineAlert tone="error">{formError}</InlineAlert> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Serviço</label>
              <select
                required
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm bg-white"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Profissional</label>
              <select
                required
                value={proId}
                onChange={(e) => setProId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm bg-white"
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Horário inicial</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Nome do cliente</label>
              <input
                type="text"
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Telefone</label>
              <input
                type="tel"
                required
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#252D29]">Observações</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar reserva'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export function DashboardServicesPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<DashboardServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<DashboardProItem[]>([]);
  const [links, setLinks] = useState<Array<{ professional_id: string; service_id: string }>>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('50,00');
  const [duration, setDuration] = useState('45');
  const [buffer, setBuffer] = useState('0');
  const [selectedPros, setSelectedPros] = useState<string[]>([]);

  function load() {
    setLoading(true);
    apiRequest<{
      services: DashboardServiceItem[];
      professionals: DashboardProItem[];
      links: Array<{ professional_id: string; service_id: string }>;
    }>('/api/dashboard/services')
      .then((res) => {
        setServices(res.services);
        setProfessionals(res.professionals);
        setLinks(res.links);
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : 'Erro ao carregar serviços.', 'error'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setName('');
    setDescription('');
    setPriceStr('60,00');
    setDuration('45');
    setBuffer('0');
    setSelectedPros(professionals.map((p) => p.id));
    setModalOpen(true);
  }

  function openEdit(svc: DashboardServiceItem) {
    setEditingId(svc.id);
    setName(svc.name);
    setDescription(svc.description);
    setPriceStr((svc.price_cents / 100).toFixed(2).replace('.', ','));
    setDuration(String(svc.duration_minutes));
    setBuffer(String(svc.buffer_minutes));
    setSelectedPros(links.filter((l) => l.service_id === svc.id).map((l) => l.professional_id));
    setModalOpen(true);
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    const normalized = Number(priceStr.replace(/\./g, '').replace(',', '.'));
    const price_cents = Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
    const payload = {
      name,
      description,
      price_cents,
      duration_minutes: Number(duration),
      buffer_minutes: Number(buffer),
      professional_ids: selectedPros,
    };

    try {
      if (editingId) {
        await apiRequest(`/api/dashboard/services/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Serviço atualizado.');
      } else {
        await apiRequest('/api/dashboard/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Serviço cadastrado.');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar serviço.', 'error');
    }
  }

  async function toggleActive(svc: DashboardServiceItem) {
    try {
      await apiRequest(`/api/dashboard/services/${svc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !svc.active }),
      });
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status.', 'error');
    }
  }

  return (
    <DashboardLayout
      title="Serviços"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Novo serviço
        </Button>
      }
    >
      {loading ? (
        <SkeletonRows count={4} />
      ) : services.length === 0 ? (
        <EmptyState
          title="Nenhum serviço cadastrado"
          description="Adicione os serviços que seus clientes podem reservar pelo link público."
          action={<Button onClick={openNew}>Cadastrar primeiro serviço</Button>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#DFE5E2] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EEEC] text-left text-xs text-[#252D29]/70">
                <th className="py-3 px-4 font-medium">Serviço</th>
                <th className="py-3 px-4 font-medium">Duração / Intervalo</th>
                <th className="py-3 px-4 font-medium">Profissionais</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Preço</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEEC]">
              {services.map((svc) => {
                const proCount = links.filter((l) => l.service_id === svc.id).length;
                return (
                  <tr key={svc.id} className="hover:bg-[#F5F7F6]/60">
                    <td className="py-3 px-4">
                      <div className="font-medium">{svc.name}</div>
                      {svc.description ? (
                        <div className="text-xs text-[#252D29]/65">{svc.description}</div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {svc.duration_minutes} min
                      {svc.buffer_minutes > 0 ? ` + ${svc.buffer_minutes} min` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {proCount} habilitado(s)
                    </td>
                    <td className="py-3 px-4">
                      <StatusIndicator status={svc.active ? 'active' : 'suspended'} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#116B45] tabular-nums">
                      {formatBRL(svc.price_cents)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(svc)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(svc)}>
                          {svc.active ? 'Inativar' : 'Ativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'Editar serviço' : 'Novo serviço'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={saveService} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Nome do serviço</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Preço (R$)</label>
              <input
                type="text"
                required
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Duração (min)</label>
              <input
                type="number"
                min={5}
                max={480}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#252D29]">Intervalo (min)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#252D29] mb-1.5">
              Profissionais habilitados
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#E8EEEC] rounded-lg p-3">
              {professionals.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPros.includes(p.id)}
                    onChange={(e) =>
                      setSelectedPros((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                      )
                    }
                    className="accent-[#168653]"
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar serviço</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export function DashboardProfessionalsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<DashboardProItem[]>([]);
  const [services, setServices] = useState<DashboardServiceItem[]>([]);
  const [links, setLinks] = useState<Array<{ professional_id: string; service_id: string }>>([]);
  const [proHours, setProHours] = useState<WorkingHourEntry[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [hoursModalPro, setHoursModalPro] = useState<DashboardProItem | null>(null);
  const [editingHours, setEditingHours] = useState<WorkingHourEntry[]>([]);

  function load() {
    setLoading(true);
    apiRequest<{
      professionals: DashboardProItem[];
      services: DashboardServiceItem[];
      links: Array<{ professional_id: string; service_id: string }>;
      hours: WorkingHourEntry[];
    }>('/api/dashboard/professionals')
      .then((res) => {
        setProfessionals(res.professionals);
        setServices(res.services);
        setLinks(res.links);
        setProHours(res.hours);
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : 'Erro ao carregar profissionais.', 'error'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setName('');
    setDescription('');
    setPhotoUrl('');
    setSelectedServices(services.map((s) => s.id));
    setModalOpen(true);
  }

  function openEdit(pro: DashboardProItem) {
    setEditingId(pro.id);
    setName(pro.name);
    setDescription(pro.description);
    setPhotoUrl(pro.photo_url);
    setSelectedServices(links.filter((l) => l.professional_id === pro.id).map((l) => l.service_id));
    setModalOpen(true);
  }

  function openHours(pro: DashboardProItem) {
    const existing = proHours.filter((h) => h.professional_id === pro.id);
    const full = [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const match = existing.find((e) => e.day_of_week === day);
      return (
        match || {
          day_of_week: day,
          start_time: '09:00',
          end_time: '18:00',
          is_closed: day === 0,
        }
      );
    });
    setEditingHours(full);
    setHoursModalPro(pro);
  }

  async function savePro(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      description,
      photo_url: photoUrl,
      service_ids: selectedServices,
    };
    try {
      if (editingId) {
        await apiRequest(`/api/dashboard/professionals/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Profissional atualizado.');
      } else {
        await apiRequest('/api/dashboard/professionals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Profissional adicionado.');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar profissional.', 'error');
    }
  }

  async function saveProHours(e: React.FormEvent) {
    e.preventDefault();
    if (!hoursModalPro) return;
    try {
      await apiRequest(`/api/dashboard/professionals/${hoursModalPro.id}`, {
        method: 'PUT',
        body: JSON.stringify({ hours: editingHours }),
      });
      showToast('Horários individuais salvos.');
      setHoursModalPro(null);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar jornada.', 'error');
    }
  }

  return (
    <DashboardLayout
      title="Profissionais"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Novo profissional
        </Button>
      }
    >
      {loading ? (
        <SkeletonRows count={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professionals.map((pro) => {
            const proServices = links
              .filter((l) => l.professional_id === pro.id)
              .map((l) => services.find((s) => s.id === l.service_id)?.name)
              .filter(Boolean);
            return (
              <div
                key={pro.id}
                className="bg-white rounded-xl border border-[#DFE5E2] p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <AvatarImage
                    src={pro.photo_url}
                    alt={pro.name}
                    name={pro.name}
                    className="w-14 h-14 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold text-base text-[#252D29] truncate">
                        {pro.name}
                      </h3>
                      <StatusIndicator status={pro.active ? 'active' : 'suspended'} />
                    </div>
                    <p className="mt-1 text-xs text-[#252D29]/70">
                      {pro.description || 'Sem descrição'}
                    </p>
                    <p className="mt-2 text-xs text-[#116B45]">
                      {proServices.length > 0
                        ? `Serviços: ${proServices.join(' · ')}`
                        : 'Nenhum serviço vinculado'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E8EEEC]">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(pro)}>
                    Editar dados e serviços
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openHours(pro)}>
                    Horários individuais
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'Editar profissional' : 'Novo profissional'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={savePro} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Especialidade / Bio curta</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29]">Foto (URL ou retrato do estúdio)</label>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://... ou selecione abaixo"
              className="mt-1 w-full rounded-lg border border-[#D4DDD8] px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDIO_AVATARS.map((av) => (
                <button
                  key={av.url}
                  type="button"
                  onClick={() => setPhotoUrl(av.url)}
                  className="text-xs px-2.5 py-1 rounded border border-[#D4DDD8] hover:border-[#168653] bg-[#F5F7F6] cursor-pointer"
                >
                  {av.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#252D29] mb-1.5">
              Serviços executados
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#E8EEEC] rounded-lg p-3">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(s.id)}
                    onChange={(e) =>
                      setSelectedServices((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                    className="accent-[#168653]"
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar profissional</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(hoursModalPro)}
        title={`Jornada de ${hoursModalPro?.name || ''}`}
        onClose={() => setHoursModalPro(null)}
      >
        <form onSubmit={saveProHours} className="space-y-3">
          {editingHours.map((h) => (
            <div
              key={h.day_of_week}
              className="flex items-center justify-between gap-2 py-2 border-b border-[#E8EEEC]"
            >
              <label className="flex items-center gap-2 text-sm min-w-[130px]">
                <input
                  type="checkbox"
                  checked={!h.is_closed}
                  onChange={(e) =>
                    setEditingHours((prev) =>
                      prev.map((row) =>
                        row.day_of_week === h.day_of_week
                          ? { ...row, is_closed: !e.target.checked }
                          : row,
                      ),
                    )
                  }
                  className="accent-[#168653]"
                />
                <span>{WEEKDAY_NAMES[h.day_of_week]}</span>
              </label>
              {h.is_closed ? (
                <span className="text-xs text-[#252D29]/60">Folga</span>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <input
                    type="time"
                    value={h.start_time}
                    onChange={(e) =>
                      setEditingHours((prev) =>
                        prev.map((row) =>
                          row.day_of_week === h.day_of_week
                            ? { ...row, start_time: e.target.value }
                            : row,
                        ),
                      )
                    }
                    className="rounded border border-[#D4DDD8] px-2 py-1"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={h.end_time}
                    onChange={(e) =>
                      setEditingHours((prev) =>
                        prev.map((row) =>
                          row.day_of_week === h.day_of_week
                            ? { ...row, end_time: e.target.value }
                            : row,
                        ),
                      )
                    }
                    className="rounded border border-[#D4DDD8] px-2 py-1"
                  />
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" onClick={() => setHoursModalPro(null)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar jornada</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
