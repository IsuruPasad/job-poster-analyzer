import Anthropic from "@anthropic-ai/sdk";
import { AIError, brief, networkErrorCode, parseJsonReply, type AIProvider, type UpstreamErrorInfo } from "../types";

const DEFAULT_MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 120_000;
// Thinking is always on for Opus 5.5; effort is the latency/quality lever. Raise to
// "medium" if extraction quality drops on hard posters.
const EFFORT = "low";
// Models that accept server-side refusal fallback (`fallbacks: "default"`); other models
// sent through AI_MODEL go without it.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export function createClaudeProvider(model = DEFAULT_MODEL): AIProvider {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AIError("config", "ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic({ timeout: TIMEOUT_MS });

  return {
    name: "claude",
    model,
    async generateJson({ system, prompt, image, schema }) {
      let response;
      try {
        response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          // On a safety-classifier refusal, re-run on Anthropic's recommended fallback model.
          ...(FALLBACK_MODELS.has(model)
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
          output_config: { effort: EFFORT, format: { type: "json_schema", schema } },
          // The system prompt is static, so it's served from the prompt cache across requests.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
      } catch (err) {
        throw toAIError(err, model);
      }

      const upstream: UpstreamErrorInfo = { requestId: response.id };
      if (response.stop_reason === "refusal") {
        upstream.reason = response.stop_details?.category ?? undefined;
        throw new AIError("refused", `Claude's safety filter declined this image${upstream.reason ? ` (${upstream.reason})` : ""}.`, { upstream });
      }
      if (response.stop_reason === "max_tokens") {
        throw new AIError("truncated", "Claude's reply was cut off before it finished.", { upstream });
      }
      return parseJsonReply(response.content.find((block) => block.type === "text")?.text);
    },
  };
}

function upstreamInfo(err: InstanceType<typeof Anthropic.APIError>): UpstreamErrorInfo {
  const body = err.error as { error?: { message?: string } } | undefined;
  return {
    status: err.status,
    code: err.type ?? undefined,
    message: body?.error?.message ?? err.message,
    requestId: err.requestID ?? undefined,
  };
}

// Most specific first — APIConnectionTimeoutError < APIConnectionError < APIError.
function toAIError(err: unknown, model: string): unknown {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIError("timeout", `Claude didn't respond within ${TIMEOUT_MS / 1000} seconds.`, { cause: err });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    const code = networkErrorCode(err);
    return new AIError("network", `Couldn't connect to Claude${code ? ` (${code})` : ""}.`, {
      cause: err,
      upstream: { reason: code, message: err.message },
    });
  }
  if (!(err instanceof Anthropic.APIError)) return err;

  const upstream = upstreamInfo(err);
  const options = { cause: err, upstream };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AIError("auth", `Anthropic rejected the API key (ANTHROPIC_API_KEY): ${brief(upstream.message)}`, options);
  }
  if (err instanceof Anthropic.NotFoundError) return new AIError("model_not_found", `Claude model "${model}" isn't available for this API key.`, options);
  if (err instanceof Anthropic.RateLimitError) return new AIError("rate_limit", "Claude usage limit reached (rate limit).", options);
  if ((err.status ?? 0) >= 500) {
    // Includes 529 overloaded — the SDK has already retried these.
    return new AIError("unavailable", `Claude is temporarily unavailable (HTTP ${err.status}).`, options);
  }
  // 400s also cover account problems such as "credit balance is too low" — the provider message says which.
  return new AIError("bad_request", `Claude couldn't process the request (HTTP ${err.status}): ${brief(upstream.message)}`, options);
}
