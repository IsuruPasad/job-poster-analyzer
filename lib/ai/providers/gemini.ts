import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { AIError, brief, networkErrorCode, parseJsonReply, type AIProvider, type UpstreamErrorInfo } from "../types";

// Gemini's low-latency Flash-Lite tier: reads poster text from images quickly, and its
// thinking defaults to "minimal". No thinkingLevel is set here, so an AI_MODEL override
// (e.g. gemini-3.8-flash, which has no "minimal" level) still works.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const TIMEOUT_MS = 60_000;

// Finish reasons meaning a safety/policy filter stopped the reply.
const BLOCKED_FINISH_REASONS = new Set<FinishReason | undefined>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
]);

export function createGeminiProvider(model = DEFAULT_MODEL): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIError("config", "GEMINI_API_KEY is not set.");

  // 3 attempts total (the SDK default is 5), each capped at TIMEOUT_MS.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 3 } } });

  return {
    name: "gemini",
    model,
    async generateJson({ system, prompt, image, schema }) {
      let response;
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ inlineData: { mimeType: image.mediaType, data: image.base64 } }, { text: prompt }],
            },
          ],
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        });
      } catch (err) {
        throw toAIError(err, model);
      }

      const blockReason = response.promptFeedback?.blockReason;
      const finishReason = response.candidates?.[0]?.finishReason;
      const upstream: UpstreamErrorInfo = { reason: blockReason ?? finishReason, requestId: response.responseId };
      if (blockReason || BLOCKED_FINISH_REASONS.has(finishReason)) {
        throw new AIError("refused", `Gemini's safety filter declined this image (${upstream.reason}).`, { upstream });
      }
      if (finishReason === FinishReason.MAX_TOKENS) {
        throw new AIError("truncated", "Gemini's reply was cut off before it finished.", { upstream });
      }
      return parseJsonReply(response.text);
    },
  };
}

// Gemini error messages usually embed the JSON error body: {"error": {"code", "message", "status", "details": [{"reason"}]}}.
function upstreamInfo(err: ApiError): UpstreamErrorInfo {
  const info: UpstreamErrorInfo = { status: err.status, message: err.message };
  const jsonStart = err.message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(err.message.slice(jsonStart))?.error;
      if (body) {
        info.message = body.message ?? info.message;
        info.code = body.status;
        info.reason = (body.details as { reason?: string }[] | undefined)?.find((d) => d.reason)?.reason;
      }
    } catch {
      // not JSON — keep the raw message
    }
  }
  return info;
}

function toAIError(err: unknown, model: string): unknown {
  if (err instanceof ApiError) {
    const upstream = upstreamInfo(err);
    const options = { cause: err, upstream };
    // An invalid key comes back as a 400 whose reason/message names the API key.
    if (err.status === 401 || err.status === 403 || upstream.reason?.startsWith("API_KEY") || /api[ _]?key/i.test(upstream.message ?? "")) {
      return new AIError("auth", `Gemini rejected the API key (GEMINI_API_KEY): ${brief(upstream.message)}`, options);
    }
    if (err.status === 404) return new AIError("model_not_found", `Gemini model "${model}" isn't available for this API key.`, options);
    if (err.status === 429) return new AIError("rate_limit", "Gemini usage limit reached (rate limit or daily quota).", options);
    if (err.status === 408 || err.status === 504) return new AIError("timeout", `Gemini timed out (HTTP ${err.status}).`, options);
    if (err.status >= 500) return new AIError("unavailable", `Gemini is temporarily unavailable (HTTP ${err.status}).`, options);
    return new AIError("bad_request", `Gemini couldn't process the request (HTTP ${err.status}): ${brief(upstream.message)}`, options);
  }
  // The SDK aborts a request that exceeds TIMEOUT_MS.
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return new AIError("timeout", `Gemini didn't respond within ${TIMEOUT_MS / 1000} seconds.`, { cause: err });
  }
  // fetch() rejects with a TypeError when the network request itself fails.
  if (err instanceof TypeError) {
    const code = networkErrorCode(err);
    return new AIError("network", `Couldn't connect to Gemini${code ? ` (${code})` : ""}.`, {
      cause: err,
      upstream: { reason: code, message: err.message },
    });
  }
  return err;
}
