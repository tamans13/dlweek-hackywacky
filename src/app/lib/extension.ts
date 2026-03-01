const APP_SOURCE = "brainosaur-webapp";
const EXT_SOURCE = "brainosaur-extension";

function sendToExtension(payload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `brainosaur_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeoutMs = 2500;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== EXT_SOURCE || !data.bridge) return;
      if (data.requestId !== requestId) return;

      window.removeEventListener("message", onMessage);
      clearTimeout(timer);

      if (data.error) {
        reject(new Error(data.error));
        return;
      }

      resolve(data.response);
    };

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Extension bridge timeout"));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP_SOURCE, requestId, payload }, window.location.origin);
  });
}

export async function startExtensionTracking(sessionId: string) {
  return sendToExtension({ type: "START_TRACKING", sessionId });
}

export async function stopExtensionTracking(reason = "user_ended_session") {
  return sendToExtension({ type: "STOP_TRACKING", reason });
}

export async function getExtensionStatus() {
  return sendToExtension({ type: "GET_STATUS" });
}

