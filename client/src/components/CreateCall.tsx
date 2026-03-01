import { useState, useCallback } from 'react';
import { SUPPORTED_LANGUAGES } from '../types';
import { createCall } from '../utils/api';
import VideoCall from './VideoCall';

export default function CreateCall() {
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After creation
  const [callData, setCallData] = useState<{
    roomId: string;
    joinToken: string;
    callUrl: string;
    userId: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createCall(nickname.trim(), language);
      setCallData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create call');
    } finally {
      setLoading(false);
    }
  }, [nickname, language]);

  const handleCopy = useCallback(async () => {
    if (!callData) return;
    try {
      await navigator.clipboard.writeText(callData.callUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = callData.callUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [callData]);

  // If call has been created, show the VideoCall component
  if (callData) {
    return (
      <VideoCall
        roomId={callData.roomId}
        joinToken={callData.joinToken}
        userId={callData.userId}
        nickname={nickname.trim()}
        language={language}
        role="creator"
        callUrl={callData.callUrl}
        onCopyLink={handleCopy}
        copied={copied}
      />
    );
  }

  // Initial form
  return (
    <div className="page">
      <div className="card">
        <div className="logo">📞</div>
        <h1>Foreva</h1>
        <p className="subtitle">Ephemeral 1:1 video calls with dual-language chat</p>

        <div className="form-group">
          <label htmlFor="nickname">Your nickname</label>
          <input
            id="nickname"
            type="text"
            placeholder="Enter your name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div className="form-group">
          <label htmlFor="language">Your language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? 'Creating…' : '🔗 Create call-me link'}
        </button>

        <p className="hint">
          No sign-up needed. Create a link, share it, and start a video call.
        </p>
      </div>
    </div>
  );
}
