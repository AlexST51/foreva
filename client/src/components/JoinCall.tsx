import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from '../types';
import { t, tReplace } from '../i18n';
import { getCallStatus } from '../utils/api';
import VideoCall from './VideoCall';

export default function JoinCall() {
  const { token } = useParams<{ token: string }>();
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Generate a userId for this receiver
  const [userId] = useState(() => crypto.randomUUID());

  // Check call status on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid call link');
      setLoading(false);
      return;
    }

    getCallStatus(token)
      .then((status) => {
        if (status.state === 'closed') {
          setError('This call link has expired');
        } else {
          setCreatorName(status.creatorName || null);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to check call status');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleJoin = useCallback(() => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    setJoining(true);
    setJoined(true);
  }, [nickname]);

  const i18n = t(language);

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <div className="logo">📞</div>
          <h1>Foreva</h1>
          <p className="subtitle">{i18n.checkingLink}</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error && !joined) {
    return (
      <div className="page">
        <div className="card">
          <div className="logo">📞</div>
          <h1>Foreva</h1>
          <div className="error-message">{error}</div>
          <a href="/" className="btn btn-secondary" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
            {i18n.createCallLink}
          </a>
        </div>
      </div>
    );
  }

  if (joined && token) {
    return (
      <VideoCall
        roomId=""
        joinToken={token}
        userId={userId}
        nickname={nickname.trim()}
        language={language}
        role="receiver"
      />
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="logo">📞</div>
        <h1>Foreva</h1>
        {creatorName && (
          <p className="subtitle">
            <strong>{tReplace(i18n.isWaitingForYou, { name: creatorName })}</strong>
          </p>
        )}

        <div className="form-group">
          <label htmlFor="nickname">{i18n.yourNickname}</label>
          <input
            id="nickname"
            type="text"
            placeholder={i18n.enterYourName}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>

        <div className="form-group">
          <label htmlFor="language">{i18n.yourLanguage}</label>
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
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? i18n.joining : i18n.joinCall}
        </button>
      </div>
    </div>
  );
}
