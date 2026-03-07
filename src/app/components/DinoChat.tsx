import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageCircle, Plus, Send, X } from "lucide-react";
import { useNavigate } from "react-router";
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
import { daysUntil } from "../lib/format";

const WELCOME: LearningChatMessage = {
  role: "assistant",
  content: "Hi, I am Dino Coach. Ask me about your modules, notes, weak topics, burnout, or what to study next.",
};
const BURNOUT_AUTO_OPEN_THRESHOLD = 50;
const BURNOUT_NUDGE_STORAGE_KEY = "brainosaur_dino_burnout_nudge";
const BURNOUT_NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const PERSONA_NUDGE_STORAGE_PREFIX = "brainosaur_dino_persona_nudge";

function timeLabel(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildBurnoutSupportMessage(moduleName: string, risk: number) {
  return `Hey, I noticed your burnout risk for ${moduleName} is ${risk}%. You have been working hard, so let's ease the pressure a little. Try this now: take 5 slow breaths, do a 10-minute off-screen break, then come back for one light 20-minute review block. I can help you plan a low-stress study session if you want.`;
}

function buildPersonaUpdateMessage(learningStyle: string) {
  return `Your Brainotype + Learning Style insights have been refreshed to "${learningStyle}". Tap into My Profile to review those updates and the latest suggested study tips.`;
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
  const navigate = useNavigate();
  const { state, readiness } = useAppData();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<LearningChatMessage[]>([WELCOME]);
  const [proactiveUpdates, setProactiveUpdates] = useState<ChatProactiveUpdate[]>([]);
  const [burnoutSupportMessage, setBurnoutSupportMessage] = useState("");
  const [personaSupportMessage, setPersonaSupportMessage] = useState("");
  const shouldHideWelcomeIntro = Boolean(burnoutSupportMessage || personaSupportMessage);

  // Exam warning notification
  const EXAM_WARN_KEY = "brainosaur_exam_warn_shown";
  const [examWarning, setExamWarning] = useState<{ moduleName: string; daysLeft: number; readiness: number } | null>(null);
  const [examWarnVisible, setExamWarnVisible] = useState(false);

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

  // Build exam warning after 4s if there's an urgent exam
  useEffect(() => {
    if (!state) return;
    try {
      const alreadyShown = sessionStorage.getItem(EXAM_WARN_KEY);
      if (alreadyShown) return;
    } catch { /* ignore */ }

    const urgent = Object.entries(state.examPlans)
      .map(([moduleName, plan]) => {
        if (!plan?.examDate) return null;
        const days = daysUntil(plan.examDate);
        const readinessItem = readiness.find((r) => r.moduleName === moduleName);
        const score = readinessItem?.score ?? 0;
        if (days !== null && days >= 0 && days <= 7 && score < 60) {
          return { moduleName, daysLeft: days, readiness: score };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (a!.daysLeft - b!.daysLeft))[0] ?? null;

    if (!urgent) return;

    const timer = setTimeout(() => {
      setExamWarning(urgent);
      setExamWarnVisible(true);
      try { sessionStorage.setItem(EXAM_WARN_KEY, "1"); } catch { /* ignore */ }
    }, 4000);
    return () => clearTimeout(timer);
  }, [state, readiness]);

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

  useEffect(() => {
    const persona = state?.personaProfile;
    if (!persona?.updatedAt) return;
    if (persona.source && !String(persona.source).includes("evolution")) return;

    const updatedAtMs = new Date(persona.updatedAt).getTime();
    if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return;

    const scope = String(state?.profile?.email || "anonymous");
    const storageKey = `${PERSONA_NUDGE_STORAGE_PREFIX}.${scope}`;

    try {
      const previousNotifiedAt = Number(window.localStorage.getItem(storageKey) || "0");
      if (!Number.isFinite(previousNotifiedAt) || previousNotifiedAt <= 0) {
        window.localStorage.setItem(storageKey, String(updatedAtMs));
        return;
      }
      if (updatedAtMs <= previousNotifiedAt) return;

      window.localStorage.setItem(storageKey, String(updatedAtMs));
      setPersonaSupportMessage(buildPersonaUpdateMessage(persona.learningStyle || "Updated Persona"));
      setOpen(true);
    } catch {
      // Keep UI stable if localStorage is unavailable.
    }
  }, [state?.personaProfile, state?.profile?.email]);

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
    <div className="fixed right-5 bottom-5 z-[60] flex flex-col items-end gap-3">
      {/* Exam warning notification bubble */}
      {examWarnVisible && examWarning && !open && (
        <div className="w-[300px] bg-card border border-destructive/40 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border-b border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium text-destructive flex-1">Dino Alert 🦕</span>
            <button
              type="button"
              onClick={() => setExamWarnVisible(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-foreground leading-snug">
              Rawrr! ⚠️ <span className="font-medium">{examWarning.moduleName}</span> exam is in{" "}
              <span className="font-medium text-destructive">{examWarning.daysLeft} day{examWarning.daysLeft !== 1 ? "s" : ""}</span>{" "}
              and you're only <span className="font-medium text-destructive">{examWarning.readiness}% ready</span>. Time to hustle, dino-scholar!
            </p>
            <button
              type="button"
              onClick={() => { setExamWarnVisible(false); setOpen(true); }}
              className="mt-3 w-full text-xs font-medium text-primary hover:underline text-left"
            >
              Ask Dino for a study plan →
            </button>
          </div>
        </div>
      )}
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
                  className={`w-full text-left rounded-md px-2 py-2 border ${session.id === activeSessionId ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/40"
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
              {personaSupportMessage && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm bg-primary/10 border border-primary/20 text-foreground">
                  <p>{personaSupportMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/profile#study-techniques")}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Go to My Profile
                  </button>
                </div>
              )}
              {messages
                .filter((msg) => !(shouldHideWelcomeIntro && msg.role === "assistant" && msg.content === WELCOME.content))
                .map((msg, index) => (
                  <div
                    key={`${msg.role}-${index}-${msg.content.slice(0, 8)}`}
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.role === "user"
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
          className="h-14 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.08] transition-all duration-200 flex items-center gap-2"
        >
          <img src="/brainosaur.jpg" alt="Open Dino chat" className="w-7 h-7 rounded-full object-cover border border-primary-foreground/40" />
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Chat with Dino</span>
        </button>
      )}
    </div>
  );
}
