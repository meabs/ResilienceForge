export const FDR_VISIBLE_LIMIT = 30;

export interface FdrLine {
  ts: string;
  source: string;
  op: string;
  args: unknown;
  beforeVersion: number;
  afterVersion: number;
  resultCode: string;
}

export function isSimTick(entry: { source: string; op: string }): boolean {
  return entry.source === 'sim' && entry.op === 'tick';
}

export function visibleFdrEntries<T extends { source: string; op: string }>(entries: T[], limit = FDR_VISIBLE_LIMIT): T[] {
  return entries.filter((entry) => !isSimTick(entry)).slice(-limit);
}

export function formatFdrLine(entry: FdrLine): string {
  const args = JSON.stringify(entry.args ?? {});
  return `${entry.ts} ${entry.source} ${entry.op} ${args} v${entry.beforeVersion}>${entry.afterVersion} ${entry.resultCode}`;
}

export function formatFdrCopy(entries: FdrLine[]): string {
  return entries.map(formatFdrLine).join('\n');
}

export function isRejectedCode(code: string): boolean {
  return code === 'STALE_STATE' || code.startsWith('PINNED_');
}
