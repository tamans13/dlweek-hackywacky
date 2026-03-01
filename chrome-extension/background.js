/**
 * Brainosaur Tab Tracker - Background Service Worker (MV3)
 * Controlled by study session START/STOP from web app.
 */

const DISTRACTION_SITES = [
  "youtube.com", "netflix.com", "tiktok.com", "instagram.com",
  "twitter.com", "x.com", "facebook.com", "reddit.com",
  "twitch.tv", "discord.com"
];

const HELP_SITES = [
  "chat.openai.com", "claude.ai", "gemini.google.com",
  "copilot.microsoft.com"
];

const LEARNING_SITES = [
  "blackboard", "canvas", "coursera", "edx", "khanacademy",
  "udemy.com", "linkedin.com/learning"
];

const BRAINOSAUR_HOSTS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

const PROMPT_COOLDOWN_MS = 60_000;
const TRACKING_STORAGE_KEY = "brainosaur_tracking_state";

const lastPromptAtByTabId = new Map();

let trackingEnabled = false;
let currentSessionId = null;
let initStatePromise = null;

let activeTabId = null;
let activeUrl = null;
let activeSinceMs = Date.now();

const totals = {
  distractionMs: 0,
  helpMs: 0,
  learningMs: 0,
  neutralMs: 0
};

function nowIso() {
  return new Date().toISOString();
}

function classifyUrl(url) {
  if (!url) return "neutral";
  const lower = url.toLowerCase();

  if (DISTRACTION_SITES.some((site) => lower.includes(site))) return "distraction";
  if (HELP_SITES.some((site) => lower.includes(site))) return "help";
  if (LEARNING_SITES.some((site) => lower.includes(site))) return "learning";
  if (
    (lower.includes("localhost") || lower.includes("127.0.0.1")) &&
    (lower.includes(":5173") || lower.includes(":3000"))
  ) {
    return "learning";
  }
  return "neutral";
}

function isDistraction(url) {
  return classifyUrl(url) === "distraction";
}

function isBrainosaurWebAppUrl(url) {
  return !!url && BRAINOSAUR_HOSTS.some((host) => url.startsWith(host));
}

function canPrompt(tabId) {
  const now = Date.now();
  const last = lastPromptAtByTabId.get(tabId) || 0;
  if (now - last < PROMPT_COOLDOWN_MS) return false;
  lastPromptAtByTabId.set(tabId, now);
  return true;
}

function msToSec(ms) {
  return Math.round(ms / 1000);
}

function flushTime(nowMs = Date.now()) {
  if (!activeUrl) {
    activeSinceMs = nowMs;
    return;
  }

  const elapsed = Math.max(0, nowMs - activeSinceMs);
  const cat = classifyUrl(activeUrl);
  if (cat === "distraction") totals.distractionMs += elapsed;
  else if (cat === "help") totals.helpMs += elapsed;
  else if (cat === "learning") totals.learningMs += elapsed;
  else totals.neutralMs += elapsed;

  activeSinceMs = nowMs;
}

function resetSessionState() {
  totals.distractionMs = 0;
  totals.helpMs = 0;
  totals.learningMs = 0;
  totals.neutralMs = 0;
  activeTabId = null;
  activeUrl = null;
  activeSinceMs = Date.now();
  lastPromptAtByTabId.clear();
}

async function loadTrackingState() {
  try {
    const result = await chrome.storage.local.get(TRACKING_STORAGE_KEY);
    const saved = result?.[TRACKING_STORAGE_KEY];
    if (saved && typeof saved === "object") {
      trackingEnabled = !!saved.enabled;
      currentSessionId = saved.sessionId || null;
      return;
    }
  } catch (e) {
    console.warn("[Brainosaur] loadTrackingState failed:", e);
  }
  trackingEnabled = false;
  currentSessionId = null;
}

function ensureStateLoaded() {
  if (!initStatePromise) {
    initStatePromise = loadTrackingState();
  }
  return initStatePromise;
}

async function persistTrackingState() {
  try {
    await chrome.storage.local.set({
      [TRACKING_STORAGE_KEY]: {
        enabled: trackingEnabled,
        sessionId: currentSessionId
      }
    });
  } catch (e) {
    console.warn("[Brainosaur] persistTrackingState failed:", e);
  }
}

async function safeSendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function broadcastToAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id) continue;
      await safeSendToTab(tab.id, message);
    }
  } catch (e) {
    console.warn("[Brainosaur] broadcastToAllTabs failed:", e);
  }
}

async function sendToBrainosaurTabs(payload) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id || !tab.url) continue;
      if (!isBrainosaurWebAppUrl(tab.url)) continue;
      await safeSendToTab(tab.id, { source: "brainosaur-extension", payload });
    }
  } catch (e) {
    console.warn("[Brainosaur] sendToBrainosaurTabs failed:", e);
  }
}

async function startTracking(sessionId) {
  trackingEnabled = true;
  currentSessionId = sessionId || `session_${Date.now()}`;
  resetSessionState();
  await persistTrackingState();

  await sendToBrainosaurTabs({
    event: "tracking_status",
    enabled: true,
    sessionId: currentSessionId,
    timestamp: nowIso()
  });

  // Prompt immediately if study starts while user is already on a distracting tab.
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url) {
      await handleActiveContextChange(activeTab.id, activeTab.url);
    }
  } catch {
    // ignore active-tab lookup failures
  }
}

async function stopTracking(reason = "stopped") {
  if (!trackingEnabled) return;
  flushTime();

  const finalTotals = {
    distractionSec: msToSec(totals.distractionMs),
    helpSec: msToSec(totals.helpMs),
    learningSec: msToSec(totals.learningMs),
    neutralSec: msToSec(totals.neutralMs)
  };

  trackingEnabled = false;
  await persistTrackingState();

  await sendToBrainosaurTabs({
    event: "tracking_status",
    enabled: false,
    sessionId: currentSessionId,
    reason,
    timestamp: nowIso(),
    finalTotals
  });

  await broadcastToAllTabs({ action: "tracking_disabled" });

  currentSessionId = null;
  await persistTrackingState();
}

async function handleActiveContextChange(tabId, url) {
  if (!trackingEnabled) return;
  if (!tabId || !url) return;

  if (activeTabId !== tabId || activeUrl !== url) {
    flushTime();
    activeTabId = tabId;
    activeUrl = url;
    activeSinceMs = Date.now();
  }

  const category = classifyUrl(url);

  await sendToBrainosaurTabs({
    event: "tab_activity",
    sessionId: currentSessionId,
    url,
    category,
    timestamp: nowIso(),
    totals: {
      distractionSec: msToSec(totals.distractionMs),
      helpSec: msToSec(totals.helpMs),
      learningSec: msToSec(totals.learningMs),
      neutralSec: msToSec(totals.neutralMs)
    }
  });

  if (category === "distraction" && canPrompt(tabId)) {
    const promptAck = await safeSendToTab(tabId, { action: "show_prompt", url });
    if (!promptAck) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // ignore remove errors
      }
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      await ensureStateLoaded();

      if (request?.type === "START_TRACKING") {
        await startTracking(request.sessionId);
        sendResponse({ ok: true, enabled: true, sessionId: currentSessionId });
        return;
      }

      if (request?.type === "STOP_TRACKING") {
        await stopTracking(request.reason || "stopped_by_webapp");
        sendResponse({ ok: true, enabled: false });
        return;
      }

      if (request?.type === "GET_STATUS") {
        sendResponse({ ok: true, enabled: trackingEnabled, sessionId: currentSessionId });
        return;
      }

      if (request?.action === "terminate_session") {
        await sendToBrainosaurTabs({
          event: "terminate_session",
          sessionId: currentSessionId,
          reason: request.reason || "user_done_studying",
          url: sender?.tab?.url || null,
          timestamp: nowIso()
        });

        await stopTracking("terminated_from_overlay");

        if (sender?.tab?.id) {
          await chrome.tabs.remove(sender.tab.id);
        }

        sendResponse({ ok: true });
        return;
      }

      if (request?.action === "close_this_tab" && sender?.tab?.id) {
        await chrome.tabs.remove(sender.tab.id);
        sendResponse({ ok: true });
        return;
      }

      if (request?.action === "check_current_url") {
        sendResponse({ isDistraction: trackingEnabled && isDistraction(request.url) });
        return;
      }

      sendResponse({ ok: true, ignored: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ensureStateLoaded();
  if (!trackingEnabled) return;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) await handleActiveContextChange(activeInfo.tabId, tab.url);
  } catch {
    // ignore
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ensureStateLoaded();
  if (!trackingEnabled) return;
  if (!tab?.active) return;

  if (changeInfo.url || changeInfo.status === "complete") {
    const url = tab.url || changeInfo.url;
    if (url) await handleActiveContextChange(tabId, url);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStateLoaded();
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureStateLoaded();
});
