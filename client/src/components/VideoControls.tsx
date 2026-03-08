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
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <button
        className={`control-btn ${isCameraOff ? 'active' : ''}`}
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
      >
        {isCameraOff ? 'Camera on' : 'Camera off'}
      </button>

      <button
        className="control-btn end-call"
        onClick={onEndCall}
        title="End call"
      >
        End
      </button>

      {isCreator && (
        <button
          className="control-btn expire-link"
          onClick={onEndAndExpire}
          title="End call and expire the link permanently"
        >
          Expire
        </button>
      )}
    </div>
  );
}
