// Provider-neutral contract for the AI model behind poster extraction. App code imports
// only from "@/lib/ai" — never from a provider SDK directly — so the model can be swapped
// by changing AI_PROVIDER / AI_MODEL in .env.local.

/** Image formats every provider accepts. */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export interface VisionJsonRequest {
  /** Static instructions. Keep per-request values out, so providers that cache prompts can reuse it. */
  system: string;
  /** Per-request text sent alongside the image. */
  prompt: string;
  image: { mediaType: ImageMediaType; base64: string };
  /** JSON Schema the reply must match; each provider enforces it with its own structured-output mode. */
  schema: Record<string, unknown>;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Resolves to the parsed JSON reply. Provider failures are thrown as AIError. */
  generateJson(request: VisionJsonRequest): Promise<unknown>;
}

export type AIErrorKind =
  | "config" // provider not selected / API key not set
  | "auth" // API key rejected
  | "model_not_found"
  | "rate_limit"
  | "unavailable" // provider overloaded or down
  | "bad_request" // e.g. the image couldn't be processed
  | "refused" // safety filter declined
  | "truncated" // ran out of output tokens
  | "invalid_output" // reply wasn't the expected JSON
  | "network" // couldn't connect to the provider
  | "timeout"; // provider didn't answer in time

/** What the provider itself reported, for logs/diagnostics — never contains the API key. */
export interface UpstreamErrorInfo {
  status?: number; // provider HTTP status
  code?: string; // provider error status/type, e.g. "INVALID_ARGUMENT", "authentication_error"
  reason?: string; // finer-grained reason, e.g. "API_KEY_INVALID", or a network error code like "ENOTFOUND"
  message?: string; // provider's own error message
  requestId?: string;
}

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly upstream?: UpstreamErrorInfo;

  /** `message` should be a full sentence naming the provider — the route shows it to the user. */
  constructor(kind: AIErrorKind, message: string, options?: { cause?: unknown; upstream?: UpstreamErrorInfo }) {
    super(message, { cause: options?.cause });
    this.name = "AIError";
    this.kind = kind;
    this.upstream = options?.upstream;
  }
}

/** Network error code (ENOTFOUND, ECONNREFUSED, …) from a failed fetch, if Node attached one. */
export function networkErrorCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

/** Shortens a provider message for the user-facing text (the full text goes to the logs). */
export function brief(message: string | undefined, max = 200): string {
  const text = (message ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Shared by providers whose structured output arrives as a JSON string. */
export function parseJsonReply(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch (err) {
    throw new AIError("invalid_output", "The model's reply wasn't valid JSON.", { cause: err });
  }
}
