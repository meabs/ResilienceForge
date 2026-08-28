import type { PinId } from './data.ts';

export interface PinRejection {
  ok: false;
  code: string;
  message: string;
}

export function isUnorderedPubSubAttempt(args: Record<string, unknown>): boolean {
  if (args.unordered === true || args.ordered === false) return true;
  if (typeof args.mode === 'string' && args.mode.toLowerCase() === 'unordered') return true;
  if (args.orderingKeyShards !== undefined && Number(args.orderingKeyShards) < 1) return true;
  return false;
}

export function pinRejection(pins: PinId[], op: string, args: Record<string, unknown>): PinRejection | null {
  if (op === 'set_ordering_key_parallelism' && pins.includes('keep_pubsub_ordering') && isUnorderedPubSubAttempt(args)) {
    return {
      ok: false,
      code: 'PINNED_KEEP_PUBSUB_ORDERING',
      message: 'Unordered replacement is blocked while keep_pubsub_ordering is pinned. Spread ordering keys or batch instead.',
    };
  }
  if (op === 'set_region_traffic_split' && pins.includes('no_second_region') && Number(args.primaryPercent) < 100) {
    return { ok: false, code: 'PINNED_NO_SECOND_REGION', message: 'Secondary region is excluded by a pinned human constraint.' };
  }
  if (op === 'fail_region' && pins.includes('no_second_region') && args.region === 'us-east4') {
    return { ok: false, code: 'PINNED_NO_SECOND_REGION', message: 'Secondary region is already excluded by a pinned human constraint.' };
  }
  if (op === 'set_model_traffic_split' && pins.includes('keep_old_model') && Number(args.newModelPercent) >= 100) {
    return { ok: false, code: 'PINNED_KEEP_OLD_MODEL', message: 'The old model must retain non-zero traffic.' };
  }
  return null;
}
