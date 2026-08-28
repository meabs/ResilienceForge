export function availableReplicaCount<T extends string>(placements: T[], failedZones: T[]) {
  if (placements.length === 0) return 0;
  const failed = new Set(failedZones);
  return placements.filter((zone) => !failed.has(zone)).length;
}

export function replicaPlacements<T extends string>(input: {
  replicaCount: number;
  declaredZones: T[];
  regionZones: T[];
  failedZones?: T[];
  zoneAware?: boolean;
}): T[] {
  const replicaCount = Math.max(0, Math.round(input.replicaCount));
  const declared = input.declaredZones;
  if (replicaCount === 0 || declared.length === 0) return [];

  if (input.zoneAware) {
    const unique = Array.from(new Set(declared));
    const failed = new Set(input.failedZones ?? []);
    const healthy = unique.filter((zone) => !failed.has(zone));
    const pool = healthy.length > 0 ? healthy : unique;
    return Array.from({ length: replicaCount }, (_, index) => pool[index % pool.length]);
  }

  if (replicaCount <= declared.length) return declared.slice(0, replicaCount);
  const spread = input.regionZones.length > 0 ? input.regionZones : declared;
  return Array.from({ length: replicaCount }, (_, index) => declared[index] ?? spread[index % spread.length]);
}

export function replicaHealth(provisioned: number, available: number, servingTarget = provisioned) {
  if (available <= 0) return 'failed' as const;
  if (available < servingTarget) return 'degraded' as const;
  return 'healthy' as const;
}
