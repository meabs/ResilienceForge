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
}

export function resolveWebMcpRuntime() {
  if (typeof document === 'undefined') return null;
  return document.modelContext ?? null;
}

export async function registerWebMcpTools(
  tools: ToolRegistration[],
  signal: AbortSignal,
) {
  if (!resolveWebMcpRuntime() || !document.modelContext) return { supported: false, count: 0 };
  for (const tool of tools) {
    await document.modelContext.registerTool(tool, { signal });
  }
  return { supported: true, count: tools.length };
}
