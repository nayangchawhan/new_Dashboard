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
  Activity
} from 'lucide-react';
import { sendChatMessage } from '../services/api';

/**
 * Lightweight Markdown Formatter component for clean, rich message rendering
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  // Split lines
  const lines = text.split('\n');

  return (
    <div className="chat-markdown" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

        // Header ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} style={{ margin: '4px 0 2px 0', fontSize: '15px', fontWeight: 700, color: '#2b2c34' }}>
              {formatInline(trimmed.substring(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} style={{ margin: '6px 0 2px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
              {formatInline(trimmed.substring(3))}
            </h3>
          );
        }

        // Horizontal Rule
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '6px 0' }} />;
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginLeft: '4px' }}>
              <span style={{ color: '#6e00fa', fontWeight: 'bold' }}>•</span>
              <span style={{ flex: 1 }}>{formatInline(trimmed.substring(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginLeft: '4px' }}>
              <span style={{ color: '#6e00fa', fontWeight: 'bold', minWidth: '16px' }}>{numMatch[1]}.</span>
              <span style={{ flex: 1 }}>{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} style={{ margin: 0 }}>
            {formatInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italic (*text*), inline code (`code`), and key-values
 */
function formatInline(text) {
  // Regex to split by bold (**...**) and inline code (`...`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function ChatbotPage({ telemetry }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 **Hello!** I am your **Orbit AI Assistant**.\n\nI have live direct access to your real-time **Firebase telemetry**, **device controls**, and **live weather forecast**.\n\nYou can ask me for live status updates, weather/rain forecasts, or give voice/chat commands like *"Turn on Light 1"*, *"Enable Safe Mode"*, or *"Will it rain today?"*',
      source: 'orbit-ai',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef(null);

  // Categorized quick suggestions
  const quickActions = [
    { label: '📊 Home Status', query: 'Show overall home status summary', icon: <Activity size={13} /> },
    { label: '🌧️ Rain & Umbrella', query: 'Will it rain today? Is an umbrella required for today?', icon: <Sparkles size={13} /> },
    { label: '🌡️ Room & Hub Temp', query: 'What is the current temperature and hub temperature?', icon: <Thermometer size={13} /> },
    { label: '💡 Turn ON Light 1', query: 'Turn on Light 1', icon: <Lightbulb size={13} /> },
    { label: '💡 Turn OFF All Lights', query: 'Turn off all lights', icon: <Lightbulb size={13} /> },
    { label: '🔒 Toggle Safe Mode', query: 'Toggle Safe Mode master switch', icon: <Shield size={13} /> },
    { label: '🔋 Battery & Power', query: 'What is the sensor battery level and health?', icon: <Battery size={13} /> },
    { label: '⏰ Check Schedule', query: 'What is the current automated light schedule?', icon: <Clock size={13} /> }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_~]/g, '').replace(/💡|🌡️|🔋|🖥️|🔒|⚡|👋|📊|💧|🚶|✅|⚠️|🚨|🌧️|☔|☀️|⛅/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      role: 'user',
      content: query,
      timestamp: time
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage(query, historyPayload);
      
      const assistantMsg = {
        role: 'assistant',
        content: res.message,
        source: 'orbit-ai',
        executedActions: res.executedActions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (ttsEnabled && res.message) {
        speakText(res.message);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error communicating with assistant backend:** ${err.message}`,
          error: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  const handleClear = () => {
    if (window.confirm('Clear conversation history?')) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setMessages([
        {
          role: 'assistant',
          content: '👋 Conversation cleared. How can I assist you with your smart home now?',
          source: 'orbit-ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Real-time Telemetry Status Ribbon */}
      <div style={{
        background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
        padding: '12px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#4a5568' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#6e00fa' }}>
            <Zap size={16} />
            <span>Orbit AI Active</span>
          </div>
          <span style={{ color: '#cbd5e0' }}>|</span>
          <span>🌡️ Room: <strong>{telemetry.temperature !== null ? `${telemetry.temperature}°C` : '--'}</strong></span>
          <span>🖥️ Hub: <strong>{telemetry.hubTemp !== null ? `${telemetry.hubTemp}°C` : '--'}</strong></span>
          <span>🔋 Battery: <strong>{telemetry.battery !== null ? `${telemetry.battery}%` : '--'}</strong></span>
          <span>🔒 Safe Mode: <strong>{telemetry.safeMode ? 'LOCKED' : 'OFF'}</strong></span>
          <span>💡 L1: <strong>{telemetry.light1 ? 'ON' : 'OFF'}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              if (isSpeaking) {
                window.speechSynthesis?.cancel();
                setIsSpeaking(false);
              } else {
                setTtsEnabled(!ttsEnabled);
              }
            }}
            title={ttsEnabled ? 'Voice Responses Enabled' : 'Voice Responses Disabled'}
            style={{
              background: ttsEnabled ? '#6e00fa' : '#edf2f7',
              color: ttsEnabled ? 'white' : '#4a5568',
              border: '1px solid #cbd5e0',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {ttsEnabled ? 'Voice ON' : 'Voice'}
          </button>

          <button
            onClick={handleClear}
            title="Clear Chat History"
            style={{
              background: '#fff5f5',
              color: '#c53030',
              border: '1px solid #fed7d7',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="card" style={{ height: '560px', display: 'flex', flexDirection: 'column', padding: '18px', position: 'relative' }}>
        
        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const hasActions = msg.executedActions && msg.executedActions.length > 0;

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                {!isUser && (
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6e00fa 0%, #9038ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(110, 0, 250, 0.25)'
                  }}>
                    <Bot size={22} />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  
                  {/* Executed Action Badge */}
                  {hasActions && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#ebf8ff',
                      color: '#2b6cb0',
                      border: '1px solid #bee3f8',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      <Zap size={13} color="#3182ce" />
                      {msg.executedActions.map((a, i) => (
                        <span key={i}>⚡ {a.message}</span>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div style={{
                    background: isUser ? 'linear-gradient(135deg, #6e00fa 0%, #8224fa 100%)' : '#f7fafc',
                    color: isUser ? 'white' : '#2d3748',
                    padding: '14px 18px',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: isUser ? '0 4px 12px rgba(110, 0, 250, 0.2)' : '0 2px 6px rgba(0,0,0,0.04)',
                    border: isUser ? 'none' : '1px solid #e2e8f0',
                    position: 'relative'
                  }}>
                    <FormattedMessage text={msg.content} />
                  </div>

                  {/* Message Metadata & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#a0aec0', padding: '0 4px' }}>
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.source && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#6e00fa', fontWeight: 600 }}>Orbit AI</span>
                      </>
                    )}
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        title="Copy text"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: copiedIndex === index ? '#38a169' : '#a0aec0',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '11px'
                        }}
                      >
                        {copiedIndex === index ? <Check size={12} /> : <Copy size={12} />}
                        {copiedIndex === index ? 'Copied' : ''}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: '#3182ce',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    <User size={22} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#718096', fontSize: '13px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6e00fa 0%, #9038ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                animation: 'pulse 1.5s infinite'
              }}>
                <Bot size={22} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="#6e00fa" />
                <span>Consulting Firebase telemetry & Orbit AI...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Chips */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '10px 0 6px 0',
          borderTop: '1px solid #edf2f7',
          marginTop: '10px'
        }}>
          {quickActions.map((act, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(act.query)}
              disabled={loading}
              style={{
                whiteSpace: 'nowrap',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                color: '#4a5568',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 500
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6e00fa';
                e.currentTarget.style.color = '#6e00fa';
                e.currentTarget.style.background = '#f5f0ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.color = '#4a5568';
                e.currentTarget.style.background = '#f8fafc';
              }}
            >
              {act.icon}
              {act.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '10px', marginTop: '8px' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command (e.g. 'Turn on Light 1', 'What is the temperature?')..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: '14px',
              border: '1px solid #cbd5e0',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: '#fafbfc'
            }}
            onFocus={(e) => e.target.style.borderColor = '#6e00fa'}
            onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: 'linear-gradient(135deg, #6e00fa 0%, #8224fa 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '0 24px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(110, 0, 250, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
