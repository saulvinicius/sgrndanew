export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatDateBR(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatIsoDateTimeBR(isoStr: string, timeZone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(isoStr));
}

export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const SEGMENTS = [
  'Barbearia',
  'Salão de Beleza',
  'Manicure e Pedicure',
  'Estética',
  'Tatuagem',
  'Massagem e Bem-Estar',
  'Personal Trainer',
  'Podologia',
  'Professor Particular',
  'Outro serviço com hora marcada',
] as const;

export const STUDIO_AVATARS = [
  {
    label: 'Retrato Barbeiro (Lucas)',
    url: '/images/pro_barber_lucas_1795394148012.jpg',
  },
  {
    label: 'Retrato Estética (Luana)',
    url: '/images/pro_estetica_camila_1795394147902.jpg',
  },
  {
    label: 'Retrato Coach / Terapeuta (Rafael)',
    url: '/images/pro_personal_rafael_1795394147508.jpg',
  },
] as const;

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
    onboarding: 'Em configuração',
    active: 'Ativo',
    suspended: 'Suspenso',
    authorized: 'Ativa',
    pending_payment: 'Aguardando pagamento',
    paused: 'Pausada',
    approved: 'Aprovado',
    rejected: 'Recusado',
  };
  return map[status] ?? status;
}

export function downloadCalendarICS(params: {
  title: string;
  description: string;
  location: string;
  startAtIso: string;
  endAtIso: string;
}): void {
  const toICSDate = (iso: string) =>
    iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AgendaFlat//Agendamento//PT-BR',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@agendaflat.com.br`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${toICSDate(params.startAtIso)}`,
    `DTEND:${toICSDate(params.endAtIso)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${params.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'agendamento-agendaflat.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
