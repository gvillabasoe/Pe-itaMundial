import { notFound } from 'next/navigation';
import { ParticipantPage } from '@/components/participant/participant-page';
import { getPoolAppData } from '@/data/providers';

interface ParticipantRouteProps {
  params: Promise<{ slug: string }>;
}

export default async function ParticipantRoute({ params }: ParticipantRouteProps) {
  const { slug } = await params;
  const appData = await getPoolAppData();
  const participant = appData.participants.find((item) => item.participantSlug === slug) ?? null;

  if (!participant) {
    notFound();
  }

  return <ParticipantPage appData={appData} participant={participant} />;
}
