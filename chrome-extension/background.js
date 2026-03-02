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
const TRACKING_STORAGE_KEY = "brainosaur_tracking_state";
const PROMPT_COOLDOWN_MS = 20_000;

const DEBUG = true;
const lastPromptAtByTabId = new Map();

function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          if (DEBUG) console.warn("[Brainosaur] storage.get failed:", err.message);
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (e) {
      if (DEBUG) console.warn("[Brainosaur] storage.get threw:", e);
      resolve({});
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => {
        const err = chrome.runtime?.lastError;
        if (err && DEBUG) console.warn("[Brainosaur] storage.set failed:", err.message);
        resolve();
      });
    } catch (e) {
      if (DEBUG) console.warn("[Brainosaur] storage.set threw:", e);
      resolve();
    }
  });
}

let trackingEnabled = false;
let currentSessionId = null;
let currentAppOrigin = null;
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
  if (!url) return false;
  if (currentAppOrigin && url.startsWith(currentAppOrigin)) return true;
  return BRAINOSAUR_HOSTS.some((host) => url.startsWith(host));
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

function canPrompt(tabId) {
  const now = Date.now();
  const last = lastPromptAtByTabId.get(tabId) || 0;
  if (now - last < PROMPT_COOLDOWN_MS) return false;
  lastPromptAtByTabId.set(tabId, now);
  return true;
}

async function loadTrackingState() {
  try {
    const result = await storageGet(TRACKING_STORAGE_KEY);
    const saved = result?.[TRACKING_STORAGE_KEY];
    if (saved && typeof saved === "object") {
      trackingEnabled = !!saved.enabled;
      currentSessionId = saved.sessionId || null;
      currentAppOrigin = saved.appOrigin || null;
      return;
    }
  } catch (e) {
    console.warn("[Brainosaur] loadTrackingState failed:", e);
  }
  trackingEnabled = false;
  currentSessionId = null;
  currentAppOrigin = null;
}

function ensureStateLoaded() {
  if (!initStatePromise) {
    initStatePromise = loadTrackingState();
  }
  return initStatePromise;
}

async function persistTrackingState() {
  try {
    await storageSet({
      [TRACKING_STORAGE_KEY]: {
        enabled: trackingEnabled,
        sessionId: currentSessionId,
        appOrigin: currentAppOrigin
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

async function ensureOverlayInjected(tabId) {
  if (!chrome?.scripting) return false;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["overlay.css"],
    });
  } catch {
    // css may already be injected
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["overlay.js"],
    });
    return true;
  } catch (e) {
    if (DEBUG) console.warn("[Brainosaur] overlay injection failed", e);
    return false;
  }
}

async function showPromptOnTab(tabId, url) {
  const firstTry = await safeSendToTab(tabId, { action: "show_prompt", url });
  if (firstTry?.success) return true;

  const injected = await ensureOverlayInjected(tabId);
  if (!injected) return false;

  const secondTry = await safeSendToTab(tabId, { action: "show_prompt", url });
  return Boolean(secondTry?.success);
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

function originFromUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function startTracking(sessionId, appOrigin = null) {
  trackingEnabled = true;
  currentSessionId = sessionId || `session_${Date.now()}`;
  currentAppOrigin = appOrigin || currentAppOrigin || null;
  resetSessionState();
  await persistTrackingState();

  if (DEBUG) console.log("[Brainosaur] START_TRACKING", { sessionId: currentSessionId });

  await sendToBrainosaurTabs({
    event: "tracking_status",
    enabled: true,
    sessionId: currentSessionId,
    timestamp: nowIso()
  });

  // Let all tabs clear any stale allow-pass from prior sessions.
  await broadcastToAllTabs({ action: "tracking_enabled", sessionId: currentSessionId });

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

  if (DEBUG) console.log("[Brainosaur] STOP_TRACKING", { reason, sessionId: currentSessionId });

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
  currentAppOrigin = null;
  await persistTrackingState();
}

async function handleActiveContextChange(tabId, url) {
  if (!trackingEnabled) return;
  if (!tabId || !url) return;

  const contextChanged = activeTabId !== tabId || activeUrl !== url;

  if (contextChanged) {
    flushTime();
    activeTabId = tabId;
    activeUrl = url;
    activeSinceMs = Date.now();
  }

  const category = classifyUrl(url);

  if (DEBUG) console.log("[Brainosaur] ACTIVE_CONTEXT", { tabId, url, category, contextChanged });

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

  // Show the blue-screen prompt every time the user opens/switches to a distracting site
  // during an active study session.
  if (category === "distraction" && canPrompt(tabId)) {
    await showPromptOnTab(tabId, url);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      await ensureStateLoaded();

      if (request?.type === "START_TRACKING") {
        const senderOrigin = originFromUrl(sender?.tab?.url || "");
        await startTracking(request.sessionId, senderOrigin);
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

      if (request?.action === "check_current_url") {
        sendResponse({ isDistraction: trackingEnabled && isDistraction(request.url) });
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
        sendResponse({ ok: true });
        return;
      }

      if (request?.action === "close_this_tab") {
        if (sender?.tab?.id) {
          try {
            await chrome.tabs.remove(sender.tab.id);
          } catch {
            // ignore close failures
          }
        }
        sendResponse({ ok: true });
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
    const url = changeInfo.url || tab.url;
    if (url) await handleActiveContextChange(tabId, url);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStateLoaded();
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureStateLoaded();
});
