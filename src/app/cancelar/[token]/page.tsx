import { CancelBookingPage } from '@/src/components/views/CancelBookingView';

export default async function CancelarTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CancelBookingPage token={token} />;
}
