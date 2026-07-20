"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  portalGetMessages,
  portalGetUnreadCount,
  portalSendMessage,
  portalRequestHuman,
  type PortalChatMessage,
} from "@/lib/portal";

const POLL_OPEN_MS = 4_000;
const POLL_OPEN_FAST_MS = 2_000;
const POLL_CLOSED_MS = 15_000;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function friendlyChatError(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("404")) {
    return "Chat isn't live on the server yet — the backend needs the latest deploy and migration.";
  }
  return msg || fallback;
}

export function PortalChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [humanRequested, setHumanRequested] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [offerAgent, setOfferAgent] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    try {
      const res = await portalGetMessages();
      setMessages(res.messages);
      setHumanRequested(res.humanRequested);
      setUnread(0);
      setError("");
      setLoaded(true);

      const last = res.messages[res.messages.length - 1];
      if (res.humanRequested || (last && last.sender !== "partner")) {
        setAiPending(false);
      }
      if (res.humanRequested) {
        setOfferAgent(false);
      } else if (typeof res.offerAgent === "boolean") {
        setOfferAgent(res.offerAgent);
      } else if (last?.offerAgent) {
        setOfferAgent(true);
      }
    } catch (e) {
      setLoaded(true);
      setError(friendlyChatError(e, "Failed to load chat"));
    }
  }, []);

  // Close when clicking/tapping outside the widget
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Poll unread count while closed, full thread while open (faster when waiting on AI/agent).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (open) {
      void loadThread();
      const interval = aiPending || humanRequested ? POLL_OPEN_FAST_MS : POLL_OPEN_MS;
      timer = setInterval(() => void loadThread(), interval);
    } else {
      const tick = () =>
        portalGetUnreadCount()
          .then((r) => setUnread(r.unread))
          .catch(() => {});
      tick();
      timer = setInterval(tick, POLL_CLOSED_MS);
    }
    return () => clearInterval(timer);
  }, [open, loadThread, aiPending, humanRequested]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open, sending, offerAgent, aiPending]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    setDraft("");
    setOfferAgent(false);
    // Optimistic bubble while AarAi thinks / agent replies
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: tempId, sender: "partner", body, readAt: null, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await portalSendMessage(body);
      setMessages((m) => {
        const withoutTemp = m.filter((x) => x.id !== tempId);
        return res.aiReply ? [...withoutTemp, res.message, res.aiReply] : [...withoutTemp, res.message];
      });
      if (res.humanRequested) {
        setHumanRequested(true);
        setAiPending(false);
      } else if (res.aiPending || !res.aiReply) {
        setAiPending(true);
      }
      if (res.offerAgent) setOfferAgent(true);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setDraft(body);
      setAiPending(false);
      setError(friendlyChatError(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  }

  async function connectToAgent() {
    if (connecting || humanRequested) return;
    setConnecting(true);
    setError("");
    setOfferAgent(false);
    setAiPending(false);
    try {
      const res = await portalRequestHuman();
      setMessages(res.messages);
      setHumanRequested(true);
    } catch (e) {
      setError(friendlyChatError(e, "Failed to connect you to an agent"));
    } finally {
      setConnecting(false);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const waitingForAgent =
    humanRequested && (!lastMessage || lastMessage.sender === "partner" || lastMessage.sender === "ai");
  const showTyping = (sending || aiPending) && !humanRequested;

  return (
    <div ref={widgetRef}>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with the Aare team"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-foreground bg-foreground text-background shadow-lg transition hover:scale-105"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        {!open && unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border border-background bg-rose-500 px-1.5 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-40 flex h-[min(560px,70vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-card-border bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-card-border bg-surface/60 px-5 py-4">
              <div>
                <p className="font-semibold">{humanRequested ? "Agent" : "AarAi"}</p>
                <p className="text-xs text-muted">
                  {humanRequested
                    ? waitingForAgent
                      ? "Connected — waiting for an agent reply…"
                      : "You're connected to an agent — replies land here."
                    : "Ask me anything about Aare."}
                </p>
              </div>
              {!humanRequested ? (
                <button
                  type="button"
                  onClick={() => void connectToAgent()}
                  disabled={connecting}
                  className="shrink-0 rounded-full border border-card-border px-3 py-1.5 text-xs text-muted transition hover:border-foreground hover:text-foreground disabled:opacity-50"
                >
                  {connecting ? "Connecting…" : "Speak to an agent"}
                </button>
              ) : (
                <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                  Agent
                </span>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!loaded ? (
                <p className="text-center text-sm text-muted">Loading…</p>
              ) : messages.length === 0 && !error ? (
                <p className="px-4 text-center text-sm text-muted">Hi! How can I help you today?</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "partner" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.sender === "partner"
                          ? "rounded-br-md bg-foreground text-background"
                          : "rounded-bl-md border border-card-border bg-surface text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`mt-1 text-[0.65rem] ${
                          m.sender === "partner" ? "text-background/60" : "text-muted"
                        }`}
                      >
                        {m.sender === "admin" ? "Agent · " : m.sender === "ai" ? "AarAi · " : ""}
                        {fmtTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {showTyping ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-card-border bg-surface px-4 py-2.5">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              ) : null}
              {waitingForAgent && !showTyping ? (
                <p className="px-2 text-center text-xs text-muted">An agent will reply here shortly…</p>
              ) : null}
              {offerAgent && !humanRequested && !sending && !aiPending ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="rounded-2xl rounded-bl-md border border-card-border bg-surface px-4 py-3">
                    <p className="text-sm font-medium">Do you want to speak to an agent?</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void connectToAgent()}
                        disabled={connecting}
                        className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                      >
                        {connecting ? "Connecting…" : "Yes, connect me"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferAgent(false)}
                        className="rounded-full border border-card-border px-4 py-1.5 text-xs text-muted transition hover:border-foreground hover:text-foreground"
                      >
                        No, keep chatting
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>

            {error ? (
              <p className="mx-3 mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            ) : null}

            <div className="flex items-end gap-2 border-t border-card-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Write a message…"
                className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-card-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground bg-foreground text-background disabled:opacity-40"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
