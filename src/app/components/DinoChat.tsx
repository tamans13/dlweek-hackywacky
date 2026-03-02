import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Send, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  createChatSession,
  fetchChatSession,
  fetchChatSessions,
  sendLearningChat,
  type ChatProactiveUpdate,
  type ChatSessionMeta,
  type LearningChatMessage,
} from "../lib/api";
import { useAppData } from "../state/AppDataContext";

const WELCOME: LearningChatMessage = {
  role: "assistant",
  content: "Hi, I am Dino Coach. Ask me about your modules, notes, weak topics, burnout, or what to study next.",
};
const BURNOUT_AUTO_OPEN_THRESHOLD = 50;
const BURNOUT_NUDGE_STORAGE_KEY = "brainosaur_dino_burnout_nudge";
const BURNOUT_NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function timeLabel(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildBurnoutSupportMessage(moduleName: string, risk: number) {
  return `Hey, I noticed your burnout risk for ${moduleName} is ${risk}%. You have been working hard, so let's ease the pressure a little. Try this now: take 5 slow breaths, do a 10-minute off-screen break, then come back for one light 20-minute review block. I can help you plan a low-stress study session if you want.`;
}

function shouldShowBurnoutNudge(moduleName: string, risk: number) {
  try {
    const raw = sessionStorage.getItem(BURNOUT_NUDGE_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { moduleName?: string; risk?: number; at?: number };
    const lastAt = Number(parsed?.at || 0);
    const ageMs = Date.now() - lastAt;
    const sameModule = String(parsed?.moduleName || "") === moduleName;
    const lastRisk = Number(parsed?.risk || 0);
    if (sameModule && ageMs < BURNOUT_NUDGE_COOLDOWN_MS && risk <= lastRisk + 5) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export default function DinoChat() {
  const { state } = useAppData();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<LearningChatMessage[]>([WELCOME]);
  const [proactiveUpdates, setProactiveUpdates] = useState<ChatProactiveUpdate[]>([]);
  const [burnoutSupportMessage, setBurnoutSupportMessage] = useState("");
  const shouldHideWelcomeIntro = Boolean(burnoutSupportMessage);

  const highestBurnout = useMemo(() => {
    if (!state) return null;
    const entries = Object.entries(state.modules || {}).map(([moduleName, moduleState]) => ({
      moduleName,
      risk: Math.round(Number(moduleState?.burnoutRisk || 0)),
    }));
    if (!entries.length) return null;
    return entries.sort((a, b) => b.risk - a.risk)[0];
  }, [state]);

  const canSend = useMemo(() => Boolean(input.trim()) && !sending && Boolean(activeSessionId), [input, sending, activeSessionId]);

  const loadSidebar = async () => {
    const result = await fetchChatSessions();
    setSessions(result.sessions || []);
    setProactiveUpdates(result.proactiveUpdates || []);
    if (!activeSessionId && result.sessions?.length) {
      setActiveSessionId(result.sessions[0].id);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const result = await fetchChatSessions();
        if (cancelled) return;
        const nextSessions = result.sessions || [];
        setSessions(nextSessions);
        setProactiveUpdates(result.proactiveUpdates || []);

        let sessionId = activeSessionId;
        if (!sessionId) {
          if (nextSessions.length) {
            sessionId = nextSessions[0].id;
          } else {
            const created = await createChatSession("New chat");
            if (cancelled) return;
            sessionId = created.session.id;
            setSessions([created.session]);
          }
          setActiveSessionId(sessionId);
        }

        if (!sessionId) return;
        const chat = await fetchChatSession(sessionId);
        if (cancelled) return;
        const loaded = (chat.session.messages || []).map((m) => ({ role: m.role, content: m.content }));
        setMessages(loaded.length ? loaded : shouldHideWelcomeIntro ? [] : [WELCOME]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Dino chat.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeSessionId, shouldHideWelcomeIntro]);

  useEffect(() => {
    if (!highestBurnout || highestBurnout.risk <= BURNOUT_AUTO_OPEN_THRESHOLD) {
      setBurnoutSupportMessage("");
      return;
    }
    if (!shouldShowBurnoutNudge(highestBurnout.moduleName, highestBurnout.risk)) return;

    const message = buildBurnoutSupportMessage(highestBurnout.moduleName, highestBurnout.risk);
    setBurnoutSupportMessage(message);
    setOpen(true);
    try {
      sessionStorage.setItem(
        BURNOUT_NUDGE_STORAGE_KEY,
        JSON.stringify({
          moduleName: highestBurnout.moduleName,
          risk: highestBurnout.risk,
          at: Date.now(),
        }),
      );
    } catch {
      // Ignore sessionStorage failures in private browsing contexts.
    }
  }, [highestBurnout]);

  const handleCreateChat = async () => {
    setError("");
    try {
      const created = await createChatSession("New chat");
      setSessions((prev) => [created.session, ...prev]);
      setActiveSessionId(created.session.id);
      setMessages(shouldHideWelcomeIntro ? [] : [WELCOME]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat.");
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    setError("");
    setActiveSessionId(sessionId);
    try {
      const session = await fetchChatSession(sessionId);
      const loaded = (session.session.messages || []).map((m) => ({ role: m.role, content: m.content }));
      setMessages(loaded.length ? loaded : shouldHideWelcomeIntro ? [] : [WELCOME]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open chat.");
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !activeSessionId) return;
    setError("");

    const userMessage: LearningChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const result = await sendLearningChat({
        message: text,
        sessionId: activeSessionId,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (Array.isArray(result.proactiveUpdates)) setProactiveUpdates(result.proactiveUpdates);
      await loadSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-[60]">
      {open ? (
        <div className="w-[360px] sm:w-[760px] h-[560px] bg-card border border-border rounded-2xl shadow-xl flex overflow-hidden">
          <aside className="w-[235px] border-r border-border bg-primary/5 p-2 flex flex-col">
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <div className="text-xs font-medium text-muted-foreground">Dino Chats</div>
              <Button size="icon" variant="outline" onClick={() => void handleCreateChat()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {proactiveUpdates.length > 0 && (
              <div className="px-1 py-2">
                <div className="text-[11px] text-muted-foreground mb-1">Proactive Updates</div>
                <div className="space-y-1">
                  {proactiveUpdates.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-card px-2 py-1">
                      <div className={`text-[11px] font-medium ${item.severity === "high" ? "text-destructive" : "text-warning"}`}>
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto space-y-1 mt-1">
              {sessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  onClick={() => void handleSelectSession(session.id)}
                  className={`w-full text-left rounded-md px-2 py-2 border ${
                    session.id === activeSessionId ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="text-xs font-medium text-foreground truncate">{session.title || "New chat"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{session.preview || "No messages yet"}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeLabel(session.updatedAt)}</div>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2">
                <img src="/brainosaur.jpg" alt="Dino chat assistant" className="w-8 h-8 rounded-lg object-cover border border-border" />
                <div>
                  <div className="text-sm font-medium text-foreground">Dino Chat</div>
                  <div className="text-[11px] text-muted-foreground">Copilot with notes + proactive coaching</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-auto space-y-2">
              {burnoutSupportMessage && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm bg-primary/10 border border-primary/20 text-foreground">
                  {burnoutSupportMessage}
                </div>
              )}
              {messages
                .filter((msg) => !(shouldHideWelcomeIntro && msg.role === "assistant" && msg.content === WELCOME.content))
                .map((msg, index) => (
                <div
                  key={`${msg.role}-${index}-${msg.content.slice(0, 8)}`}
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {sending && <div className="text-xs text-muted-foreground">Dino is thinking...</div>}
              {error && <div className="text-xs text-destructive">{error}</div>}
            </div>

            <div className="p-3 border-t border-border flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Dino anything..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button size="icon" onClick={() => void handleSend()} disabled={!canSend}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <img src="/brainosaur.jpg" alt="Open Dino chat" className="w-7 h-7 rounded-full object-cover border border-primary-foreground/40" />
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Chat with Dino</span>
        </button>
      )}
    </div>
  );
}
