// Runs on ikman.lk. In a tab background.js opened for a job, it waits for the post-ad form
// (after a login if needed), fills it in, and shows what's left for the user, who checks the
// ad and clicks "Post ad" themselves. Other ikman.lk tabs are left alone.
//
// Selectors come from ikman.lk's job post-ad form (Oct 2026): text fields by their `name`, and
// Downshift dropdowns by their "open menu" toggle button, whose `name` is the form field's key.

const DETAILS_PATH = "/post-ad/details";
const WATCH_MS = 15 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// ikman.lk's labels vary in case and spacing ("Hot / Cold Kitchen Chef", double spaces).
const textKey = (text) => (text ?? "").toLowerCase().replace(/\s+/g, "");

async function waitFor(find, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found || Date.now() > end) return found;
    await sleep(100);
  }
}

/**
 * Types a value into one of the form's inputs the way its (Preact) handlers expect: focus, the
 * native value setter plus an input event (→ onChange), then blur. The blur waits for Preact's
 * re-render, since the form's blur handler re-saves the value it last rendered — blurring at once
 * put the old, empty value back.
 */
async function setValue(input, value) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  input.focus();
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(100);
  input.blur();
}

/** true if filled, false if the field is missing. */
async function fillText(selector, value) {
  const input = document.querySelector(selector);
  if (!input) return false;
  await setValue(input, value);
  return true;
}

/** Picks an option in a Downshift dropdown. null when the form has no such dropdown (e.g. no Role for this category). */
async function choose(fieldKey, value) {
  const toggle = document.querySelector(`button[aria-label="open menu"][name="${fieldKey}"]`);
  if (!toggle) return null;
  const menu = toggle.closest('[role="combobox"]')?.querySelector('[role="listbox"]');
  if (!menu) return false;
  toggle.click();
  const option = await waitFor(() => [...menu.querySelectorAll('[role="option"]')].find((o) => textKey(o.textContent) === textKey(value)), 3000);
  if (!option) {
    if (menu.querySelector('[role="option"]')) toggle.click(); // close the menu again
    return false;
  }
  option.click();
  await sleep(150);
  return true;
}

/** Ticks "Phone (up to 3)" under "How do you want to receive applications?" and types the number. */
async function choosePhone(phone) {
  const label = [...document.querySelectorAll("label[for]")].find((l) => textKey(l.textContent).startsWith(textKey("Phone (up to 3)")));
  const checkbox = label && document.getElementById(label.htmlFor);
  if (!checkbox) return false;
  if (!checkbox.checked) label.click();
  // The number input stays disabled until the option is ticked.
  const input = await waitFor(() => {
    const field = document.querySelector('input[placeholder="Enter phone number"]');
    return field && !field.disabled && !field.closest('[aria-disabled="true"]') ? field : null;
  }, 3000);
  if (!input) return false;
  await setValue(input, phone);
  return true;
}

/**
 * Fills the post-ad form from the web app's hand-off fields (PostAdHandoff["fields"]). Returns
 * what it couldn't fill, as "<field>: <value>" lines for the banner. Blank values are skipped.
 */
async function fillPostAdForm(fields) {
  const steps = [
    ["Role", fields.role, () => choose("item_type", fields.role)],
    ["Title", fields.title, () => fillText('input[name="title"]', fields.title)],
    ["Description", fields.description, () => fillText('textarea[name="description"]', fields.description)],
    ["Job type", fields.jobType, () => choose("employment", fields.jobType)],
    ["Phone for applications", fields.phone, () => choosePhone(fields.phone)],
    ["Required work experience", fields.experience, () => fillText('input[name="experience"]', fields.experience)],
    ["Required education", fields.education, () => choose("min_qualification", fields.education)],
    ["Salary from", fields.salaryFrom, () => fillText('input[name="From"]', fields.salaryFrom)],
    ["Salary to", fields.salaryTo, () => fillText('input[name="To"]', fields.salaryTo)],
    ["Employer", fields.employer, () => fillText('input[name="company_name"]', fields.employer)],
    ["Employer website", fields.website, () => fillText('input[name="company_website"]', fields.website)],
  ];
  const missed = [];
  for (const [label, value, fill] of steps) {
    if (!value) continue;
    try {
      if ((await fill()) === false) missed.push(`${label}: ${value}`);
    } catch (err) {
      console.warn(`[ikman Job Poster] couldn't fill ${label}:`, err);
      missed.push(`${label}: ${value}`);
    }
  }
  return missed;
}

function showBanner(missed, deadline) {
  const banner = document.createElement("div");
  banner.setAttribute("role", "status");
  banner.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:2147483647;max-width:360px;padding:12px 36px 12px 14px;" +
    "background:#fff;border-left:4px solid #149777;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);" +
    "font:13px/1.45 system-ui,sans-serif;color:#2b2b2b";
  const add = (tag, text, css = "") => {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.cssText = css;
    banner.append(el);
    return el;
  };
  add("strong", "Filled in by ikman Job Poster", "display:block;margin-bottom:4px");
  add("div", "Check every field, then click Post ad.");
  if (deadline) {
    const [y, m, d] = deadline.split("-");
    add("div", `Pick the application deadline yourself: ${d}-${m}-${y}.`, "margin-top:6px");
  }
  if (missed.length) {
    add("div", "Couldn't fill these, please set them yourself:", "margin-top:6px;font-weight:600;color:#b4352d");
    for (const line of missed) add("div", `• ${line}`);
  }
  const close = add("button", "×", "position:absolute;top:6px;right:8px;border:0;background:none;font-size:18px;cursor:pointer;color:#707676");
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", () => banner.remove());
  document.body.append(banner);
}

/** Same category and town as the link the web app sent. */
function isTargetForm(target) {
  const here = new URLSearchParams(location.search);
  const wanted = new URL(target).searchParams;
  return here.get("category") === wanted.get("category") && here.get("location") === wanted.get("location");
}

async function main() {
  const job = await chrome.runtime.sendMessage({ type: "get-job" });
  if (!job) return; // a tab this extension didn't open

  const targetsForm = new URL(job.handoff.url).pathname.includes(DETAILS_PATH);
  const startedAt = Date.now();
  // ikman.lk is a single-page app (and may route through its login first), so keep checking.
  while (Date.now() - startedAt < WATCH_MS) {
    if (location.pathname.includes(DETAILS_PATH)) {
      if (targetsForm && !isTargetForm(job.handoff.url)) {
        // Coming back from ikman.lk's login keeps the category but not the town: reopen our link (only twice, never in a loop).
        if (job.redirects < 2) {
          job.redirects += 1;
          await chrome.runtime.sendMessage({ type: "save-job", job });
          location.replace(job.handoff.url);
          return;
        }
      }
      if (await waitFor(() => document.querySelector('input[name="title"]'), 1000)) {
        await sleep(500); // let the form finish rendering its dropdowns
        const missed = await fillPostAdForm(job.handoff.fields);
        chrome.runtime.sendMessage({ type: "job-filled" });
        showBanner(missed, job.handoff.fields.deadline);
        return;
      }
    }
    await sleep(700);
  }
}

// Only as the extension's content script; tests load this file into a page to call fillPostAdForm.
if (globalThis.chrome?.runtime?.id) main();
