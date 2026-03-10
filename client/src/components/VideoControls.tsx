import { Translations } from '../i18n';

interface VideoControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isCreator: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  onEndAndExpire: () => void;
  i18n: Translations;
}

export default function VideoControls({
  isMuted,
  isCameraOff,
  isCreator,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  onEndAndExpire,
  i18n,
}: VideoControlsProps) {
  return (
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
        className="control-btn end-call"
        onClick={onEndCall}
        title={i18n.endCallTitle}
      >
        {i18n.end}
      </button>

      {isCreator && (
        <button
          className="control-btn expire-link"
          onClick={onEndAndExpire}
          title={i18n.expireLinkTitle}
        >
          {i18n.expire}
        </button>
      )}
    </div>
  );
}
