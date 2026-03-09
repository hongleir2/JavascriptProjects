import { IconButton, Tooltip } from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  AutoFixHigh,
  Dashboard,
  CallEnd,
  Settings,
  ClosedCaption,
  ClosedCaptionDisabled,
} from '@mui/icons-material';

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isWhiteboardOpen: boolean;
  isFilterOpen: boolean;
  captionsEnabled: boolean;
  captionsSupported: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleWhiteboard: () => void;
  onToggleFilter: () => void;
  onToggleCaptions: () => void;
  onHangup: () => void;
}

const btnBase = {
  width: 48,
  height: 48,
  borderRadius: '9999px',
  border: '1px solid rgba(255,255,255,0.05)',
  transition: 'all 0.2s ease',
} as const;

const defaultBtn = {
  ...btnBase,
  backgroundColor: 'rgba(51,65,85,0.4)',
  color: '#fff',
  '&:hover': {
    backgroundColor: 'rgba(51,65,85,0.7)',
    transform: 'scale(1.05)',
  },
};

const activeBtn = {
  ...btnBase,
  backgroundColor: 'rgba(19,236,91,0.15)',
  color: '#13ec5b',
  border: '1px solid rgba(19,236,91,0.3)',
  '&:hover': {
    backgroundColor: 'rgba(19,236,91,0.25)',
    transform: 'scale(1.05)',
  },
};

const mutedBtn = {
  ...btnBase,
  backgroundColor: 'rgba(239,68,68,0.15)',
  color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.2)',
  '&:hover': {
    backgroundColor: 'rgba(239,68,68,0.25)',
    transform: 'scale(1.05)',
  },
};

const hangupBtn = {
  ...btnBase,
  backgroundColor: '#ef4444',
  color: '#fff',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgba(239,68,68,0.2), 0 4px 6px -4px rgba(239,68,68,0.2)',
  '&:hover': {
    backgroundColor: '#dc2626',
    transform: 'scale(1.08)',
  },
};

export function ControlBar({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  isWhiteboardOpen,
  isFilterOpen,
  captionsEnabled,
  captionsSupported,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleWhiteboard,
  onToggleFilter,
  onToggleCaptions,
  onHangup,
}: ControlBarProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-[rgba(16,34,22,0.7)] backdrop-blur-md border border-white/10 shadow-2xl">
        {/* Mic */}
        <Tooltip title={audioEnabled ? 'Mute' : 'Unmute'} arrow>
          <IconButton onClick={onToggleAudio} sx={audioEnabled ? defaultBtn : mutedBtn}>
            {audioEnabled ? <Mic sx={{ fontSize: 19 }} /> : <MicOff sx={{ fontSize: 19 }} />}
          </IconButton>
        </Tooltip>

        {/* Camera */}
        <Tooltip title={videoEnabled ? 'Turn off camera' : 'Turn on camera'} arrow>
          <IconButton onClick={onToggleVideo} sx={videoEnabled ? defaultBtn : mutedBtn}>
            {videoEnabled ? <Videocam sx={{ fontSize: 20 }} /> : <VideocamOff sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>

        {/* Screen Share */}
        <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'} arrow>
          <IconButton
            onClick={onToggleScreenShare}
            sx={isScreenSharing ? activeBtn : defaultBtn}
            disabled={isWhiteboardOpen}
          >
            {isScreenSharing ? <StopScreenShare sx={{ fontSize: 20 }} /> : <ScreenShare sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>

        {/* Whiteboard */}
        <Tooltip title={isWhiteboardOpen ? 'Close whiteboard' : 'Open whiteboard'} arrow>
          <IconButton
            onClick={onToggleWhiteboard}
            sx={isWhiteboardOpen ? activeBtn : defaultBtn}
            disabled={isScreenSharing}
          >
            <Dashboard sx={{ fontSize: 21 }} />
          </IconButton>
        </Tooltip>

        {/* Filter / Virtual Background */}
        <Tooltip title="Background effects" arrow>
          <IconButton
            onClick={onToggleFilter}
            sx={isFilterOpen ? activeBtn : defaultBtn}
          >
            <AutoFixHigh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Captions */}
        {captionsSupported && (
          <Tooltip title={captionsEnabled ? 'Turn off captions' : 'Turn on captions'} arrow>
            <IconButton onClick={onToggleCaptions} sx={captionsEnabled ? activeBtn : defaultBtn}>
              {captionsEnabled ? <ClosedCaption sx={{ fontSize: 20 }} /> : <ClosedCaptionDisabled sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        )}

        {/* Settings (placeholder) */}
        <Tooltip title="Settings" arrow>
          <IconButton sx={defaultBtn} disabled>
            <Settings sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Hangup */}
        <Tooltip title="Leave call" arrow>
          <IconButton onClick={onHangup} sx={hangupBtn}>
            <CallEnd sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
