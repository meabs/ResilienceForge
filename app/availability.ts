export function availableReplicaCount<T extends string>(placements: T[], failedZones: T[]) {
  if (placements.length === 0) return 0;
  const failed = new Set(failedZones);
  return placements.filter((zone) => !failed.has(zone)).length;
}

export function replicaHealth(provisioned: number, available: number) {
  if (available <= 0) return 'down' as const;
  if (available < provisioned) return 'degraded' as const;
  return 'healthy' as const;
}
