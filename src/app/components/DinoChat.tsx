import { useMemo, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { sendLearningChat, type LearningChatMessage } from "../lib/api";

const WELCOME: LearningChatMessage = {
  role: "assistant",
  content: "Hi, I am Dino Coach. Ask me anything about your modules, weak topics, burnout, or what to study next.",
};

export default function DinoChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<LearningChatMessage[]>([WELCOME]);
  const [error, setError] = useState("");

  const canSend = useMemo(() => Boolean(input.trim()) && !sending, [input, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");

    const userMessage: LearningChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setSending(true);

    try {
      const result = await sendLearningChat({
        message: text,
        history: nextHistory.slice(-10),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed right-5 bottom-5 z-[60]">
      {open ? (
        <div className="w-[340px] sm:w-[380px] h-[520px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between bg-primary/5">
            <div className="flex items-center gap-2">
              <img src="/brainosaur.jpg" alt="Dino chat assistant" className="w-8 h-8 rounded-lg object-cover border border-border" />
              <div>
                <div className="text-sm font-medium text-foreground">Dino Chat</div>
                <div className="text-[11px] text-muted-foreground">Mini study copilot</div>
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
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${
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
