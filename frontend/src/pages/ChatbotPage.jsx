import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  CheckCircle,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Zap,
  Shield,
  Lightbulb,
  Thermometer,
  Battery,
  Clock,
  Activity,
  Key
} from 'lucide-react';
import { sendChatMessage, saveAiApiKey } from '../services/api';

/**
 * Lightweight Markdown Formatter component for clean, rich message rendering
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="chat-markdown">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="chat-heading-3">
              {formatInline(trimmed.substring(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="chat-heading-2">
              {formatInline(trimmed.substring(3))}
            </h3>
          );
        }

        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="chat-divider" />;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="chat-bullet-row">
              <span className="chat-bullet-dot">•</span>
              <span className="chat-bullet-text">{formatInline(trimmed.substring(2))}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="chat-bullet-row">
              <span className="chat-num-dot">{numMatch[1]}.</span>
              <span className="chat-bullet-text">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="chat-para">
            {formatInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'inherit', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="chat-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function ChatbotPage({ telemetry = {} }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `👋 Hello! I am **Orbit AI**, your smart home and knowledge assistant.\n\nI have live direct access to your connected IoT devices and knowledge engine:\n- 🌡️ Room Temperature: **${telemetry.temperature !== null ? `${telemetry.temperature}°C` : 'Reading...'}**\n- 🖥️ Hub Temperature: **${telemetry.hubTemp !== null ? `${telemetry.hubTemp}°C` : 'Reading...'}**\n- 🔋 Battery Level: **${telemetry.battery !== null ? `${telemetry.battery}%` : 'Reading...'}**\n- 🔒 Safe Mode: **${telemetry.safeMode ? 'LOCKED' : 'OFF'}**\n\nAsk me anything! Try *"How to make biryani"*, *"Will it rain today?"*, *"Turn on Light 1"*, or *"Check system health"*.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'Orbit Engine'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('orbit_ai_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const messagesEndRef = useRef(null);

  const quickActions = [
    { label: '🍛 Biryani Recipe', icon: <Sparkles size={14} />, query: 'how to make biryani' },
    { label: '🌧️ Rain Forecast', icon: <Sparkles size={14} />, query: 'will it rain today' },
    { label: '🌡️ Room Temp', icon: <Thermometer size={14} />, query: 'What is the current room temperature?' },
    { label: '🖥️ Hub Temp', icon: <Thermometer size={14} />, query: 'What is the hub temperature?' },
    { label: '💡 Turn On Light 1', icon: <Lightbulb size={14} />, query: 'Turn on Light 1' },
    { label: '🔋 Battery Status', icon: <Battery size={14} />, query: 'Check battery level and voltage' },
    { label: '🔒 Safe Mode', icon: <Shield size={14} />, query: 'Is Safe Mode currently active?' },
    { label: '📊 System Health', icon: <Activity size={14} />, query: 'Show overall home status summary' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const speakText = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = text
      .replace(/[*_#`]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '');

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (customQuery = null) => {
    const textToSend = customQuery || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customQuery) setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const data = await sendChatMessage(textToSend.trim(), historyPayload, customKey || undefined);

      const replyText = data.reply || data.message || data.content || (typeof data === 'string' ? data : 'No response received.');

      const assistantMessage = {
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source || data.model || 'Orbit AI',
        executedActions: data.executedActions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      speakText(replyText);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Connection Error**: ${err.message || 'Could not reach Orbit AI service.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'System Fallback'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveKey = async () => {
    localStorage.setItem('orbit_ai_key', customKey.trim());
    await saveAiApiKey(customKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  const handleClear = () => {
    if (window.confirm('Clear active chat history?')) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setMessages([
        {
          role: 'assistant',
          content: `👋 Chat history cleared. Live telemetry stream is ready. How can I assist you?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'Orbit Engine'
        }
      ]);
    }
  };

  return (
    <div className="chatbot-page-container">
      {/* Real-time Telemetry Status Ribbon */}
      <div className="card chatbot-telemetry-strip">
        <div className="chatbot-telemetry-items">
          <div className="chatbot-status-badge">
            <Zap size={15} />
            <span>Orbit AI Active</span>
          </div>
          <div className="chatbot-telemetry-chip">
            🌡️ Room: <strong>{telemetry.temperature !== null ? `${telemetry.temperature}°C` : '--'}</strong>
          </div>
          <div className="chatbot-telemetry-chip">
            🖥️ Hub: <strong>{telemetry.hubTemp !== null ? `${telemetry.hubTemp}°C` : '--'}</strong>
          </div>
          <div className="chatbot-telemetry-chip">
            🔋 Battery: <strong>{telemetry.battery !== null ? `${telemetry.battery}%` : '--'}</strong>
          </div>
          <div className="chatbot-telemetry-chip">
            🔒 Safe Mode: <strong>{telemetry.safeMode ? 'LOCKED' : 'OFF'}</strong>
          </div>
          <div className="chatbot-telemetry-chip">
            💡 L1: <strong>{telemetry.light1 ? 'ON' : 'OFF'}</strong>
          </div>
        </div>

        <div className="chatbot-actions-row">
          <button
            type="button"
            className={`chatbot-action-btn ${showKeyInput ? 'active' : ''}`}
            onClick={() => setShowKeyInput(!showKeyInput)}
            title="Configure Cloud AI API Key"
          >
            <Key size={14} />
            <span>API Key</span>
          </button>

          <button
            type="button"
            className={`chatbot-action-btn ${ttsEnabled ? 'active' : ''}`}
            onClick={() => {
              if (isSpeaking) {
                window.speechSynthesis?.cancel();
                setIsSpeaking(false);
              } else {
                setTtsEnabled(!ttsEnabled);
              }
            }}
            title={ttsEnabled ? 'Voice Responses Enabled' : 'Voice Responses Disabled'}
          >
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{ttsEnabled ? 'Voice ON' : 'Voice'}</span>
          </button>

          <button
            type="button"
            className="chatbot-action-btn danger"
            onClick={handleClear}
            title="Clear Chat History"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Cloud AI Key Drawer */}
      {showKeyInput && (
        <div style={{
          background: '#f8fafc',
          padding: '12px 18px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <Key size={16} color="#6e00fa" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568' }}>
            Cloud AI Key:
          </span>
          <input
            type="password"
            placeholder="Enter Groq API Key (gsk_...)"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e0',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={handleSaveKey}
            style={{
              background: keySaved ? '#38a169' : '#6e00fa',
              color: 'white',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {keySaved ? 'Saved! ✓' : 'Save Key'}
          </button>
          <span style={{ fontSize: '11px', color: '#718096' }}>
            Free keys available at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#6e00fa' }}>console.groq.com</a>
          </span>
        </div>
      )}

      {/* Main Chat Window */}
      <div className="card chat-window-card">
        {/* Message Stream */}
        <div className="chat-messages-stream">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const hasActions = msg.executedActions && msg.executedActions.length > 0;

            return (
              <div
                key={index}
                className={`chat-message-row ${isUser ? 'user-row' : 'bot-row'}`}
              >
                {!isUser && (
                  <div className="chat-avatar bot-avatar">
                    <Bot size={20} />
                  </div>
                )}

                <div className="chat-content-wrap">
                  {/* Executed Action Badge */}
                  {hasActions && (
                    <div className="chat-action-badge">
                      <Zap size={13} color="#3182ce" />
                      {msg.executedActions.map((a, i) => (
                        <span key={i}>⚡ {a.message}</span>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`chat-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
                    <FormattedMessage text={msg.content} />
                  </div>

                  {/* Message Metadata & Action Buttons */}
                  <div className="chat-meta-row">
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.source && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#6e00fa', fontWeight: 600 }}>{msg.source}</span>
                      </>
                    )}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, index)}
                        title="Copy text"
                        className="chat-copy-btn"
                      >
                        {copiedIndex === index ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="chat-avatar user-avatar">
                    <User size={20} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="chat-loading-row">
              <div className="chat-avatar bot-avatar pulse">
                <Bot size={20} />
              </div>
              <div className="chat-loading-text">
                <Sparkles size={14} color="#6e00fa" />
                <span>Consulting live telemetry & Orbit AI...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Chips */}
        <div className="chat-quick-actions-bar">
          {quickActions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              className="chat-quick-action-btn"
              onClick={() => handleSend(act.query)}
              disabled={loading}
            >
              {act.icon}
              <span>{act.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="chat-input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command (e.g. 'Turn on Light 1', 'Room temperature?')..."
            disabled={loading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={loading || !input.trim()}
            title="Send Message"
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
