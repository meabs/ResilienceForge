export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool: (tool: ToolRegistration, options?: { signal?: AbortSignal }) => void | Promise<void>;
}

export function resolveWebMcpRuntime() {
  if (typeof document === 'undefined') return null;
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  return modelContext ?? null;
}

export async function registerWebMcpTools(
  tools: ToolRegistration[],
  signal: AbortSignal,
) {
  const runtime = resolveWebMcpRuntime();
  if (!runtime) return { supported: false, count: 0 };
  for (const tool of tools) {
    await runtime.registerTool(tool, { signal });
  }
  return { supported: true, count: tools.length };
}
