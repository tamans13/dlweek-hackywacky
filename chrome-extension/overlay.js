// overlay.js
// 1) Shows distraction prompt overlay
// 2) Acts as fallback bridge: web app postMessage <-> extension runtime

const DISTRACTION_SITES = [
  "youtube.com", "netflix.com", "tiktok.com", "instagram.com",
  "twitter.com", "x.com", "facebook.com", "reddit.com",
  "twitch.tv", "discord.com"
];

const TRACKING_STORAGE_KEY = "brainosaur_tracking_state";
const APP_SOURCE = "brainosaur-webapp";
const EXT_SOURCE = "brainosaur-extension";

let overlayElement = null;

function isDistractionUrl(url) {
  const lower = String(url || "").toLowerCase();
  return DISTRACTION_SITES.some((site) => lower.includes(site));
}

function getDomain(href) {
  try {
    return new URL(href).hostname;
  } catch {
    return "";
  }
}

function closeOverlay() {
  if (!overlayElement) return;
  overlayElement.classList.remove("visible");
  setTimeout(() => {
    try {
      overlayElement.remove();
    } catch {}
    overlayElement = null;
  }, 300);
}

function createOverlay() {
  if (overlayElement) return;

  const overlay = document.createElement("div");
  overlay.id = "brainosaur-distraction-overlay";

  const container = document.createElement("div");
  container.id = "brainosaur-prompt-container";

  const step1 = document.createElement("div");
  step1.id = "brainosaur-step-1";
  step1.innerHTML = `
    <div class="brainosaur-mascot-wrap" aria-hidden="true">
      <div class="brainosaur-dino-face">🦖</div>
      <div class="brainosaur-tears">
        <span class="brainosaur-tear"></span>
        <span class="brainosaur-tear"></span>
      </div>
    </div>
    <h1 class="brainosaur-title">Hold up, Brainosaur!</h1>
    <p class="brainosaur-subtitle">You opened a distracting site. Are you here to study?</p>
    <div class="brainosaur-button-group">
      <button class="brainosaur-btn brainosaur-btn-primary" id="brainosaur-study-yes">Yes</button>
      <button class="brainosaur-btn brainosaur-btn-secondary" id="brainosaur-study-no">No</button>
    </div>
  `;

  const step2 = document.createElement("div");
  step2.id = "brainosaur-step-2";
  step2.className = "brainosaur-hidden";
  step2.innerHTML = `
    <div class="brainosaur-mascot-wrap" aria-hidden="true">
      <div class="brainosaur-dino-face">🦖</div>
      <div class="brainosaur-tears">
        <span class="brainosaur-tear"></span>
        <span class="brainosaur-tear"></span>
      </div>
    </div>
    <h1 class="brainosaur-title">Do you not want to study anymore?</h1>
    <div class="brainosaur-button-group">
      <button class="brainosaur-btn brainosaur-btn-primary" id="brainosaur-plan-yes">Yes</button>
      <button class="brainosaur-btn brainosaur-btn-secondary" id="brainosaur-plan-no">No</button>
    </div>
  `;

  container.appendChild(step1);
  container.appendChild(step2);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("visible"), 10);

  document.getElementById("brainosaur-study-yes").addEventListener("click", () => {
    closeOverlay();
  });

  document.getElementById("brainosaur-study-no").addEventListener("click", () => {
    step1.classList.add("brainosaur-hidden");
    step2.classList.remove("brainosaur-hidden");
  });

  document.getElementById("brainosaur-plan-yes").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "terminate_session", reason: "user_done_studying" });
    closeOverlay();
  });

  document.getElementById("brainosaur-plan-no").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "close_this_tab" });
    closeOverlay();
  });

  overlayElement = overlay;
}

function checkAndShowPrompt() {
  if (!isDistractionUrl(window.location.href)) {
    closeOverlay();
    return;
  }

  chrome.storage.local.get(TRACKING_STORAGE_KEY, (result) => {
    const saved = result?.[TRACKING_STORAGE_KEY];
    const trackingEnabled = !!saved?.enabled;
    if (!trackingEnabled) {
      closeOverlay();
      return;
    }
    chrome.runtime.sendMessage({ action: "check_current_url", url: window.location.href }, (response) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        // If worker isn't immediately available, still show while tracking is enabled.
        createOverlay();
        return;
      }
      if (response?.isDistraction) createOverlay();
      else closeOverlay();
    });
  });
}

// Polling fallback: if message-driven prompt misses, this still shows overlay.
setInterval(() => {
  if (!document.hidden) checkAndShowPrompt();
}, 1500);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "show_prompt") {
    createOverlay();
    sendResponse({ success: true });
    return;
  }

  if (request.action === "tracking_enabled" || request.action === "tracking_disabled") {
    closeOverlay();
    sendResponse({ success: true });
    return;
  }

  // Forward extension payloads to the page app.
  if (request?.source === EXT_SOURCE && request?.payload) {
    window.postMessage({ source: EXT_SOURCE, payload: request.payload }, window.location.origin);
    sendResponse({ ok: true });
    return;
  }
});

// Fallback bridge: web app -> extension runtime
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== APP_SOURCE || !data.requestId || !data.payload) return;

  chrome.runtime.sendMessage(data.payload, (response) => {
    const error = chrome.runtime.lastError?.message || null;
    window.postMessage(
      {
        source: EXT_SOURCE,
        bridge: true,
        requestId: data.requestId,
        response: response || null,
        error
      },
      window.location.origin
    );
  });
});

checkAndShowPrompt();

let lastUrl = location.href;
let lastDomain = getDomain(location.href);

new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    const currentDomain = getDomain(currentUrl);
    if (currentDomain !== lastDomain) {
      lastDomain = currentDomain;
      closeOverlay();
    }
    lastUrl = currentUrl;
    checkAndShowPrompt();
  }
}).observe(document, { subtree: true, childList: true });
