/**
 * ChatbotWidget.tsx — Floating multi-agent medical chatbot widget
 *
 * Always visible as a floating button (bottom-right).
 * Opens a slide-up chat panel with:
 *  - Conversation history (persisted in DB)
 *  - Consent toggle (patients only) — enables Agent 1 (Mistral RAG)
 *  - Message input → triggers Agent 2 (Groq) → optional Agent 1 → Agent 2 synthesis
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessageBubble } from './ChatMessage';
import type { ChatMessage } from '../../utils/chatbotApi';
import * as api from '../../utils/chatbotApi';
import chatbotVid from '../../../assets/chatbot1.mp4';

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "👋 Hi! I'm **ClynicxAI**, your personal medical assistant.\n\n" +
    "I can help you with:\n" +
    "• General medical questions (symptoms, medications, conditions)\n" +
    "• Understanding lab test values and medical terms\n" +
    "• Explaining your own reports and prescriptions _(enable medical data access below)_\n\n" +
    "What would you like to know today?",
  agentUsed: undefined,
};

export function ChatbotWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load session + history on first open
  useEffect(() => {
    if (isOpen && !historyLoaded && user) {
      (async () => {
        try {
          const hist = await api.getHistory();
          setConsent(hist.dataSharingConsent);
          if (hist.messages && hist.messages.length > 0) {
            setMessages([WELCOME_MESSAGE, ...hist.messages]);
          }
          setHistoryLoaded(true);
        } catch {
          setHistoryLoaded(true);
        }
      })();
    }
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, historyLoaded, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleToggleConsent = async () => {
    setConsentLoading(true);
    try {
      const newConsent = !consent;
      await api.setConsent(newConsent);
      setConsent(newConsent);
      const msg: ChatMessage = {
        role: 'assistant',
        content: newConsent
          ? '✅ **Medical data access enabled.** I can now analyze your reports and prescriptions to give you personalized answers. Ask me anything about your health records!'
          : '🔒 **Medical data access disabled.** I\'ll now answer only from general medical knowledge. Your records are not being accessed.',
      };
      setMessages(prev => [...prev, msg]);
    } catch {
      // ignore
    } finally {
      setConsentLoading(false);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.sendMessage(text);
      const botMsg: ChatMessage = {
        role: 'assistant',
        content: res.reply,
        agentUsed: res.agentUsed,
        intent: res.intent,
        sources: res.sources || [],
      };
      setMessages(prev => [...prev, botMsg]);
      if (res.consentNeeded && !consent) {
        // backend hinted user should enable consent
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${err.message || 'Unable to reach the AI service. Please try again.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, consent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    await api.clearHistory().catch(() => {});
    setMessages([WELCOME_MESSAGE]);
    setHistoryLoaded(false);
  };

  if (!user) return null;

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────────── */}
      <button
        id="chatbot-trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open medical AI chatbot"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
          zIndex: 9999,
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontSize: '1.5rem',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(124,58,237,0.45)';
        }}
      >
        {isOpen ? (
          <span style={{ color: '#fff' }}>✕</span>
        ) : (
          <video
            src={chatbotVid}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
            }}
          />
        )}
        {unread > 0 && !isOpen && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              border: '2px solid #fff',
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div
        id="chatbot-panel"
        style={{
          position: 'fixed',
          bottom: isOpen ? 96 : -700,
          right: 24,
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          height: 560,
          maxHeight: 'calc(100vh - 120px)',
          borderRadius: 20,
          background: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9998,
          transition: 'bottom 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          border: '1px solid #e5e7eb',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
            padding: '14px 16px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                overflow: 'hidden',
              }}
            >
              <video
                src={chatbotVid}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                ClynicxAI
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem' }}>
                Powered by Groq + Mistral
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            title="Clear chat history"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '0.7rem',
            }}
          >
            Clear
          </button>
        </div>

        {/* Consent toggle (patients only) */}
        {user.role === 'patient' && (
          <div
            style={{
              background: consent ? '#f0fdf4' : '#fafafa',
              borderBottom: '1px solid #e5e7eb',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
                {consent ? '🔓' : '🔒'} Access my medical records
              </div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 1 }}>
                {consent
                  ? 'AI can read your reports & prescriptions'
                  : 'Enable for personalized answers'}
              </div>
            </div>
            <button
              id="consent-toggle"
              onClick={handleToggleConsent}
              disabled={consentLoading}
              aria-pressed={consent}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: consent ? '#7c3aed' : '#d1d5db',
                border: 'none',
                cursor: consentLoading ? 'not-allowed' : 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: consent ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>
        )}

        {/* Messages area */}
        <div
          id="chatbot-messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {messages.map((msg, i) => (
            <ChatMessageBubble key={i} message={msg} />
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                >
                  🏥
                </div>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px 18px 18px 18px',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map(j => (
                    <span
                      key={j}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#7c3aed',
                        animation: `chatbotPulse 1.2s ${j * 0.2}s infinite`,
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: '#fafafa',
          }}
        >
          <textarea
            id="chatbot-input"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a medical question…"
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              outline: 'none',
              maxHeight: 100,
              overflowY: 'auto',
              background: '#fff',
              lineHeight: 1.5,
            }}
            onFocus={e => (e.target.style.borderColor = '#7c3aed')}
            onBlur={e => (e.target.style.borderColor = '#d1d5db')}
          />
          <button
            id="chatbot-send"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                : '#e5e7eb',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            {loading ? (
              <span style={{ fontSize: '0.75rem' }}>⏳</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={input.trim() ? '#fff' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() ? '#fff' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>

        {/* Footer disclaimer */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.62rem',
            color: '#9ca3af',
            padding: '4px 12px 8px',
            background: '#fafafa',
          }}
        >
          AI responses are informational only. Always consult a doctor.
        </div>
      </div>

      {/* Pulse animation for typing dots */}
      <style>{`
        @keyframes chatbotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
