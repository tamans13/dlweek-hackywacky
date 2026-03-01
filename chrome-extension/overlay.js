// overlay.js (session-gated)

let overlayElement = null;

const STUDY_ALLOW_MS = 10 * 60 * 1000; // 10 minutes grace
const PASS_KEY = "brainosaur_study_until";

function hasValidStudyPass() {
  const until = Number(sessionStorage.getItem(PASS_KEY) || "0");
  return Date.now() < until;
}

function setStudyPass() {
  sessionStorage.setItem(PASS_KEY, String(Date.now() + STUDY_ALLOW_MS));
}

function clearStudyPass() {
  sessionStorage.removeItem(PASS_KEY);
}

function getDomain(href) {
  try { return new URL(href).hostname; } catch { return ""; }
}

async function checkAndShowPrompt() {
  if (hasValidStudyPass()) return;

  chrome.runtime.sendMessage(
    { action: "check_current_url", url: window.location.href },
    (response) => {
      if (response && response.isDistraction) {
        createOverlay();
      }
    }
  );
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
    <h1 class="brainosaur-title">Hold up, Brainosaur! 🦖</h1>
    <p class="brainosaur-subtitle">You just opened a distracting site. Are you here to study?</p>
    <div class="brainosaur-button-group">
      <button class="brainosaur-btn brainosaur-btn-primary" id="brainosaur-study-yes">Yes, I need this for studying</button>
      <button class="brainosaur-btn brainosaur-btn-secondary" id="brainosaur-study-no">No, I'm getting distracted</button>
    </div>
  `;

  const step2 = document.createElement("div");
  step2.id = "brainosaur-step-2";
  step2.className = "brainosaur-hidden";
  step2.innerHTML = `
    <h1 class="brainosaur-title">Let's get back on track!</h1>
    <p class="brainosaur-subtitle">Do you still plan to study right now?</p>
    <div class="brainosaur-button-group">
      <button class="brainosaur-btn brainosaur-btn-primary" id="brainosaur-plan-yes">Yes, back to work</button>
      <button class="brainosaur-btn brainosaur-btn-secondary" id="brainosaur-plan-no">No, I'm done studying</button>
    </div>
  `;

  container.appendChild(step1);
  container.appendChild(step2);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  setTimeout(() => overlay.classList.add("visible"), 10);

  document.getElementById("brainosaur-study-yes").addEventListener("click", () => {
    setStudyPass();
    closeOverlay();
  });

  document.getElementById("brainosaur-study-no").addEventListener("click", () => {
    step1.classList.add("brainosaur-hidden");
    step2.classList.remove("brainosaur-hidden");
  });

  document.getElementById("brainosaur-plan-yes").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "close_this_tab" });
  });

  document.getElementById("brainosaur-plan-no").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "terminate_session", reason: "user_done_studying" });
    closeOverlay();
  });

  overlayElement = overlay;
}

function closeOverlay() {
  if (!overlayElement) return;

  overlayElement.classList.remove("visible");
  setTimeout(() => {
    try { overlayElement.remove(); } catch {}
    overlayElement = null;
  }, 300);
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "show_prompt") {
    if (!hasValidStudyPass()) createOverlay();
    sendResponse({ success: true });
    return;
  }

  if (request.action === "tracking_disabled") {
    clearStudyPass();
    closeOverlay();
    sendResponse({ success: true });
    return;
  }
});

// initial + SPA watcher
checkAndShowPrompt();

let lastUrl = location.href;
let lastDomain = getDomain(location.href);

new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    const currentDomain = getDomain(currentUrl);
    if (currentDomain !== lastDomain) {
      clearStudyPass();
      lastDomain = currentDomain;
    }
    lastUrl = currentUrl;
    checkAndShowPrompt();
  }
}).observe(document, { subtree: true, childList: true });
