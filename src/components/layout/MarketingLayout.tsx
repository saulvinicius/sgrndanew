import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useRouter } from '../../lib/router.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../ui/Primitives.tsx';

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = useAuth();
  const { navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryActionPath = user
    ? business?.status === 'active'
      ? '/painel'
      : '/onboarding'
    : '/cadastro';
  const primaryActionLabel = user
    ? business?.status === 'active'
      ? 'Abrir painel'
      : 'Continuar cadastro'
    : 'Começar agora';

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F6] text-[#252D29]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E3EAE6]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-[#116B45] whitespace-nowrap shrink-0"
          >
            AgendaFlat
          </Link>

          {/* Zone 2: 4 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#252D29]/80">
            <Link
              to="/segmentos"
              className="hover:text-[#116B45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Segmentos
            </Link>
            <Link
              to="/precos"
              className="hover:text-[#116B45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Preços
            </Link>
            <Link
              to="/agenda/aurora-barbearia"
              className="hover:text-[#116B45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Agenda Demo
            </Link>
            <Link
              to="/login"
              className="hover:text-[#116B45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Entrar
            </Link>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate(primaryActionPath)}
            >
              {primaryActionLabel}
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menu"
              className="md:hidden p-2 rounded-lg text-[#252D29] hover:bg-[#E8F7EF] min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-[#E3EAE6] bg-white px-4 py-4 space-y-2">
            <Link
              to="/segmentos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#252D29]"
            >
              Segmentos
            </Link>
            <Link
              to="/precos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#252D29]"
            >
              Preços
            </Link>
            <Link
              to="/agenda/aurora-barbearia"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#252D29]"
            >
              Agenda Demo
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#252D29]"
            >
              Entrar
            </Link>
            <div className="pt-2">
              <Button
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(primaryActionPath);
                }}
              >
                {primaryActionLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E3EAE6] bg-white mt-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <span className="font-display text-lg font-bold text-[#116B45]">AgendaFlat</span>
            <p className="mt-1 text-sm text-[#252D29]/70">
              Agendar ficou fácil. Plataforma multi-tenant para pequenos negócios e profissionais autônomos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#252D29]/75">
            <Link to="/segmentos" className="hover:text-[#116B45]">
              Segmentos
            </Link>
            <Link to="/precos" className="hover:text-[#116B45]">
              Plano R$ 19,90/mês
            </Link>
            <Link to="/agenda/aurora-barbearia" className="hover:text-[#116B45]">
              Barbearia Demo
            </Link>
            <Link to="/agenda/luana-estetica" className="hover:text-[#116B45]">
              Estética Demo
            </Link>
            <Link to="/admin" className="hover:text-[#116B45]">
              Administração
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
