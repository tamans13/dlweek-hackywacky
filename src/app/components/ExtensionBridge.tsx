import { useEffect } from "react";
import { logTabEvent } from "../lib/api";

/**
 * Listens for tab events from the Brainosaur Chrome extension.
 * Sends them to the backend without changing any UI.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== "brainosaur-extension") return;
      const payload = event.data?.payload;
      if (!payload?.url || !payload?.category || !payload?.timestamp) return;

      const moduleName = (window as unknown as { __brainosaurModule?: string }).__brainosaurModule ?? "General";
      logTabEvent({
        moduleName,
        url: payload.url,
        eventType: payload.category,
        userLabel: null,
      }).catch(() => {});
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return null;
}
