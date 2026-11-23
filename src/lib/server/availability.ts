import type { DatabaseState } from './types';
import {
  addDaysToDateStr,
  getLocalDayOfWeek,
  getTodayDateStr,
  localDateTimeToUtcIso,
  minutesToTimeStr,
  timeStrToMinutes,
} from './timezone';

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
}

export function isBusinessPubliclyActive(state: DatabaseState, businessId: string): {
  allowed: boolean;
  reason?: string;
} {
  const biz = state.businesses.find((b) => b.id === businessId);
  if (!biz || biz.status === 'deleted') {
    return { allowed: false, reason: 'Estabelecimento não encontrado.' };
  }
  if (biz.status === 'onboarding') {
    return { allowed: false, reason: 'Estabelecimento ainda em configuração inicial.' };
  }
  if (biz.status === 'suspended') {
    return { allowed: false, reason: 'Agendamentos temporariamente indisponíveis para este estabelecimento.' };
  }

  const sub = state.subscriptions.find((s) => s.business_id === businessId);
  if (!sub) {
    return { allowed: false, reason: 'Assinatura não localizada.' };
  }

  const nowMs = Date.now();
  const periodEndMs = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;

  if (sub.status === 'authorized') {
    return { allowed: true };
  }

  if (sub.status === 'cancelled' && sub.cancel_at_period_end && periodEndMs > nowMs) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Agenda pública bloqueada: assinatura pendente ou expirada.' };
}

function getEffectiveWindowForDate(
  state: DatabaseState,
  businessId: string,
  professionalId: string,
  dateStr: string,
  timeZone: string,
): { startMinutes: number; endMinutes: number } | null {
  const dayOfWeek = getLocalDayOfWeek(dateStr, timeZone);

  const exception = state.business_date_exceptions.find(
    (ex) => ex.business_id === businessId && ex.date === dateStr,
  );

  let bizWindow: { startMinutes: number; endMinutes: number } | null = null;
  if (exception) {
    if (exception.is_closed) return null;
    bizWindow = {
      startMinutes: timeStrToMinutes(exception.start_time),
      endMinutes: timeStrToMinutes(exception.end_time),
    };
  } else {
    const bizHour = state.working_hours.find(
      (wh) => wh.business_id === businessId && wh.professional_id === null && wh.day_of_week === dayOfWeek,
    );
    if (!bizHour || bizHour.is_closed) return null;
    bizWindow = {
      startMinutes: timeStrToMinutes(bizHour.start_time),
      endMinutes: timeStrToMinutes(bizHour.end_time),
    };
  }

  const proHour = state.working_hours.find(
    (wh) => wh.business_id === businessId && wh.professional_id === professionalId && wh.day_of_week === dayOfWeek,
  );
  if (proHour) {
    if (proHour.is_closed) return null;
    const proStart = timeStrToMinutes(proHour.start_time);
    const proEnd = timeStrToMinutes(proHour.end_time);
    const intersectedStart = Math.max(bizWindow.startMinutes, proStart);
    const intersectedEnd = Math.min(bizWindow.endMinutes, proEnd);
    if (intersectedStart >= intersectedEnd) return null;
    return { startMinutes: intersectedStart, endMinutes: intersectedEnd };
  }

  return bizWindow;
}

export function intervalsOverlap(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number): boolean {
  return aStartMs < bEndMs && aEndMs > bStartMs;
}

export function getOccupiedIntervalsMs(
  state: DatabaseState,
  businessId: string,
  professionalId: string,
): Array<{ startMs: number; endMs: number }> {
  const occupied: Array<{ startMs: number; endMs: number }> = [];

  for (const appt of state.appointments) {
    if (appt.business_id !== businessId) continue;
    if (appt.professional_id !== professionalId) continue;
    if (appt.status === 'cancelled' || appt.status === 'no_show') continue;
    const startMs = new Date(appt.start_at).getTime();
    const totalMins = appt.duration_minutes_snapshot + appt.buffer_minutes_snapshot;
    const endMs = startMs + totalMins * 60_000;
    occupied.push({ startMs, endMs });
  }

  for (const blk of state.blocked_times) {
    if (blk.business_id !== businessId) continue;
    if (blk.professional_id !== null && blk.professional_id !== professionalId) continue;
    occupied.push({
      startMs: new Date(blk.start_at).getTime(),
      endMs: new Date(blk.end_at).getTime(),
    });
  }

  return occupied;
}

export function getAvailableSlots(params: {
  state: DatabaseState;
  businessId: string;
  serviceId: string;
  professionalId: string;
  dateStr: string;
  ignoreMinAdvance?: boolean;
}): { slots: AvailableSlot[]; error?: string } {
  const { state, businessId, serviceId, professionalId, dateStr, ignoreMinAdvance = false } = params;

  const biz = state.businesses.find((b) => b.id === businessId);
  if (!biz) return { slots: [], error: 'Estabelecimento não encontrado.' };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { slots: [], error: 'Data inválida.' };
  }

  const service = state.services.find(
    (s) => s.id === serviceId && s.business_id === businessId && s.active,
  );
  if (!service) return { slots: [], error: 'Serviço indisponível.' };

  const professional = state.professionals.find(
    (p) => p.id === professionalId && p.business_id === businessId && p.active,
  );
  if (!professional) return { slots: [], error: 'Profissional indisponível.' };

  const executesService = state.professional_services.some(
    (ps) =>
      ps.business_id === businessId &&
      ps.professional_id === professionalId &&
      ps.service_id === serviceId,
  );
  if (!executesService) {
    return { slots: [], error: 'Profissional não habilitado para este serviço.' };
  }

  const todayStr = getTodayDateStr(biz.timezone);
  const maxDateStr = addDaysToDateStr(todayStr, biz.max_future_days);
  if (dateStr < todayStr) {
    return { slots: [] };
  }
  if (dateStr > maxDateStr) {
    return { slots: [], error: `Agendamentos permitidos com até ${biz.max_future_days} dias de antecedência.` };
  }

  const window = getEffectiveWindowForDate(state, businessId, professionalId, dateStr, biz.timezone);
  if (!window) {
    return { slots: [] };
  }

  const totalDuration = service.duration_minutes + service.buffer_minutes;
  const occupied = getOccupiedIntervalsMs(state, businessId, professionalId);
  const nowMs = Date.now();
  const minAdvanceMs = ignoreMinAdvance ? 0 : biz.min_advance_minutes * 60_000;
  const stepMinutes = 15;
  const slots: AvailableSlot[] = [];

  for (
    let startMin = window.startMinutes;
    startMin + totalDuration <= window.endMinutes;
    startMin += stepMinutes
  ) {
    const startTimeStr = minutesToTimeStr(startMin);
    const serviceEndTimeStr = minutesToTimeStr(startMin + service.duration_minutes);
    const startAtIso = localDateTimeToUtcIso(dateStr, startTimeStr, biz.timezone);
    const startMs = new Date(startAtIso).getTime();
    const serviceEndIso = new Date(startMs + service.duration_minutes * 60_000).toISOString();
    const occupiedEndMs = startMs + totalDuration * 60_000;

    if (startMs < nowMs + minAdvanceMs) {
      continue;
    }

    const hasConflict = occupied.some((occ) =>
      intervalsOverlap(startMs, occupiedEndMs, occ.startMs, occ.endMs),
    );
    if (!hasConflict) {
      slots.push({
        start_time: startTimeStr,
        end_time: serviceEndTimeStr,
        start_at: startAtIso,
        end_at: serviceEndIso,
      });
    }
  }

  return { slots };
}

export function validateBookingInterval(params: {
  state: DatabaseState;
  businessId: string;
  serviceId: string;
  professionalId: string;
  dateStr: string;
  startTimeStr: string;
  isAdminOrigin: boolean;
}): { ok: true; start_at: string; end_at: string } | { ok: false; error: string } {
  const { state, businessId, serviceId, professionalId, dateStr, startTimeStr, isAdminOrigin } = params;

  const biz = state.businesses.find((b) => b.id === businessId);
  if (!biz) return { ok: false, error: 'Estabelecimento não encontrado.' };

  if (!isAdminOrigin) {
    const pub = isBusinessPubliclyActive(state, businessId);
    if (!pub.allowed) {
      return { ok: false, error: pub.reason ?? 'Agenda bloqueada.' };
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(startTimeStr)) {
    return { ok: false, error: 'Data ou horário em formato inválido.' };
  }

  const service = state.services.find(
    (s) => s.id === serviceId && s.business_id === businessId && s.active,
  );
  if (!service) return { ok: false, error: 'Serviço inválido ou inativo.' };

  const professional = state.professionals.find(
    (p) => p.id === professionalId && p.business_id === businessId && p.active,
  );
  if (!professional) return { ok: false, error: 'Profissional inválido ou inativo.' };

  const executes = state.professional_services.some(
    (ps) =>
      ps.business_id === businessId &&
      ps.professional_id === professionalId &&
      ps.service_id === serviceId,
  );
  if (!executes) {
    return { ok: false, error: 'Profissional não realiza o serviço selecionado.' };
  }

  const todayStr = getTodayDateStr(biz.timezone);
  const maxDateStr = addDaysToDateStr(todayStr, biz.max_future_days);
  if (!isAdminOrigin && (dateStr < todayStr || dateStr > maxDateStr)) {
    return { ok: false, error: 'Data fora do período permitido para agendamentos.' };
  }

  const window = getEffectiveWindowForDate(state, businessId, professionalId, dateStr, biz.timezone);
  if (!isAdminOrigin && !window) {
    return { ok: false, error: 'Estabelecimento ou profissional fechado nesta data.' };
  }

  const startMin = timeStrToMinutes(startTimeStr);
  const totalDuration = service.duration_minutes + service.buffer_minutes;

  if (!isAdminOrigin && window) {
    if (startMin < window.startMinutes || startMin + totalDuration > window.endMinutes) {
      return { ok: false, error: 'Horário selecionado fora do expediente.' };
    }
  }

  const startAtIso = localDateTimeToUtcIso(dateStr, startTimeStr, biz.timezone);
  const startMs = new Date(startAtIso).getTime();
  const serviceEndIso = new Date(startMs + service.duration_minutes * 60_000).toISOString();
  const occupiedEndMs = startMs + totalDuration * 60_000;

  if (!isAdminOrigin) {
    const minAdvanceMs = biz.min_advance_minutes * 60_000;
    if (startMs < Date.now() + minAdvanceMs) {
      return { ok: false, error: 'Horário não atende à antecedência mínima configurada.' };
    }
  }

  const occupied = getOccupiedIntervalsMs(state, businessId, professionalId);
  const hasConflict = occupied.some((occ) =>
    intervalsOverlap(startMs, occupiedEndMs, occ.startMs, occ.endMs),
  );
  if (hasConflict) {
    return { ok: false, error: 'Este intervalo acabou de ser ocupado. Escolha outro horário.' };
  }

  return { ok: true, start_at: startAtIso, end_at: serviceEndIso };
}
