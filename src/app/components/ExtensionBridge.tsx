import { useEffect } from "react";
import { logTabEvent } from "../lib/api";

/**
 * Listens for telemetry events from the Brainosaur Chrome extension.
 * Extension sends tab activity only while study tracking is enabled.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      
      // Listen for tab activity telemetry from extension
      if (event.data?.source === "brainosaur-extension" && event.data?.payload?.event === "tab_activity") {
        const payload = event.data.payload;
        const moduleName = (window as unknown as { __brainosaurModule?: string }).__brainosaurModule ?? "General";
        
        logTabEvent({
          moduleName,
          url: payload.url,
          eventType: payload.category,
          userLabel: null,
        }).catch(() => {});
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return null;
}
