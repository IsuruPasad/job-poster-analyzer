// Runs on the Job Poster Analyzer web app. The page can't call extension APIs, so it talks to this
// script through window.postMessage, and this script relays to background.js. The message names
// match lib/extension.ts in the web app.

const FROM_PAGE = "job-poster-analyzer";
const FROM_EXTENSION = "ikman-job-poster-extension";

window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data?.source !== FROM_PAGE) return;
  const { type, requestId } = event.data;
  const reply = (data) => window.postMessage({ source: FROM_EXTENSION, requestId, ...data }, window.location.origin);

  if (type === "ping") {
    reply({ type: "pong", version: chrome.runtime.getManifest().version });
  } else if (type === "post-job") {
    try {
      const result = await chrome.runtime.sendMessage({ type: "open-post-ad", handoff: event.data.handoff });
      reply({ type: "post-job-result", ok: !!result?.ok, error: result?.error });
    } catch (err) {
      // e.g. "Extension context invalidated" after the extension was updated: the page needs a reload.
      reply({ type: "post-job-result", ok: false, error: String(err) });
    }
  }
});
