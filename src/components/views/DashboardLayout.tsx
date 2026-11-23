'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { Button, InlineAlert } from '@/src/components/ui/Primitives';

const NAV_ITEMS = [
  { to: '/painel', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/painel/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/painel/servicos', label: 'Serviços', icon: Briefcase },
  { to: '/painel/profissionais', label: 'Profissionais', icon: UserCheck },
  { to: '/painel/clientes', label: 'Clientes', icon: Users },
  { to: '/painel/horarios', label: 'Horários e bloqueios', icon: Clock },
  { to: '/painel/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/painel/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/painel/assinatura', label: 'Assinatura e suporte', icon: CreditCard },
] as const;

export function DashboardLayout({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, business, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-[#252D29] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-[#E3EAE6] shrink-0">
        <div className="h-16 px-5 border-b border-[#E8EEEC] flex items-center justify-between">
          <Link href="/" className="font-display text-lg font-bold text-[#116B45] whitespace-nowrap">
            AgendaFlat
          </Link>
        </div>

        <div className="px-4 py-4 border-b border-[#E8EEEC]">
          <div className="text-xs text-[#252D29]/65 truncate">{business?.segment || 'Estabelecimento'}</div>
          <div className="font-display font-semibold text-sm text-[#252D29] truncate">
            {business?.name || user.name}
          </div>
          {business?.slug ? (
            <Link
              href={`/agenda/${business.slug}`}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#116B45] hover:underline"
            >
              <span>Ver página pública</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : null}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#E8F7EF] text-[#116B45]'
                    : 'text-[#252D29]/80 hover:bg-[#F5F7F6] hover:text-[#252D29]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E8EEEC]">
          <div className="text-xs text-[#252D29]/70 truncate mb-2">{user.email}</div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              logout();
              router.push('/');
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </Button>
        </div>
      </aside>

      {/* Mobile Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-[#E3EAE6] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir navegação do painel"
            className="p-2 rounded-lg text-[#252D29] hover:bg-[#F5F7F6]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-display font-bold text-base text-[#116B45] truncate">
            {business?.name || 'AgendaFlat'}
          </span>
        </div>
        {business?.slug ? (
          <Link
            href={`/agenda/${business.slug}`}
            className="text-xs font-medium text-[#116B45] whitespace-nowrap"
          >
            Agenda pública
          </Link>
        ) : null}
      </header>

      {mobileOpen ? (
        <div className="lg:hidden bg-white border-b border-[#E3EAE6] px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active ? 'bg-[#E8F7EF] text-[#116B45]' : 'text-[#252D29]/80'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              logout();
              router.push('/');
            }}
            className="w-full text-left px-3 py-2.5 text-sm text-[#E5484D] font-medium"
          >
            Sair da conta
          </button>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border-b border-[#E8EEEC] px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#252D29]/60">
              Painel / {title}
            </div>
            <h1 className="font-display text-xl font-bold text-[#252D29]">{title}</h1>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        <main className="flex-1 p-4 sm:p-8 max-w-[1160px] w-full space-y-6">
          {business && business.status !== 'active' ? (
            <InlineAlert tone="error">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  {business.status === 'onboarding'
                    ? 'Seu estabelecimento ainda está em configuração. Conclua a assinatura de R$ 19,90/mês para liberar agendamentos públicos.'
                    : 'Agendamentos públicos bloqueados por pendência na assinatura.'}
                </span>
                <Link
                  href={business.status === 'onboarding' ? '/onboarding' : '/painel/assinatura'}
                  className="font-semibold text-[#116B45] hover:underline whitespace-nowrap"
                >
                  Regularizar agora
                </Link>
              </div>
            </InlineAlert>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
