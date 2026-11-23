import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CalendarCheck, ShieldCheck, Clock, Users } from 'lucide-react';
import { MarketingLayout } from '../components/layout/MarketingLayout.tsx';
import { AvatarImage, Button } from '../components/ui/Primitives.tsx';
import { apiRequest } from '../lib/api.ts';
import { Link, useRouter } from '../lib/router.tsx';

interface ShowcaseBiz {
  id: string;
  name: string;
  slug: string;
  segment: string;
  address: string;
  logo_url: string;
  servicesCount: number;
}

export function LandingPage() {
  const { navigate } = useRouter();
  const [showcase, setShowcase] = useState<ShowcaseBiz[]>([]);

  useEffect(() => {
    apiRequest<{ businesses: ShowcaseBiz[] }>('/api/public/showcase', { authMode: 'none' })
      .then((res) => setShowcase(res.businesses))
      .catch(() => setShowcase([]));
  }, []);

  return (
    <MarketingLayout>
      {/* Hero Split */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-8 lg:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-10">
            <div>
              <p className="text-xs font-medium text-[#116B45] tracking-wide">
                AgendaFlat · Agendar ficou fácil
              </p>
              <h1
                className="mt-4 font-display font-bold text-[#252D29] leading-[1.08] tracking-tight"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.35rem)', textWrap: 'balance' }}
              >
                Sua agenda aberta 24h, sem comissão por atendimento.
              </h1>
              <p className="mt-5 text-base text-[#252D29]/80 leading-relaxed max-w-xl">
                Organize horários, serviços, profissionais e clientes em um link público simples.
                Seus clientes escolhem o horário livre e recebem link seguro de cancelamento sem precisar criar conta.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E8EEEC] flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={() => navigate('/cadastro')}>
                Criar agenda por R$ 19,90/mês
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Link
                to="/agenda/aurora-barbearia"
                className="text-sm font-medium text-[#116B45] hover:underline underline-offset-4 px-2 py-2"
              >
                Testar agendamento ao vivo
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 min-h-[300px] lg:min-h-[440px] rounded-xl overflow-hidden border border-[#DFE5E2] bg-[#E8F7EF]">
            <img
              src="/src/assets/images/hero_agendaflat_studio_1795394146079.jpg"
              alt="Espaço Aurora Barbearia e Bem-Estar usando AgendaFlat"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* 4-Column Proof Strip */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
            <div className="font-mono text-2xl font-semibold text-[#116B45] tabular-nums">
              R$ 19,90
            </div>
            <div className="mt-1 text-sm text-[#252D29]/75">Mensalidade fixa única</div>
          </div>
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
            <div className="font-mono text-2xl font-semibold text-[#116B45] tabular-nums">
              0%
            </div>
            <div className="mt-1 text-sm text-[#252D29]/75">Taxa para o cliente final</div>
          </div>
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
            <div className="font-mono text-2xl font-semibold text-[#116B45] tabular-nums">
              [início, fim)
            </div>
            <div className="mt-1 text-sm text-[#252D29]/75">Trava exata contra conflitos</div>
          </div>
          <div className="bg-white rounded-xl border border-[#DFE5E2] p-5">
            <div className="font-mono text-2xl font-semibold text-[#116B45] tabular-nums">
              Ilimitado
            </div>
            <div className="mt-1 text-sm text-[#252D29]/75">Sem teto de agendamentos</div>
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Grid */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#116B45] tracking-tight">
            Feito para quem trabalha com hora marcada
          </h2>
          <p className="mt-2 text-base text-[#252D29]/75">
            Cada estabelecimento opera em seu próprio espaço isolado, com regras reais de disponibilidade e histórico preservado.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-[#116B45]">01. Disponibilidade de intervalo completo</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#252D29]">
                Sem encaixes impossíveis nem dois clientes no mesmo horário
              </h3>
              <p className="mt-2 text-sm text-[#252D29]/75 leading-relaxed max-w-2xl">
                O motor calcula o intervalo completo do serviço somado ao intervalo adicional de preparação, respeitando o fuso horário do estabelecimento, bloqueios, feriados e a jornada individual de cada profissional.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-[#E8EEEC] text-xs text-[#252D29]/70 font-mono tabular-nums">
              Exemplo: atendimento das 14:20 às 14:50 impede automaticamente reserva de 30 min às 14:00.
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
            <span className="text-xs font-mono text-[#116B45]">02. Link público direto</span>
            <h3 className="mt-2 font-display text-xl font-semibold text-[#252D29]">
              Cliente não cria senha
            </h3>
            <p className="mt-2 text-sm text-[#252D29]/75 leading-relaxed">
              Seu cliente acessa /agenda/seu-negocio, escolhe serviço, profissional e horário, e confirma em menos de um minuto.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE5E2] p-6 sm:p-8">
            <span className="text-xs font-mono text-[#116B45]">03. Preço e duração congelados</span>
            <h3 className="mt-2 font-display text-xl font-semibold text-[#252D29]">
              Histórico financeiro intacto
            </h3>
            <p className="mt-2 text-sm text-[#252D29]/75 leading-relaxed">
              Cada reserva grava o valor e a duração vigentes no momento do agendamento. Reajustes futuros não alteram relatórios passados.
            </p>
          </div>

          <div className="md:col-span-2 bg-[#E8F7EF] rounded-xl border border-[#CBEAD9] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-mono text-[#116B45]">04. Cancelamento com token seguro</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#116B45]">
                Menos faltas e menos mensagens manuais no WhatsApp
              </h3>
              <p className="mt-2 text-sm text-[#116B45]/85 leading-relaxed max-w-xl">
                Cada confirmação gera um link exclusivo de cancelamento com histórico auditável e exportação imediata para o calendário do cliente.
              </p>
            </div>
            <Button onClick={() => navigate('/agenda/aurora-barbearia')}>
              Ver fluxo público
            </Button>
          </div>
        </div>
      </section>

      {/* Showcase Live Establishments */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#116B45]">
              Páginas públicas em funcionamento
            </h2>
            <p className="mt-1 text-sm text-[#252D29]/75">
              Experimente a jornada do cliente final em estabelecimentos reais de demonstração.
            </p>
          </div>
          <Link to="/segmentos" className="text-sm font-medium text-[#116B45] hover:underline underline-offset-4">
            Ver todos os segmentos
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {showcase.map((biz) => (
            <div
              key={biz.id}
              className="bg-white rounded-xl border border-[#DFE5E2] p-6 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <AvatarImage
                  src={biz.logo_url}
                  alt={biz.name}
                  name={biz.name}
                  className="w-16 h-16 rounded-lg"
                />
                <div className="min-w-0">
                  <div className="text-xs text-[#116B45] font-medium">
                    {biz.segment} · {biz.servicesCount} serviços ativos
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-[#252D29] truncate">
                    {biz.name}
                  </h3>
                  <p className="text-xs text-[#252D29]/70 truncate">{biz.address}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/agenda/${biz.slug}`)}
              >
                Agendar
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Summary */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-xl border border-[#DFE5E2] p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium text-[#116B45]">Plano único transparente</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#252D29]">
              R$ 19,90 por mês via Mercado Pago
            </h2>
            <p className="mt-3 text-sm text-[#252D29]/75 leading-relaxed max-w-xl">
              Sem período de teste grátis e sem surpresas na fatura: você configura seu negócio, ativa a assinatura recorrente e libera imediatamente sua página pública e todo o painel administrativo.
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[#252D29]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#168653] shrink-0" />
                <span>Agendamentos ilimitados</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#168653] shrink-0" />
                <span>Múltiplos profissionais e serviços</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#168653] shrink-0" />
                <span>Bloqueios e feriados configuráveis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#168653] shrink-0" />
                <span>Dados preservados após cancelamento</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#F5F7F6] rounded-xl border border-[#E3EAE6] p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-[#252D29]">Assinatura mensal</span>
              <span className="font-mono text-3xl font-bold text-[#116B45] tabular-nums">
                R$ 19,90
              </span>
            </div>
            <p className="mt-2 text-xs text-[#252D29]/70">
              Cobrança recorrente mensal autorizada no Mercado Pago. Cancele quando quiser sem perder seu histórico.
            </p>
            <Button className="w-full mt-5" size="lg" onClick={() => navigate('/cadastro')}>
              Cadastrar estabelecimento
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export function PricingPage() {
  const { navigate } = useRouter();

  const items = [
    {
      icon: CalendarCheck,
      title: 'Agenda e página pública',
      detail: 'Link exclusivo /agenda/seu-slug liberado após ativação, com cálculo em tempo real.',
    },
    {
      icon: Users,
      title: 'Equipe e serviços',
      detail: 'Cadastre quantos serviços e profissionais precisar, com jornadas individuais.',
    },
    {
      icon: Clock,
      title: 'Regras de funcionamento',
      detail: 'Antecedência mínima, limite de dias futuros, bloqueios manuais e exceções por data.',
    },
    {
      icon: ShieldCheck,
      title: 'Preservação dos dados',
      detail: 'Ao cancelar, seu acesso segue ativo até o fim do ciclo pago e seus registros são preservados.',
    },
  ];

  return (
    <MarketingLayout>
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#116B45]">Preços e condições comerciais</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#252D29] tracking-tight">
            Um único plano completo por R$ 19,90/mês
          </h1>
          <p className="mt-3 text-base text-[#252D29]/75">
            Construído para manter custo operacional baixo e previsível para profissionais autônomos e pequenos negócios no Brasil.
          </p>
        </div>

        <div className="mt-8 bg-white rounded-xl border border-[#DFE5E2] p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 md:border-r md:border-[#E8EEEC] md:pr-8">
            <div className="text-sm font-medium text-[#116B45]">Plano Profissional AgendaFlat</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-[#252D29] tabular-nums">R$ 19,90</span>
              <span className="text-sm text-[#252D29]/70">/mês</span>
            </div>
            <p className="mt-3 text-sm text-[#252D29]/75">
              Sem teste grátis. A cobrança recorrente via Mercado Pago ativa imediatamente a agenda pública e todos os recursos.
            </p>
            <Button className="w-full mt-6" size="lg" onClick={() => navigate('/cadastro')}>
              Criar conta e assinar
            </Button>
          </div>

          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.title} className="space-y-1.5">
                <div className="flex items-center gap-2 font-display font-semibold text-sm text-[#116B45]">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-sm text-[#252D29]/75 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

export function SegmentsPage() {
  const { navigate } = useRouter();
  const [selected, setSelected] = useState<string>('Todos');

  const segments = [
    {
      category: 'Beleza e Cuidados',
      name: 'Barbearias',
      example: 'Corte 45 min · Barba 30 min · Pacote 75 min com 15 min de intervalo',
      demoSlug: 'aurora-barbearia',
    },
    {
      category: 'Beleza e Cuidados',
      name: 'Salões de Beleza',
      example: 'Coloração, escova e hidratação com múltiplos profissionais e horários individuais',
      demoSlug: null,
    },
    {
      category: 'Beleza e Cuidados',
      name: 'Manicures e Nail Designers',
      example: 'Alongamento em gel, esmaltação e manutenção com duração exata',
      demoSlug: null,
    },
    {
      category: 'Saúde e Bem-Estar',
      name: 'Clínicas de Estética',
      example: 'Limpeza de pele 60 min + 15 min higienização de cabine',
      demoSlug: 'luana-estetica',
    },
    {
      category: 'Saúde e Bem-Estar',
      name: 'Podólogos e Massoterapeutas',
      example: 'Sessões de 30 a 60 min com histórico preservado do cliente',
      demoSlug: null,
    },
    {
      category: 'Treino e Ensino',
      name: 'Personal Trainers',
      example: 'Aulas individuais de 50 min com bloqueio rápido de deslocamento',
      demoSlug: null,
    },
    {
      category: 'Treino e Ensino',
      name: 'Professores Particulares',
      example: 'Aulas de idiomas, música ou reforço com fuso horário configurado',
      demoSlug: null,
    },
    {
      category: 'Arte Corporal',
      name: 'Estúdios de Tatuagem',
      example: 'Sessões longas de 2h a 4h com antecedência mínima configurável',
      demoSlug: null,
    },
  ];

  const categories = ['Todos', 'Beleza e Cuidados', 'Saúde e Bem-Estar', 'Treino e Ensino', 'Arte Corporal'];
  const filtered = selected === 'Todos' ? segments : segments.filter((s) => s.category === selected);

  return (
    <MarketingLayout>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#116B45]">Segmentos atendidos</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#252D29] tracking-tight">
            Uma única plataforma adaptada ao ritmo do seu atendimento
          </h1>
          <p className="mt-3 text-base text-[#252D29]/75">
            Configure durações, intervalos de higienização e jornadas individuais por profissional.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5 p-1 bg-white border border-[#DFE5E2] rounded-lg w-fit">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelected(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selected === cat
                  ? 'bg-[#168653] text-white'
                  : 'text-[#252D29]/75 hover:text-[#116B45] hover:bg-[#F5F7F6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((seg) => (
            <div
              key={seg.name}
              className="bg-white rounded-xl border border-[#DFE5E2] p-6 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="text-xs font-medium text-[#116B45]">{seg.category}</div>
                <h2 className="mt-1 font-display text-xl font-semibold text-[#252D29]">{seg.name}</h2>
                <p className="mt-2 text-sm text-[#252D29]/75">{seg.example}</p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[#E8EEEC]">
                <Button size="sm" onClick={() => navigate('/cadastro')}>
                  Usar para {seg.name}
                </Button>
                {seg.demoSlug ? (
                  <Link
                    to={`/agenda/${seg.demoSlug}`}
                    className="text-xs font-medium text-[#116B45] hover:underline underline-offset-4"
                  >
                    Ver agenda demo
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MarketingLayout>
  );
}
