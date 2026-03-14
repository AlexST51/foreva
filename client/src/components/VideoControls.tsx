import { useState } from 'react';
import { Translations } from '../i18n';

interface VideoControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isCreator: boolean;
  isBlurEnabled: boolean;
  isBlurLoading: boolean;
  isFrontCamera: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleBlur: () => void;
  onFlipCamera: () => void;
  onEndCall: () => void;
  onEndAndExpire: () => void;
  i18n: Translations;
}

export default function VideoControls({
  isMuted,
  isCameraOff,
  isCreator,
  isBlurEnabled,
  isBlurLoading,
  isFrontCamera,
  onToggleMute,
  onToggleCamera,
  onToggleBlur,
  onFlipCamera,
  onEndCall,
  onEndAndExpire,
  i18n,
}: VideoControlsProps) {
  const [confirmAction, setConfirmAction] = useState<'end' | 'expire' | null>(null);

  const handleEndClick = () => setConfirmAction('end');
  const handleExpireClick = () => setConfirmAction('expire');

  const handleConfirm = () => {
    if (confirmAction === 'end') onEndCall();
    else if (confirmAction === 'expire') onEndAndExpire();
    setConfirmAction(null);
  };

  const handleCancel = () => setConfirmAction(null);

  return (
    <>
      <div className="video-controls">
        <button
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? i18n.unmute : i18n.mute}
        >
          {isMuted ? i18n.unmute : i18n.mute}
        </button>

        <button
          className={`control-btn ${isCameraOff ? 'active' : ''}`}
          onClick={onToggleCamera}
          title={isCameraOff ? i18n.cameraOn : i18n.cameraOff}
        >
          {isCameraOff ? i18n.cameraOn : i18n.cameraOff}
        </button>

        <button
          className={`control-btn ${isBlurEnabled ? 'active' : ''}`}
          onClick={onToggleBlur}
          disabled={isBlurLoading}
          title={isBlurEnabled ? i18n.blurOff : i18n.blurOn}
        >
          {isBlurLoading ? '⏳' : isBlurEnabled ? i18n.blurOff : i18n.blurOn}
        </button>

        <button
          className="control-btn"
          onClick={onFlipCamera}
          title={i18n.flipCamera}
        >
          🔄 {i18n.flipCamera}
        </button>

        <button
          className="control-btn end-call"
          onClick={handleEndClick}
          title={i18n.endCallTitle}
        >
          {i18n.end}
        </button>

        {isCreator && (
          <button
            className="control-btn expire-link"
            onClick={handleExpireClick}
            title={i18n.expireLinkTitle}
          >
            {i18n.expire}
          </button>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="confirm-overlay" onClick={handleCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">
              {confirmAction === 'end' ? i18n.confirmEndCall : i18n.confirmExpireLink}
            </p>
            <div className="confirm-buttons">
              <button className="btn btn-secondary confirm-cancel" onClick={handleCancel}>
                {i18n.cancel}
              </button>
              <button
                className={`btn ${confirmAction === 'expire' ? 'confirm-expire' : 'confirm-end'}`}
                onClick={handleConfirm}
              >
                {confirmAction === 'end' ? i18n.end : i18n.expire}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
