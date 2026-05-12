import React from 'react';
import type { ChatMessage, ChatSource } from '../../utils/chatbotApi';

interface Props {
  message: ChatMessage;
}

/** Badge showing which AI agents processed the message */
function AgentBadge({ agentUsed }: { agentUsed?: string }) {
  if (!agentUsed || agentUsed === 'off_topic_block' || agentUsed === 'error') return null;

  const config = agentUsed === 'mistral+groq'
    ? { label: '🔬 Mistral + Groq', color: '#7c3aed', bg: '#ede9fe' }
    : { label: '⚡ Groq AI', color: '#059669', bg: '#d1fae5' };

  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 12,
        color: config.color,
        backgroundColor: config.bg,
        display: 'inline-block',
        marginBottom: 4,
        letterSpacing: '0.02em',
      }}
    >
      {config.label}
    </span>
  );
}

/** Collapsible source citations from Agent 1 (Mistral RAG) */
function SourceCitations({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = React.useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: '0.7rem',
          color: '#7c3aed',
          background: 'none',
          border: '1px solid #c4b5fd',
          borderRadius: 8,
          padding: '2px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>{open ? '▼' : '▶'}</span>
        {sources.length} source{sources.length > 1 ? 's' : ''} from your records
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sources.map((src, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.68rem',
                background: '#f5f3ff',
                border: '1px solid #e9d5ff',
                borderRadius: 8,
                padding: '6px 10px',
                color: '#5b21b6',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {src.type === 'report' ? '📋 Report' : '💊 Prescription'}
              </span>
              {src.metadata?.report_type && ` — ${src.metadata.report_type}`}
              {src.metadata?.diagnosis && ` — ${src.metadata.diagnosis}`}
              {src.metadata?.upload_date && (
                <span style={{ color: '#7c3aed', marginLeft: 4 }}>
                  ({src.metadata.upload_date.slice(0, 10)})
                </span>
              )}
              {src.metadata?.prescribed_date && (
                <span style={{ color: '#7c3aed', marginLeft: 4 }}>
                  ({src.metadata.prescribed_date.slice(0, 10)})
                </span>
              )}
              <div style={{ marginTop: 3, color: '#6b21a8', fontStyle: 'italic' }}>
                {src.preview}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Formats basic markdown (headers, bold, and italics) while preserving newlines */
function formatText(text: string) {
  if (!text) return null;
  return text.split('\n').map((line, lineIndex) => {
    // Check for Markdown headers (e.g., "#### Title")
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    const isHeader = !!headerMatch;
    const content = headerMatch ? headerMatch[2] : line;

    // Process bold and italics
    const parts = content.split(/(\*\*.*?\*\*|_[^_]+_)/g);
    const formattedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });

    return (
      <React.Fragment key={lineIndex}>
        {isHeader ? (
          <strong style={{ display: 'block', marginTop: '0.5em', marginBottom: '0.2em', fontSize: '1.05em' }}>
            {formattedLine}
          </strong>
        ) : (
          formattedLine
        )}
        {!isHeader && lineIndex < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    );
  });
}

/** Renders a single chat message bubble */
export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div
          style={{
            maxWidth: '80%',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff',
            borderRadius: '18px 18px 4px 18px',
            padding: '10px 14px',
            fontSize: '0.88rem',
            lineHeight: 1.5,
            boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {formatText(message.content)}
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: '88%' }}>
          {/* Avatar */}
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
          <div>
            <AgentBadge agentUsed={message.agentUsed} />
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '4px 18px 18px 18px',
                padding: '10px 14px',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#1f2937',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {formatText(message.content)}
            </div>
            <SourceCitations sources={message.sources || []} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
