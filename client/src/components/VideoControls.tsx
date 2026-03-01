interface VideoControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isCreator: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  onEndAndExpire: () => void;
}

export default function VideoControls({
  isMuted,
  isCameraOff,
  isCreator,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  onEndAndExpire,
}: VideoControlsProps) {
  return (
    <div className="video-controls">
      <button
        className={`control-btn ${isMuted ? 'active' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
        <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      <button
        className={`control-btn ${isCameraOff ? 'active' : ''}`}
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
      >
        {isCameraOff ? '📷' : '📹'}
        <span className="control-label">{isCameraOff ? 'Camera on' : 'Camera off'}</span>
      </button>

      <button
        className="control-btn end-call"
        onClick={onEndCall}
        title="End call"
      >
        📞
        <span className="control-label">End call</span>
      </button>

      {isCreator && (
        <button
          className="control-btn expire-link"
          onClick={onEndAndExpire}
          title="End call and expire the link permanently"
        >
          🚫
          <span className="control-label">End & expire</span>
        </button>
      )}
    </div>
  );
}
