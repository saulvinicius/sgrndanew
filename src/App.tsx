import React from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { RouterProvider, Link, useRouter } from './lib/router.tsx';
import { MarketingLayout } from './components/layout/MarketingLayout.tsx';
import { EmptyState } from './components/ui/Primitives.tsx';
import { LandingPage, PricingPage, SegmentsPage } from './pages/MarketingPages.tsx';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages.tsx';
import { OnboardingPage } from './pages/OnboardingPage.tsx';
import {
  DashboardAgendaPage,
  DashboardOverviewPage,
  DashboardProfessionalsPage,
  DashboardServicesPage,
} from './pages/DashboardCoreViews.tsx';
import {
  DashboardCustomersPage,
  DashboardReportsPage,
  DashboardSchedulePage,
  DashboardSettingsPage,
  DashboardSubscriptionPage,
} from './pages/DashboardOpsViews.tsx';
import { PublicBookingPage } from './pages/PublicBookingPage.tsx';
import { CancelBookingPage } from './pages/CancelBookingPage.tsx';
import { SuperadminPage } from './pages/SuperadminPage.tsx';

function AppRoutes() {
  const { pathname } = useRouter();
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/') return <LandingPage />;
  if (normalized === '/precos') return <PricingPage />;
  if (normalized === '/segmentos') return <SegmentsPage />;
  if (normalized === '/login') return <LoginPage />;
  if (normalized === '/cadastro') return <RegisterPage />;
  if (normalized === '/recuperar-senha') return <ForgotPasswordPage />;
  if (normalized === '/onboarding') return <OnboardingPage />;

  if (normalized === '/painel') return <DashboardOverviewPage />;
  if (normalized === '/painel/agenda') return <DashboardAgendaPage />;
  if (normalized === '/painel/servicos') return <DashboardServicesPage />;
  if (normalized === '/painel/profissionais') return <DashboardProfessionalsPage />;
  if (normalized === '/painel/clientes') return <DashboardCustomersPage />;
  if (normalized === '/painel/horarios') return <DashboardSchedulePage />;
  if (normalized === '/painel/relatorios') return <DashboardReportsPage />;
  if (normalized === '/painel/configuracoes') return <DashboardSettingsPage />;
  if (normalized === '/painel/assinatura') return <DashboardSubscriptionPage />;

  if (normalized === '/admin') return <SuperadminPage />;

  if (normalized.startsWith('/agenda/')) {
    const slug = decodeURIComponent(normalized.slice('/agenda/'.length));
    if (slug) return <PublicBookingPage slug={slug} />;
  }

  if (normalized.startsWith('/cancelar/')) {
    const token = decodeURIComponent(normalized.slice('/cancelar/'.length));
    if (token) return <CancelBookingPage token={token} />;
  }

  return (
    <MarketingLayout>
      <div className="max-w-lg mx-auto px-4 py-16">
        <EmptyState
          title="Página não encontrada"
          description="O endereço acessado não existe no AgendaFlat."
          action={
            <Link to="/" className="text-sm font-medium text-[#116B45] hover:underline">
              Voltar para a página inicial
            </Link>
          }
        />
      </div>
    </MarketingLayout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
