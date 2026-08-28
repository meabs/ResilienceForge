import type { Health } from './data';

export function classifyEffectiveHealth(input: {
  topologyHealth: Health;
  dropoutPercent: number;
  latencyMs: number;
  utilisation: number;
  stressActive: boolean;
}): Health {
  if (input.topologyHealth === 'failed') return 'failed';
  if (input.dropoutPercent >= 100) return 'unreachable';
  if (input.topologyHealth === 'degraded' || input.latencyMs > 0 || input.dropoutPercent > 0 || input.stressActive && input.utilisation > 0.9) {
    return 'degraded';
  }
  return 'healthy';
}

export function isOutage(health: Health) {
  return health === 'failed' || health === 'unreachable';
}

export function healthLabel(health: Health) {
  return health === 'healthy' ? 'OK'
    : health === 'degraded' ? 'WARN'
      : health === 'unreachable' ? 'UNREACH'
        : 'FAILED';
}
