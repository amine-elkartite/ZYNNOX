import React, { useState } from "react";
import { ArrowUp, Bot, Copy, MoreHorizontal, Plus, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import EmptyState from "../components/common/EmptyState.jsx";
import { UpgradeNotice } from "../components/common/Feedback.jsx";
import Sources from "../components/common/Sources.jsx";
import { api } from "../services/api.js";
import { useLoad } from "../hooks/useLoad.js";

function MessageBubble({ message, onToggleComparison }) {
  const isConversation = message.meta?.intelligence?.category === "conversation";
  const showOperationalMeta = message.meta && !isConversation;
  return (
    <div className={`message ${message.role}`}>
      {message.role === "assistant" && <button className="thought-line" type="button">Thought for a second ›</button>}
      <FormattedMessage content={message.content} />
      {showOperationalMeta && (
        <div className="meta-grid">
          <span>Credits used: {message.meta.creditsUsed}</span>
          <span>Remaining: {message.meta.remainingCredits}</span>
          <span>Agents: {message.meta.usedAgents?.join(", ")}</span>
        </div>
      )}
      {message.meta?.sources?.length > 0 && <Sources sources={message.meta.sources} />}
      {message.role === "assistant" && (
        <div className="message-actions">
          <button type="button" aria-label="Copy"><Copy size={16} /></button>
          <button type="button" aria-label="Good response"><ThumbsUp size={16} /></button>
          <button type="button" aria-label="Bad response"><ThumbsDown size={16} /></button>
          <button type="button" aria-label="Regenerate"><RefreshCcw size={16} /></button>
          {message.meta?.intelligence && <button type="button" aria-label="Show all AI answers" onClick={onToggleComparison}><MoreHorizontal size={16} /></button>}
        </div>
      )}
    </div>
  );
}

function FormattedMessage({ content }) {
  return (
    <div className="message-content">
      {String(content || "").split(/\n{2,}/u).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export default function ChatPage({ refreshMe = () => {} }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [health] = useLoad("/api/health", { public: true });
  const liveProviders = health?.config?.liveAiProviders || [];

  async function submit() {
    if (!message.trim()) return;
    const current = message;
    setMessages((items) => [...items, { role: "user", content: current }]);
    setMessage("");
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/agent/chat", { method: "POST", body: { message: current } });
      setMessages((items) => [...items, { role: "assistant", content: result.answer, meta: result }]);
      refreshMe();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page chat-page">
      <div className={liveProviders.length ? "ai-status live" : "ai-status demo"}>
        {liveProviders.length ? `Live AI: ${liveProviders.join(", ")}` : "Demo mode: add provider keys to .env"}
      </div>
      <div className="chat-toolbar">
        <label>
          <input type="checkbox" checked={showComparison} onChange={(event) => setShowComparison(event.target.checked)} />
          Show all AI answers
        </label>
      </div>
      <div className="chat-window">
        {messages.length === 0 && <EmptyState icon={Bot} title="Where should we begin?" text="Ask ZYNNOX for research, code help, strategy, or website creation." />}
        {messages.map((item, index) => <MessageBubble key={`${item.role}-${index}`} message={item} onToggleComparison={() => setShowComparison((value) => !value)} />)}
        {showComparison && messages.at(-1)?.meta?.intelligence && <IntelligencePanel intelligence={messages.at(-1).meta.intelligence} />}
        {busy && <div className="typing" aria-label="ZYNNOX is thinking"><span /><span /><span /></div>}
      </div>
      {showComparison && messages.at(-1)?.meta?.intelligence?.steps?.length > 0 && <StepStrip steps={messages.at(-1).meta.intelligence.steps} />}
      {error && <UpgradeNotice message={error} />}
      <div className="chat-composer" aria-label="Chat composer">
        <button className="attach-button" type="button" aria-label="Add context" title="Add context">
          <Plus size={22} />
        </button>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything"
        />
        <button className="send-button" disabled={busy || !message.trim()} onClick={submit} aria-label="Send">
          <ArrowUp size={18} />
        </button>
      </div>
      <p className="chat-disclaimer">ZYNNOX can make mistakes. Check important work before shipping.</p>
    </main>
  );
}

function StepStrip({ steps }) {
  return (
    <div className="step-strip">
      {steps.map((step) => <span key={step.id} className={step.status}>{step.label}</span>)}
    </div>
  );
}

function IntelligencePanel({ intelligence }) {
  const responses = intelligence.providerResponses || [];
  const comparison = intelligence.comparison || [];
  return (
    <section className="intelligence-panel">
      <div className="consensus-card">
        <h3>Consensus</h3>
        <p>Category: {intelligence.category} · Confidence: {Math.round((intelligence.confidence?.overall || 0) * 100)}%</p>
      </div>
      <div className="provider-cards">
        {responses.length === 0 && <div className="provider-card"><strong>Web-only mode</strong><p>No live provider keys are configured yet.</p></div>}
        {responses.map((response) => {
          const score = comparison.find((item) => item.provider === response.provider);
          return (
            <div className="provider-card" key={response.provider}>
              <strong>{response.provider}</strong>
              <span>{response.status} · {response.responseTimeMs}ms · {Math.round((score?.score || response.confidence || 0) * 100)}%</span>
              <p>{response.response || response.error || response.reason}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
