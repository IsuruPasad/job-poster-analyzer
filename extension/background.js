// Opens ikman.lk's post-ad form for a job the web app handed over (via app-bridge.js), and gives
// that tab's content script (ikman-fill.js) the job to fill in. Jobs are kept per tab in session
// storage, which outlives this service worker going to sleep (but not a browser restart).

const jobKey = (tabId) => `job:${tabId}`;

async function openPostAd(handoff) {
  // Open blank first and store the job before loading ikman.lk, so the page can't ask too early.
  const tab = await chrome.tabs.create({ url: "about:blank" });
  await chrome.storage.session.set({ [jobKey(tab.id)]: { handoff, redirects: 0 } });
  await chrome.tabs.update(tab.id, { url: handoff.url });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "open-post-ad") {
    openPostAd(message.handoff).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true; // answers asynchronously
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  const key = jobKey(tabId);
  if (message?.type === "get-job") {
    chrome.storage.session.get(key).then((items) => sendResponse(items[key] ?? null));
    return true;
  }
  if (message?.type === "save-job") chrome.storage.session.set({ [key]: message.job });
  if (message?.type === "job-filled") chrome.storage.session.remove(key);
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(jobKey(tabId)));
