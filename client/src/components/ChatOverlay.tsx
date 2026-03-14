import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../types';
import { Translations } from '../i18n';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatOverlayProps {
  messages: ChatMessage[];
  myLanguage: string;
  userId: string;
  onSendMessage: (text: string) => void;
  i18n: Translations;
}

export default function ChatOverlay({ messages, myLanguage, userId, onSendMessage, i18n }: ChatOverlayProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, interimText, isSupported, toggleListening } = useSpeechRecognition(myLanguage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prevent mobile keyboard from resizing the layout
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // When keyboard opens on mobile, scroll input into view
      if (document.activeElement === inputRef.current) {
        inputRef.current?.scrollIntoView({ block: 'nearest' });
      }
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    // Keep focus on input after sending so keyboard stays open on mobile
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Callback for when speech recognition produces a final result
  const handleSpeechFinal = useCallback((text: string) => {
    if (text.trim()) {
      onSendMessage(text.trim());
    }
  }, [onSendMessage]);

  const handleMicClick = () => {
    toggleListening(handleSpeechFinal);
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
        <span>💬 {i18n.chat} {messages.length > 0 && `(${messages.length})`}</span>
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

      {/* Interim speech text preview */}
      {isListening && interimText && (
        <div className="speech-interim">
          {interimText}
        </div>
      )}

      <div className="chat-input-row">
        {isSupported && (
          <button
            className={`btn-mic ${isListening ? 'listening' : ''}`}
            onClick={handleMicClick}
            title={isListening ? i18n.stopListening : i18n.voiceInput}
          >
            {isListening ? '⏹' : '🎤'}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder={isListening ? i18n.listening : i18n.typeMessage}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-input"
        />
        <button className="btn btn-send" onClick={handleSend} disabled={!input.trim()}>
          {i18n.send}
        </button>
      </div>
    </div>
  );
}
