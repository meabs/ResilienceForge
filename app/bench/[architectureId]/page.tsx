import ResilienceForge from '../../resilience-forge';

export default async function Bench({
  params,
}: {
  params: Promise<{ architectureId: string }>;
}) {
  const { architectureId } = await params;
  return <ResilienceForge view="bench" architectureId={architectureId} />;
}
