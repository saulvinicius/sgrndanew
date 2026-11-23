import Link from 'next/link';
import { MarketingLayout } from '@/src/components/layout/MarketingLayout';
import { EmptyState } from '@/src/components/ui/Primitives';

export default function NotFound() {
  return (
    <MarketingLayout>
      <div className="max-w-lg mx-auto px-4 py-16">
        <EmptyState
          title="Página não encontrada"
          description="O endereço solicitado não existe ou foi movido."
          action={
            <Link href="/" className="text-sm font-medium text-[#116B45] hover:underline">
              Voltar para a página inicial
            </Link>
          }
        />
      </div>
    </MarketingLayout>
  );
}
