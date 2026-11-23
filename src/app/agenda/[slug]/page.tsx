import { PublicBookingPage } from '@/src/components/views/PublicBookingView';

export default async function AgendaSlugRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBookingPage slug={slug} />;
}
