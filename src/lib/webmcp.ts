export type WebMcpAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpExecuteOptions = {
  signal: AbortSignal;
};

export type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (
    input: Record<string, unknown>,
    options: WebMcpExecuteOptions,
  ) => unknown;
};

type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }
}

export type WebMcpRegistration = {
  supported: boolean;
  registered: number;
  unregister: () => void;
};

export const registerWebMcpTools = async (
  tools: WebMcpTool[],
): Promise<WebMcpRegistration> => {
  const modelContext = document.modelContext;
  if (typeof modelContext?.registerTool !== "function") {
    return {
      supported: false,
      registered: 0,
      unregister: () => undefined,
    };
  }

  const controller = new AbortController();

  try {
    for (const tool of tools) {
      await document.modelContext!.registerTool(tool, {
        signal: controller.signal,
      });
    }
  } catch (error) {
    controller.abort();
    throw error;
  }

  return {
    supported: true,
    registered: tools.length,
    unregister: () => controller.abort(),
  };
};

export const emptyObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;
