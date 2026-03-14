import { useState, useCallback } from 'react';
import { SUPPORTED_LANGUAGES } from '../types';
import { t } from '../i18n';
import { createCall } from '../utils/api';
import VideoCall from './VideoCall';
import Logo from './Logo';

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

  const i18n = t(language);

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
        <div className="logo"><Logo /></div>
        <h1>parlez.me</h1>
        <p className="subtitle">{i18n.ephemeralCalls}</p>

        <div className="form-group">
          <label htmlFor="language">🌐 {i18n.yourLanguage}</label>
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

        <div className="form-group">
          <label htmlFor="nickname">{i18n.yourNickname}</label>
          <input
            id="nickname"
            type="text"
            placeholder={i18n.enterYourName}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? i18n.joining : i18n.createCallLink}
        </button>

        <p className="hint">
          {i18n.noSignupNeeded}
        </p>

        <p className="home-screen-tip">
          📱 {i18n.addToHomeScreen.split('\n').map((line, i) => (
            <span key={i}>{i > 0 && <br />}{line}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
