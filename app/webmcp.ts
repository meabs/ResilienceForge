export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool: (tool: ToolRegistration, options?: { signal?: AbortSignal }) => void | Promise<void>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Window {
    resilienceForge?: Record<string, unknown>;
  }
}

export interface WebMcpStatus {
  capability: 'supported' | 'unsupported';
  ready: boolean;
  toolsReady: boolean;
  expectedToolCount: number;
  registeredToolCount: number;
  sessionId: string;
  architectureId: string | null;
  toolNames: string[];
}

type LiveHandlers = {
  getState: () => unknown;
  invoke: (op: string, args: Record<string, unknown>, expectedVersion?: number) => unknown;
  read: (op: string, args: Record<string, unknown>, payload: Record<string, unknown>) => unknown;
};

const RELEASE_GRACE_MS = 750;

export const liveBench: LiveHandlers = {
  getState: () => null,
  invoke: () => ({ ok: false, code: 'WEBMCP_NOT_BOUND' }),
  read: () => ({ ok: false, code: 'WEBMCP_NOT_BOUND' }),
};

const session: WebMcpStatus & {
  controller: AbortController | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
  pending: Promise<{ supported: boolean; count: number; reused: boolean }> | null;
} = {
  capability: 'unsupported',
  ready: false,
  toolsReady: false,
  expectedToolCount: 0,
  registeredToolCount: 0,
  sessionId: '',
  architectureId: null,
  toolNames: [],
  controller: null,
  releaseTimer: null,
  pending: null,
};

export function resolveWebMcpRuntime() {
  if (typeof document === 'undefined') return null;
  return document.modelContext ?? null;
}

export function bindLiveBench(handlers: LiveHandlers) {
  liveBench.getState = handlers.getState;
  liveBench.invoke = handlers.invoke;
  liveBench.read = handlers.read;
}

export function getWebMcpStatus(): WebMcpStatus {
  return {
    capability: session.capability,
    ready: session.ready,
    toolsReady: session.ready,
    expectedToolCount: session.expectedToolCount,
    registeredToolCount: session.registeredToolCount,
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
  root.dataset.webmcpToolCount = String(status.registeredToolCount);
  root.dataset.webmcpExpectedCount = String(status.expectedToolCount);
  if (status.sessionId) root.dataset.webmcpSession = status.sessionId;
  if (status.architectureId) root.dataset.webmcpArchitecture = status.architectureId;
  const banner = document.getElementById('webmcp-capability');
  if (banner) {
    banner.textContent = status.capability === 'unsupported'
      ? 'WebMCP capability: unsupported in this browser.'
      : status.ready
        ? `WebMCP capability: supported. Tools ready ${status.registeredToolCount}/${status.expectedToolCount}. Session ${status.sessionId}.`
        : `WebMCP capability: supported. Tools registering ${status.registeredToolCount}/${status.expectedToolCount}. Do not invoke the full set until ready.`;
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

async function registerAtomically(tools: ToolRegistration[], signal: AbortSignal) {
  if (!document.modelContext) return { supported: false as const, count: 0 };
  session.ready = false;
  session.toolsReady = false;
  session.registeredToolCount = 0;
  session.expectedToolCount = tools.length;
  session.toolNames = tools.map((tool) => tool.name);
  publishCapability();
  const registrations = tools.map((tool) => Promise.resolve(document.modelContext!.registerTool(tool, { signal })));
  await Promise.all(registrations);
  if (signal.aborted) return { supported: true as const, count: 0, aborted: true as const };
  session.registeredToolCount = tools.length;
  session.ready = true;
  session.toolsReady = true;
  publishCapability();
  return { supported: true as const, count: tools.length, aborted: false as const };
}

export async function ensureWebMcpRegistration(
  architectureId: string,
  tools: ToolRegistration[],
) {
  if (session.releaseTimer) {
    clearTimeout(session.releaseTimer);
    session.releaseTimer = null;
  }
  const runtime = resolveWebMcpRuntime();
  session.capability = runtime ? 'supported' : 'unsupported';
  if (!runtime || !document.modelContext) {
    session.ready = false;
    session.toolsReady = false;
    session.architectureId = architectureId;
    session.expectedToolCount = tools.length;
    session.registeredToolCount = 0;
    publishCapability();
    return { supported: false, count: 0, reused: false };
  }
  if (session.architectureId === architectureId && session.ready && session.controller && !session.controller.signal.aborted) {
    publishCapability();
    return { supported: true, count: session.registeredToolCount, reused: true };
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
    return { supported: result.supported, count: result.count ?? 0, reused: false };
  });
  return session.pending;
}

export function scheduleWebMcpRelease(architectureId: string) {
  if (session.releaseTimer) clearTimeout(session.releaseTimer);
  session.releaseTimer = setTimeout(() => {
    if (session.architectureId !== architectureId) return;
    session.controller?.abort();
    session.controller = null;
    session.ready = false;
    session.toolsReady = false;
    session.registeredToolCount = 0;
    session.architectureId = null;
    publishCapability();
  }, RELEASE_GRACE_MS);
}
