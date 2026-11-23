import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseState } from './types';
import { generateSecureToken, slugify } from './security';
import { addDaysToDateStr, getTodayDateStr, localDateTimeToUtcIso } from './timezone';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'agendaflat-db.json');

declare global {
  var _agendaFlatDbCache: DatabaseState | undefined;
}

function normalizeImagePaths(state: DatabaseState): void {
  for (const b of state.businesses) {
    if (b.logo_url.startsWith('/src/assets/images/')) {
      b.logo_url = `/images/${b.logo_url.slice('/src/assets/images/'.length)}`;
    }
  }
  for (const p of state.professionals) {
    if (p.photo_url.startsWith('/src/assets/images/')) {
      p.photo_url = `/images/${p.photo_url.slice('/src/assets/images/'.length)}`;
    }
  }
}

function createInitialSeedState(): DatabaseState {
  const now = new Date().toISOString();
  const tz = 'America/Sao_Paulo';
  const today = getTodayDateStr(tz);
  const tomorrow = addDaysToDateStr(today, 1);
  const plus2Days = addDaysToDateStr(today, 2);

  const biz1Id = crypto.randomUUID();
  const proLucasId = crypto.randomUUID();
  const proRafaelId = crypto.randomUUID();
  const svcCorteId = crypto.randomUUID();
  const svcBarbaId = crypto.randomUUID();
  const svcComboId = crypto.randomUUID();
  const svcMassagemId = crypto.randomUUID();

  const biz2Id = crypto.randomUUID();
  const proLuanaId = crypto.randomUUID();
  const svcLimpezaId = crypto.randomUUID();
  const svcDrenagemId = crypto.randomUUID();
  const svcSobrancelhaId = crypto.randomUUID();

  const cust1Id = crypto.randomUUID();
  const cust2Id = crypto.randomUUID();
  const cust3Id = crypto.randomUUID();

  const workingHours = [
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      id: crypto.randomUUID(),
      business_id: biz1Id,
      professional_id: null,
      day_of_week: day,
      start_time: '09:00',
      end_time: day === 6 ? '17:00' : '19:00',
      is_closed: day === 0,
    })),
    ...[0, 1, 2, 3, 4, 5, 6].map((day) => ({
      id: crypto.randomUUID(),
      business_id: biz2Id,
      professional_id: null,
      day_of_week: day,
      start_time: '09:00',
      end_time: '18:00',
      is_closed: day === 0 || day === 1,
    })),
  ];

  const appt1Start = localDateTimeToUtcIso(tomorrow, '14:20', tz);
  const appt1End = new Date(new Date(appt1Start).getTime() + 30 * 60_000).toISOString();

  const appt2Start = localDateTimeToUtcIso(tomorrow, '10:00', tz);
  const appt2End = new Date(new Date(appt2Start).getTime() + 45 * 60_000).toISOString();

  const appt3Start = localDateTimeToUtcIso(plus2Days, '15:00', tz);
  const appt3End = new Date(new Date(appt3Start).getTime() + 60 * 60_000).toISOString();

  const sub1Id = crypto.randomUUID();
  const sub2Id = crypto.randomUUID();
  const periodEnd = new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString();

  return {
    profiles: [],
    businesses: [
      {
        id: biz1Id,
        name: 'Aurora Barbearia & Bem-Estar',
        slug: 'aurora-barbearia',
        segment: 'Barbearia',
        phone: '(11) 99420-8810',
        address: 'Rua dos Pinheiros, 612 — Pinheiros, São Paulo/SP',
        logo_url: '/images/hero_agendaflat_studio_1795394146079.jpg',
        description:
          'Cortes precisos, barboterapia e cuidados masculinos em ambiente calmo e pontual.',
        timezone: tz,
        status: 'active',
        min_advance_minutes: 60,
        max_future_days: 30,
        created_at: now,
        updated_at: now,
      },
      {
        id: biz2Id,
        name: 'Estúdio Luana Silva',
        slug: 'luana-estetica',
        segment: 'Estética',
        phone: '(11) 98712-3409',
        address: 'Av. Paulista, 1471, Conj. 84 — Bela Vista, São Paulo/SP',
        logo_url: '/images/pro_estetica_camila_1795394147902.jpg',
        description:
          'Estética facial, drenagem linfática e design de sobrancelhas com atendimento individualizado.',
        timezone: tz,
        status: 'active',
        min_advance_minutes: 60,
        max_future_days: 30,
        created_at: now,
        updated_at: now,
      },
    ],
    business_members: [],
    services: [
      {
        id: svcCorteId,
        business_id: biz1Id,
        name: 'Corte Masculino',
        description: 'Corte na tesoura ou máquina com lavagem e finalização.',
        price_cents: 6500,
        duration_minutes: 45,
        buffer_minutes: 0,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcBarbaId,
        business_id: biz1Id,
        name: 'Barba Completa',
        description: 'Toalha quente, navalha e hidratação com óleo essencial.',
        price_cents: 4500,
        duration_minutes: 30,
        buffer_minutes: 0,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcComboId,
        business_id: biz1Id,
        name: 'Corte + Barba',
        description: 'Pacote completo com alinhamento e relaxamento facial.',
        price_cents: 9500,
        duration_minutes: 75,
        buffer_minutes: 15,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcMassagemId,
        business_id: biz1Id,
        name: 'Massagem Express Cervical',
        description: 'Alívio rápido de tensão em ombros e pescoço.',
        price_cents: 7000,
        duration_minutes: 30,
        buffer_minutes: 0,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcLimpezaId,
        business_id: biz2Id,
        name: 'Limpeza de Pele Profunda',
        description: 'Higienização, extração suave, alta frequência e máscara calmante.',
        price_cents: 15000,
        duration_minutes: 60,
        buffer_minutes: 15,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcDrenagemId,
        business_id: biz2Id,
        name: 'Drenagem Linfática Facial',
        description: 'Redução de retenção hídrica e revitalização do contorno facial.',
        price_cents: 13000,
        duration_minutes: 45,
        buffer_minutes: 0,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: svcSobrancelhaId,
        business_id: biz2Id,
        name: 'Design de Sobrancelhas',
        description: 'Mapeamento facial personalizado com pinça e acabamento natural.',
        price_cents: 6000,
        duration_minutes: 30,
        buffer_minutes: 0,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    professionals: [
      {
        id: proLucasId,
        business_id: biz1Id,
        name: 'Lucas Mendes',
        photo_url: '/images/pro_barber_lucas_1795394148012.jpg',
        description: 'Especialista em visagismo masculino e cortes clássicos.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: proRafaelId,
        business_id: biz1Id,
        name: 'Rafael Costa',
        photo_url: '/images/pro_personal_rafael_1795394147508.jpg',
        description: 'Barbeiro e terapeuta corporal focado em bem-estar.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: proLuanaId,
        business_id: biz2Id,
        name: 'Luana Silva',
        photo_url: '/images/pro_estetica_camila_1795394147902.jpg',
        description: 'Esteticista graduada com 8 anos de prática clínica.',
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    professional_services: [
      { id: crypto.randomUUID(), business_id: biz1Id, professional_id: proLucasId, service_id: svcCorteId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz1Id, professional_id: proLucasId, service_id: svcBarbaId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz1Id, professional_id: proLucasId, service_id: svcComboId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz1Id, professional_id: proRafaelId, service_id: svcCorteId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz1Id, professional_id: proRafaelId, service_id: svcMassagemId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz2Id, professional_id: proLuanaId, service_id: svcLimpezaId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz2Id, professional_id: proLuanaId, service_id: svcDrenagemId, created_at: now },
      { id: crypto.randomUUID(), business_id: biz2Id, professional_id: proLuanaId, service_id: svcSobrancelhaId, created_at: now },
    ],
    working_hours: workingHours,
    blocked_times: [],
    business_date_exceptions: [],
    customers: [
      {
        id: cust1Id,
        business_id: biz1Id,
        name: 'Henrique Almeida',
        phone: '(11) 99123-4567',
        email: 'henrique.almeida@exemplo.com.br',
        notes: 'Prefere acabamento na tesoura.',
        consent_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        id: cust2Id,
        business_id: biz1Id,
        name: 'Bruno Carvalho',
        phone: '(11) 98234-5678',
        email: '',
        notes: '',
        consent_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        id: cust3Id,
        business_id: biz2Id,
        name: 'Marina Ferreira',
        phone: '(11) 99654-3210',
        email: 'marina.f@exemplo.com.br',
        notes: 'Pele sensível.',
        consent_at: now,
        created_at: now,
        updated_at: now,
      },
    ],
    appointments: [
      {
        id: crypto.randomUUID(),
        business_id: biz1Id,
        customer_id: cust1Id,
        professional_id: proLucasId,
        service_id: svcBarbaId,
        service_name_snapshot: 'Barba Completa',
        price_cents_snapshot: 4500,
        duration_minutes_snapshot: 30,
        buffer_minutes_snapshot: 0,
        start_at: appt1Start,
        end_at: appt1End,
        status: 'confirmed',
        origin: 'admin',
        cancel_token: generateSecureToken(20),
        notes: 'Reserva demonstrativa das 14:20 às 14:50',
        history: [{ at: now, action: 'created', actor: 'admin' }],
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        business_id: biz1Id,
        customer_id: cust2Id,
        professional_id: proLucasId,
        service_id: svcCorteId,
        service_name_snapshot: 'Corte Masculino',
        price_cents_snapshot: 6500,
        duration_minutes_snapshot: 45,
        buffer_minutes_snapshot: 0,
        start_at: appt2Start,
        end_at: appt2End,
        status: 'confirmed',
        origin: 'public',
        cancel_token: generateSecureToken(20),
        notes: '',
        history: [{ at: now, action: 'created', actor: 'public' }],
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        business_id: biz2Id,
        customer_id: cust3Id,
        professional_id: proLuanaId,
        service_id: svcLimpezaId,
        service_name_snapshot: 'Limpeza de Pele Profunda',
        price_cents_snapshot: 15000,
        duration_minutes_snapshot: 60,
        buffer_minutes_snapshot: 15,
        start_at: appt3Start,
        end_at: appt3End,
        status: 'confirmed',
        origin: 'public',
        cancel_token: generateSecureToken(20),
        notes: '',
        history: [{ at: now, action: 'created', actor: 'public' }],
        created_at: now,
        updated_at: now,
      },
    ],
    subscriptions: [
      {
        id: sub1Id,
        business_id: biz1Id,
        plan_name: 'Plano Profissional AgendaFlat',
        price_cents: 1990,
        status: 'authorized',
        provider: 'mercadopago',
        external_id: `mp_pre_${biz1Id.slice(0, 8)}`,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: sub2Id,
        business_id: biz2Id,
        plan_name: 'Plano Profissional AgendaFlat',
        price_cents: 1990,
        status: 'authorized',
        provider: 'mercadopago',
        external_id: `mp_pre_${biz2Id.slice(0, 8)}`,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        created_at: now,
        updated_at: now,
      },
    ],
    payments: [
      {
        id: crypto.randomUUID(),
        business_id: biz1Id,
        subscription_id: sub1Id,
        amount_cents: 1990,
        currency: 'BRL',
        status: 'approved',
        provider_payment_id: `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
        paid_at: now,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        business_id: biz2Id,
        subscription_id: sub2Id,
        amount_cents: 1990,
        currency: 'BRL',
        status: 'approved',
        provider_payment_id: `mp_pay_${crypto.randomBytes(5).toString('hex')}`,
        paid_at: now,
        created_at: now,
      },
    ],
    webhook_events: [],
    audit_logs: [
      {
        id: crypto.randomUUID(),
        business_id: biz1Id,
        actor_id: 'system',
        actor_email: 'sistema@agendaflat.com.br',
        action: 'business.activated',
        target_type: 'business',
        target_id: biz1Id,
        details: 'Estabelecimento demonstrativo inicializado com assinatura ativa.',
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        business_id: biz2Id,
        actor_id: 'system',
        actor_email: 'sistema@agendaflat.com.br',
        action: 'business.activated',
        target_type: 'business',
        target_id: biz2Id,
        details: 'Estabelecimento demonstrativo inicializado com assinatura ativa.',
        created_at: now,
      },
    ],
    platform_admins: [],
    password_resets: [],
  };
}

export function loadDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialSeedState();
    saveDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseState;
    normalizeImagePaths(parsed);
    globalThis._agendaFlatDbCache = parsed;
    return parsed;
  } catch {
    if (globalThis._agendaFlatDbCache) return globalThis._agendaFlatDbCache;
    const initial = createInitialSeedState();
    saveDb(initial);
    return initial;
  }
}

export function saveDb(state: DatabaseState): void {
  globalThis._agendaFlatDbCache = state;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

export function addAuditLog(
  state: DatabaseState,
  entry: {
    business_id: string | null;
    actor_id: string;
    actor_email: string;
    action: string;
    target_type: string;
    target_id: string;
    details: string;
  },
): void {
  state.audit_logs.unshift({
    id: crypto.randomUUID(),
    ...entry,
    created_at: new Date().toISOString(),
  });
  if (state.audit_logs.length > 500) {
    state.audit_logs.length = 500;
  }
}

export function ensureUniqueSlug(desired: string, excludeBusinessId?: string): string {
  const db = loadDb();
  const base = slugify(desired) || `negocio-${crypto.randomBytes(2).toString('hex')}`;
  let candidate = base;
  let counter = 2;
  while (
    db.businesses.some(
      (b) => b.slug === candidate && b.id !== excludeBusinessId && b.status !== 'deleted',
    )
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export function seedDemoIntoBusiness(state: DatabaseState, businessId: string): void {
  const biz = state.businesses.find((b) => b.id === businessId);
  if (!biz) return;
  const now = new Date().toISOString();
  const tz = biz.timezone;
  const today = getTodayDateStr(tz);
  const tomorrow = addDaysToDateStr(today, 1);

  let proId = state.professionals.find((p) => p.business_id === businessId)?.id;
  if (!proId) {
    proId = crypto.randomUUID();
    state.professionals.push({
      id: proId,
      business_id: businessId,
      name: 'Equipe Principal',
      photo_url: '/images/pro_barber_lucas_1795394148012.jpg',
      description: 'Atendimento titular com hora marcada.',
      active: true,
      created_at: now,
      updated_at: now,
    });
  }

  let svc = state.services.find((s) => s.business_id === businessId);
  if (!svc) {
    svc = {
      id: crypto.randomUUID(),
      business_id: businessId,
      name: 'Atendimento Padrão',
      description: 'Sessão completa com hora marcada e acompanhamento.',
      price_cents: 8000,
      duration_minutes: 45,
      buffer_minutes: 0,
      active: true,
      created_at: now,
      updated_at: now,
    };
    state.services.push(svc);
  }

  for (const p of state.professionals.filter((x) => x.business_id === businessId)) {
    for (const s of state.services.filter((x) => x.business_id === businessId)) {
      const exists = state.professional_services.some(
        (ps) => ps.business_id === businessId && ps.professional_id === p.id && ps.service_id === s.id,
      );
      if (!exists) {
        state.professional_services.push({
          id: crypto.randomUUID(),
          business_id: businessId,
          professional_id: p.id,
          service_id: s.id,
          created_at: now,
        });
      }
    }
  }

  if (!state.customers.some((c) => c.business_id === businessId)) {
    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    state.customers.push(
      {
        id: c1,
        business_id: businessId,
        name: 'Camila Rocha',
        phone: '(11) 99311-2200',
        email: 'camila.rocha@exemplo.com.br',
        notes: 'Cliente recorrente.',
        consent_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        id: c2,
        business_id: businessId,
        name: 'Thiago Martins',
        phone: '(11) 98422-1199',
        email: '',
        notes: '',
        consent_at: now,
        created_at: now,
        updated_at: now,
      },
    );

    const s1 = localDateTimeToUtcIso(tomorrow, '10:00', tz);
    const e1 = new Date(new Date(s1).getTime() + svc.duration_minutes * 60_000).toISOString();
    const s2 = localDateTimeToUtcIso(tomorrow, '15:00', tz);
    const e2 = new Date(new Date(s2).getTime() + svc.duration_minutes * 60_000).toISOString();

    state.appointments.push(
      {
        id: crypto.randomUUID(),
        business_id: businessId,
        customer_id: c1,
        professional_id: proId,
        service_id: svc.id,
        service_name_snapshot: svc.name,
        price_cents_snapshot: svc.price_cents,
        duration_minutes_snapshot: svc.duration_minutes,
        buffer_minutes_snapshot: svc.buffer_minutes,
        start_at: s1,
        end_at: e1,
        status: 'confirmed',
        origin: 'public',
        cancel_token: generateSecureToken(20),
        notes: 'Agendamento de exemplo',
        history: [{ at: now, action: 'created', actor: 'public' }],
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        business_id: businessId,
        customer_id: c2,
        professional_id: proId,
        service_id: svc.id,
        service_name_snapshot: svc.name,
        price_cents_snapshot: svc.price_cents,
        duration_minutes_snapshot: svc.duration_minutes,
        buffer_minutes_snapshot: svc.buffer_minutes,
        start_at: s2,
        end_at: e2,
        status: 'completed',
        origin: 'admin',
        cancel_token: generateSecureToken(20),
        notes: '',
        history: [{ at: now, action: 'completed', actor: 'admin' }],
        created_at: now,
        updated_at: now,
      },
    );
  }
}
