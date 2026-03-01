import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatOverlayProps {
  messages: ChatMessage[];
  myLanguage: string;
  userId: string;
  onSendMessage: (text: string) => void;
}

export default function ChatOverlay({ messages, myLanguage, userId, onSendMessage }: ChatOverlayProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Display rule for dual-language messages:
   * Always show original text on top, translation below.
   */
  function formatMessage(msg: ChatMessage) {
    const primary = msg.originalText;
    const secondary = msg.translatedText;
    const label = `${msg.originalLanguage} → ${msg.translatedLanguage}`;

    return { primary, secondary, label };
  }

  // Show last N messages in collapsed mode
  const displayMessages = isExpanded ? messages : messages.slice(-5);

  return (
    <div className={`chat-overlay ${isExpanded ? 'expanded' : ''}`}>
      <div className="chat-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span>💬 Chat {messages.length > 0 && `(${messages.length})`}</span>
        <span className="chat-toggle">{isExpanded ? '▼' : '▲'}</span>
      </div>

      <div className="chat-messages">
        {displayMessages.map((msg) => {
          const { primary, secondary, label } = formatMessage(msg);
          const isOwn = msg.senderId === userId;

          return (
            <div key={msg.id} className={`chat-bubble ${isOwn ? 'own' : 'peer'}`}>
              {msg.originalLanguage !== msg.translatedLanguage ? (
                <>
                  <div className="chat-secondary">
                    {primary}
                  </div>
                  <div className="chat-primary">
                    {secondary}
                  </div>
                </>
              ) : (
                <div className="chat-primary">{primary}</div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-input"
        />
        <button className="btn btn-send" onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
