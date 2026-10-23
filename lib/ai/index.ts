import { AIError, type AIProvider } from "./types";

export * from "./types";

// To add a provider: implement AIProvider in lib/ai/providers/<name>.ts and register it here.
// Providers are imported lazily, so only the selected provider's SDK is ever loaded.
const PROVIDERS: Record<string, (model?: string) => Promise<AIProvider>> = {
  gemini: async (model) => (await import("./providers/gemini")).createGeminiProvider(model),
  claude: async (model) => (await import("./providers/claude")).createClaudeProvider(model),
};

let cached: { key: string; provider: AIProvider } | null = null;

/** The provider selected by AI_PROVIDER, using AI_MODEL if set, else the provider's default model. */
export async function getAIProvider(): Promise<AIProvider> {
  const name = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const model = process.env.AI_MODEL?.trim() || undefined;

  const create = PROVIDERS[name];
  if (!create) {
    const expected = `expected one of: ${Object.keys(PROVIDERS).join(", ")}`;
    throw new AIError("config", name ? `Unknown AI_PROVIDER "${name}" (${expected}).` : `AI_PROVIDER is not set (${expected}).`);
  }

  const key = `${name}|${model ?? ""}`;
  if (cached?.key !== key) cached = { key, provider: await create(model) };
  return cached.provider;
}
