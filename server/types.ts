export type UserRole = 'owner' | 'superadmin';
export type BusinessStatus = 'onboarding' | 'active' | 'suspended' | 'deleted';
export type MemberRole = 'owner' | 'manager' | 'staff';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type AppointmentOrigin = 'public' | 'admin';
export type SubscriptionStatus = 'pending_payment' | 'authorized' | 'paused' | 'cancelled';
export type PaymentStatus = 'approved' | 'pending' | 'rejected' | 'refunded';

export interface Profile {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  segment: string;
  phone: string;
  address: string;
  logo_url: string;
  description: string;
  timezone: string;
  status: BusinessStatus;
  min_advance_minutes: number;
  max_future_days: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  business_id: string;
  name: string;
  photo_url: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalService {
  id: string;
  business_id: string;
  professional_id: string;
  service_id: string;
  created_at: string;
}

export interface WorkingHour {
  id: string;
  business_id: string;
  professional_id: string | null;
  day_of_week: number; // 0 = Sunday .. 6 = Saturday
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  is_closed: boolean;
}

export interface BlockedTime {
  id: string;
  business_id: string;
  professional_id: string | null;
  start_at: string; // ISO UTC
  end_at: string; // ISO UTC
  reason: string;
  created_at: string;
}

export interface BusinessDateException {
  id: string;
  business_id: string;
  date: string; // YYYY-MM-DD in business timezone
  is_closed: boolean;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  note: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentHistoryEntry {
  at: string;
  action: string;
  actor: string;
  note?: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  professional_id: string;
  service_id: string;
  service_name_snapshot: string;
  price_cents_snapshot: number;
  duration_minutes_snapshot: number;
  buffer_minutes_snapshot: number;
  start_at: string; // ISO UTC
  end_at: string; // ISO UTC (service end without buffer)
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  cancel_token: string;
  notes: string;
  history: AppointmentHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_name: string;
  price_cents: number;
  status: SubscriptionStatus;
  provider: 'mercadopago';
  external_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  subscription_id: string;
  amount_cents: number;
  currency: 'BRL';
  status: PaymentStatus;
  provider_payment_id: string;
  paid_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: 'mercadopago';
  event_id: string;
  event_type: string;
  payload_summary: string;
  processed_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string | null;
  actor_id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

export interface PlatformAdmin {
  user_id: string;
  email: string;
  created_at: string;
}

export interface PasswordResetToken {
  token: string;
  user_id: string;
  expires_at: string;
  used: boolean;
}

export interface DatabaseState {
  profiles: Profile[];
  businesses: Business[];
  business_members: BusinessMember[];
  services: Service[];
  professionals: Professional[];
  professional_services: ProfessionalService[];
  working_hours: WorkingHour[];
  blocked_times: BlockedTime[];
  business_date_exceptions: BusinessDateException[];
  customers: Customer[];
  appointments: Appointment[];
  subscriptions: Subscription[];
  payments: Payment[];
  webhook_events: WebhookEvent[];
  audit_logs: AuditLog[];
  platform_admins: PlatformAdmin[];
  password_resets: PasswordResetToken[];
}
