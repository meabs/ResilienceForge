export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  untrustedContentHint?: boolean;
}

export type ToolExecute = (
  input: Record<string, unknown>,
  extras?: { signal?: AbortSignal },
) => Promise<unknown> | unknown;

export interface ToolRegistration {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: ToolExecute;
}

interface ModelContext {
  registerTool: (tool: ToolRegistration, options?: { signal?: AbortSignal }) => void | Promise<void>;
  registerTools?: (tools: ToolRegistration[], options?: { signal?: AbortSignal }) => void | Promise<void>;
  getTools?: () => Promise<Array<{ name?: string }>>;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean) => void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Window {
    resilienceForge?: {
      invoke?: (op: string, args: Record<string, unknown>, expectedVersion?: number) => unknown;
      getState?: () => unknown;
      webmcp?: WebMcpStatus;
    };
  }
}

export interface WebMcpStatus {
  capability: 'supported' | 'unsupported';
  ready: boolean;
  toolsReady: boolean;
  expectedToolCount: number;
  registeredToolCount: number;
  discoveredToolCount: number;
  sessionId: string;
  architectureId: string | null;
  toolNames: string[];
}

type LiveHandlers = {
  getState: () => unknown;
  invoke: (op: string, args: Record<string, unknown>, expectedVersion?: number) => unknown;
  read: (op: string, args: Record<string, unknown>, payload: Record<string, unknown>) => unknown;
};

export const liveBench: LiveHandlers = {
  getState: () => null,
  invoke: () => ({ ok: false, code: 'WEBMCP_NOT_BOUND' }),
  read: () => ({ ok: false, code: 'WEBMCP_NOT_BOUND' }),
};

const session: WebMcpStatus & {
  controller: AbortController | null;
  pending: Promise<{ supported: boolean; count: number; reused: boolean; ready: boolean }> | null;
} = {
  capability: 'unsupported',
  ready: false,
  toolsReady: false,
  expectedToolCount: 0,
  registeredToolCount: 0,
  discoveredToolCount: 0,
  sessionId: '',
  architectureId: null,
  toolNames: [],
  controller: null,
  pending: null,
};

export function wrapToolExecute(execute: ToolExecute): ToolExecute {
  return (input, extras) => {
    if (extras?.signal?.aborted) {
      const version = (liveBench.getState() as { version?: number } | null)?.version ?? 0;
      return { ok: false, code: 'ABORTED', currentVersion: version, message: 'Tool execution was cancelled before it ran.' };
    }
    return execute(input, extras);
  };
}

export function resolveWebMcpRuntime() {
  if (typeof document === 'undefined') return null;
  return document.modelContext ?? null;
}

export function bindLiveBench(handlers: LiveHandlers) {
  liveBench.getState = handlers.getState;
  liveBench.invoke = handlers.invoke;
  liveBench.read = handlers.read;
}

export function unbindLiveBench() {
  liveBench.getState = () => null;
  liveBench.invoke = () => ({ ok: false, code: 'NO_BENCH_LOADED', message: 'No reference is loaded. Call load_architecture first.' });
  liveBench.read = () => ({ ok: false, code: 'NO_BENCH_LOADED', message: 'No reference is loaded. Call load_architecture first.' });
}

export function getWebMcpStatus(): WebMcpStatus {
  return {
    capability: session.capability,
    ready: session.ready,
    toolsReady: session.ready,
    expectedToolCount: session.expectedToolCount,
    registeredToolCount: session.registeredToolCount,
    discoveredToolCount: session.discoveredToolCount,
    sessionId: session.sessionId,
    architectureId: session.architectureId,
    toolNames: [...session.toolNames],
  };
}

export function publishCapability() {
  if (typeof document === 'undefined') return getWebMcpStatus();
  const status = getWebMcpStatus();
  const root = document.documentElement;
  root.dataset.webmcpCapability = status.capability;
  root.dataset.webmcpReady = status.ready ? 'true' : 'false';
  root.dataset.webmcpToolCount = String(status.discoveredToolCount || status.registeredToolCount);
  root.dataset.webmcpExpectedCount = String(status.expectedToolCount);
  if (status.sessionId) root.dataset.webmcpSession = status.sessionId;
  if (status.architectureId) root.dataset.webmcpArchitecture = status.architectureId;
  const banner = document.getElementById('webmcp-capability');
  if (banner) {
    banner.textContent = status.capability === 'unsupported'
      ? 'WebMCP capability: unsupported in this browser.'
      : status.ready
        ? `WebMCP capability: supported. Tools ready ${status.discoveredToolCount}/${status.expectedToolCount}. Session ${status.sessionId}.`
        : `WebMCP capability: supported. Tools registering ${status.discoveredToolCount}/${status.expectedToolCount}. Do not invoke the full set until ready.`;
  }
  if (typeof window !== 'undefined') {
    window.resilienceForge = {
      ...(window.resilienceForge ?? {}),
      webmcp: status,
      invoke: liveBench.invoke,
      getState: liveBench.getState,
    };
  }
  document.dispatchEvent(new CustomEvent('webmcp-status', { detail: status }));
  if (status.ready) document.dispatchEvent(new CustomEvent('webmcp-tools-ready', { detail: status }));
  return status;
}

export function detectCapability() {
  session.capability = resolveWebMcpRuntime() ? 'supported' : 'unsupported';
  if (!session.sessionId && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    session.sessionId = crypto.randomUUID().slice(0, 8);
  }
  publishCapability();
  return getWebMcpStatus();
}

export function watchModelContext(onReady: () => void) {
  if (typeof document === 'undefined') return () => undefined;
  if (document.modelContext) {
    onReady();
    return () => undefined;
  }
  const timer = window.setInterval(() => {
    if (!document.modelContext) return;
    window.clearInterval(timer);
    onReady();
  }, 16);
  return () => window.clearInterval(timer);
}

export async function waitUntilCatalogMatches(
  expectedNames: string[],
  getTools: () => Promise<Array<{ name?: string }>>,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    pollMs?: number;
    subscribe?: (onChange: () => void) => () => void;
  } = {},
): Promise<{ matched: boolean; names: string[] }> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const pollMs = options.pollMs ?? 32;
  const started = Date.now();
  const readNames = async () => {
    try {
      const listed = await getTools();
      return listed.map((tool) => tool.name).filter((name): name is string => Boolean(name));
    } catch {
      return [] as string[];
    }
  };
  const matches = (names: string[]) => expectedNames.length > 0 && expectedNames.every((name) => names.includes(name));

  let names = await readNames();
  if (matches(names) || options.signal?.aborted) return { matched: matches(names), names };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (matched: boolean, nextNames: string[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ matched, names: nextNames });
    };
    const tick = async () => {
      if (options.signal?.aborted) {
        finish(false, names);
        return;
      }
      names = await readNames();
      if (matches(names) || Date.now() - started >= timeoutMs) finish(matches(names), names);
    };
    const unsubscribe = options.subscribe?.(() => { void tick(); }) ?? (() => undefined);
    const poll = setInterval(() => { void tick(); }, pollMs);
    const timeout = setTimeout(() => { void tick(); }, timeoutMs);
    const onAbort = () => finish(false, names);
    options.signal?.addEventListener('abort', onAbort);
    const cleanup = () => {
      unsubscribe();
      clearInterval(poll);
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
    };
  });
}

export function registrationReady(hasDiscovery: boolean, catalogMatched: boolean) {
  return !hasDiscovery || catalogMatched;
}

function subscribeToolChange(onChange: () => void) {
  const runtime = document.modelContext;
  if (!runtime?.addEventListener) return () => undefined;
  runtime.addEventListener('toolchange', onChange);
  return () => runtime.removeEventListener?.('toolchange', onChange);
}

async function publishTools(tools: ToolRegistration[], signal: AbortSignal) {
  const runtime = document.modelContext;
  if (!runtime) return;
  const work = typeof runtime.registerTools === 'function'
    ? Promise.resolve(runtime.registerTools(tools, { signal }))
    : Promise.all(tools.map((tool) => Promise.resolve(runtime.registerTool(tool, { signal }))));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('WEBMCP_REGISTER_TIMEOUT')), 2500);
    signal.addEventListener('abort', () => {
      if (timer) clearTimeout(timer);
      reject(new Error('WEBMCP_REGISTER_ABORTED'));
    }, { once: true });
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function registerAtomically(tools: ToolRegistration[], signal: AbortSignal) {
  if (!document.modelContext) return { supported: false as const, count: 0, ready: false as const };
  const names = tools.map((tool) => tool.name);
  session.ready = false;
  session.toolsReady = false;
  session.registeredToolCount = 0;
  session.discoveredToolCount = 0;
  session.expectedToolCount = tools.length;
  session.toolNames = names;
  publishCapability();
  await publishTools(tools, signal);
  if (signal.aborted) return { supported: true as const, count: 0, ready: false as const, aborted: true as const };
  session.registeredToolCount = tools.length;
  const runtime = document.modelContext;
  const hasDiscovery = typeof runtime?.getTools === 'function';
  const catalog = hasDiscovery
    ? await waitUntilCatalogMatches(names, () => runtime.getTools!(), { signal, subscribe: subscribeToolChange })
    : { matched: true, names };
  if (signal.aborted) return { supported: true as const, count: 0, ready: false as const, aborted: true as const };
  session.discoveredToolCount = catalog.matched ? tools.length : catalog.names.length;
  const ready = registrationReady(hasDiscovery, catalog.matched);
  session.ready = ready;
  session.toolsReady = ready;
  publishCapability();
  return { supported: true as const, count: session.discoveredToolCount, ready, aborted: false as const, discovered: catalog.matched };
}

export async function ensureWebMcpRegistration(
  architectureId: string,
  tools: ToolRegistration[],
) {
  const runtime = resolveWebMcpRuntime();
  session.capability = runtime ? 'supported' : 'unsupported';
  if (!runtime || !document.modelContext) {
    session.ready = false;
    session.toolsReady = false;
    session.architectureId = architectureId;
    session.expectedToolCount = tools.length;
    session.registeredToolCount = 0;
    session.discoveredToolCount = 0;
    publishCapability();
    return { supported: false, count: 0, reused: false, ready: false };
  }
  if (session.architectureId === architectureId && session.ready && session.controller && !session.controller.signal.aborted) {
    publishCapability();
    return { supported: true, count: session.registeredToolCount, reused: true, ready: true };
  }
  if (session.architectureId === architectureId && session.pending && session.controller && !session.controller.signal.aborted) {
    publishCapability();
    return session.pending;
  }
  session.controller?.abort();
  const controller = new AbortController();
  session.controller = controller;
  session.architectureId = architectureId;
  session.sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : `${Date.now()}`;
  session.pending = registerAtomically(tools, controller.signal).then((result) => {
    if (session.controller === controller) session.pending = null;
    return { supported: result.supported, count: result.count ?? 0, reused: false, ready: result.ready };
  }).catch(() => {
    if (session.controller === controller) session.pending = null;
    return { supported: false, count: 0, reused: false, ready: false };
  });
  return session.pending;
}

export function releaseWebMcpRegistration() {
  session.controller?.abort();
  session.controller = null;
  session.pending = null;
  session.ready = false;
  session.toolsReady = false;
  session.registeredToolCount = 0;
  session.discoveredToolCount = 0;
  session.architectureId = null;
  session.toolNames = [];
  publishCapability();
}
