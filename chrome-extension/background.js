/**
 * Brainosaur Tab Tracker - Background Service Worker
 * Listens for tab activation and sends URL + category to the Brainosaur web app.
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

function classifyUrl(url) {
  if (!url) return "neutral";
  const lower = url.toLowerCase();
  if (DISTRACTION_SITES.some(s => lower.includes(s))) return "distraction";
  if (HELP_SITES.some(s => lower.includes(s))) return "help";
  if (LEARNING_SITES.some(s => lower.includes(s))) return "learning";
  if ((lower.includes("localhost") || lower.includes("127.0.0.1")) &&
      (lower.includes(":5173") || lower.includes(":3000"))) return "learning";
  return "neutral";
}

async function getActiveTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.url : null;
  } catch {
    return null;
  }
}

async function sendToBrainosaurTabs(payload) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url) continue;
      const url = tab.url.toLowerCase();
      if (
        url.includes("localhost:5173") || url.includes("localhost:3000") ||
        url.includes("127.0.0.1:5173") || url.includes("127.0.0.1:3000")
      ) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            source: "brainosaur-extension",
            payload
          });
        } catch {
          /* tab may not have content script ready */
        }
      }
    }
  } catch (e) {
    console.warn("[Brainosaur] Failed to send to tabs:", e);
  }
}

chrome.tabs.onActivated.addListener(async () => {
  const url = await getActiveTabUrl();
  if (!url) return;
  const category = classifyUrl(url);
  await sendToBrainosaurTabs({
    url,
    timestamp: new Date().toISOString(),
    category
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.active) return;
  const url = tab.url;
  if (!url) return;
  const category = classifyUrl(url);
  await sendToBrainosaurTabs({
    url,
    timestamp: new Date().toISOString(),
    category
  });
});
