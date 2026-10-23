// Talks to the ikman Job Poster browser extension (extension/) from the job form. A page can't
// call extension APIs, so messages go through window.postMessage to the extension's content
// script on this site (extension/app-bridge.js), which relays them. Browser-only.
import type { PostAdHandoff } from "@/types/job";

// Must match extension/app-bridge.js.
const FROM_PAGE = "job-poster-analyzer";
const FROM_EXTENSION = "ikman-job-poster-extension";

/** Sends one message and resolves with the extension's reply, or null if none came within timeoutMs. */
function request<T>(type: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const finish = (reply: T | null) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(reply);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source === window && event.data?.source === FROM_EXTENSION && event.data.requestId === requestId) finish(event.data as T);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: FROM_PAGE, type, requestId, ...payload }, window.location.origin);
  });
}

/** The installed extension's version, or null when it doesn't answer (not installed, disabled, or not allowed on this site). */
export async function pingExtension(): Promise<string | null> {
  const reply = await request<{ version: string }>("ping", {}, 1000);
  return reply?.version ?? null;
}

/** Asks the extension to open ikman.lk's post-ad form in a new tab and fill it in. null when it didn't answer. */
export function handOffToExtension(handoff: PostAdHandoff): Promise<{ ok: boolean; error?: string } | null> {
  return request("post-job", { handoff }, 10_000);
}
