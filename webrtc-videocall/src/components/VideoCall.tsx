import { useRef, useEffect, useState, useCallback, type Ref } from 'react';
import { Typography, Chip } from '@mui/material';
import { FiberManualRecord, VideocamOutlined, ScreenShareOutlined } from '@mui/icons-material';
import { ControlBar } from './ControlBar';
import { DebugLog } from './DebugLog';
import { FilterPopup } from './FilterPopup';
import { Whiteboard, type WhiteboardHandle, type DrawElement } from './Whiteboard';
import { ErrorBoundary } from './ErrorBoundary';
import type { AppState, LogEntry, ViewTab } from '@/types';
import type { BackgroundOption } from '@/hooks/useVirtualBackground';
import type { CaptionLine } from '@/hooks/useSpeechCaptions';

interface VideoCallProps {
  state: AppState;
  roomId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  logs: LogEntry[];
  isScreenSharing: boolean;
  isWhiteboardOpen: boolean;
  activeFilterId: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleWhiteboard: () => void;
  onSelectFilter: (option: BackgroundOption) => void;
  onHangup: () => void;
  whiteboardRef?: Ref<WhiteboardHandle>;
  onWhiteboardElementAdd?: (element: DrawElement) => void;
  onWhiteboardUndo?: () => void;
  onWhiteboardClear?: () => void;
  captionsEnabled: boolean;
  captionsSupported: boolean;
  captions: CaptionLine[];
  onToggleCaptions: () => void;
}

export function VideoCall({
  state,
  roomId,
  localStream,
  remoteStream,
  audioEnabled,
  videoEnabled,
  logs,
  isScreenSharing,
  isWhiteboardOpen,
  activeFilterId,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleWhiteboard,
  onSelectFilter,
  onHangup,
  whiteboardRef,
  onWhiteboardElementAdd,
  onWhiteboardUndo,
  onWhiteboardClear,
  captionsEnabled,
  captionsSupported,
  captions,
  onToggleCaptions,
}: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('video');
  const [filterOpen, setFilterOpen] = useState(false);

  // Callback ref ensures srcObject is set immediately when the video element mounts
  const localVideoCallbackRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      if (el && localStream) {
        el.srcObject = localStream;
      }
    },
    [localStream],
  );

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    return () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  // Keep a hidden <audio> element always playing remote audio,
  // so audio is never lost when the <video> element unmounts (e.g. whiteboard mode).
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  // Defensive: ensure local video srcObject stays in sync
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  // Auto-switch to screen tab when screen sharing starts from remote
  useEffect(() => {
    if (isScreenSharing) {
      setActiveTab('screen');
    } else {
      setActiveTab('video');
    }
  }, [isScreenSharing]);

  const isWaiting = state === 'waiting' || state === 'joining';
  const isConnecting = state === 'connecting';
  const isConnected = state === 'connected';

  const showWhiteboard = isWhiteboardOpen && !isScreenSharing;

  // Debug: track localStream to investigate PiP disappearing
  useEffect(() => {
    console.log(`[VideoCall] localStream=${localStream ? 'MediaStream' : 'null'} state=${state} remoteStream=${remoteStream ? 'yes' : 'no'}`);
  }, [localStream, state, remoteStream]);

  return (
    <div
      className="relative w-screen h-screen bg-[#102216] flex flex-col overflow-hidden select-none"
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Hidden audio element — keeps remote audio playing even when video is unmounted (whiteboard/screen modes) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none h-32" />
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-6 py-4 pointer-events-none">
        {/* Left: title + status */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-xl tracking-tight">
              {roomId}
            </h1>
            {isConnected && (
              <Chip
                icon={<FiberManualRecord sx={{ fontSize: 8, color: '#13ec5b !important' }} />}
                label="CONNECTED"
                size="small"
                sx={{
                  bgcolor: 'rgba(19,236,91,0.2)',
                  color: '#13ec5b',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.06em',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
          </div>
          <span className="text-[#94a3b8] text-sm font-medium">{roomId}</span>
        </div>

        {/* Tab switcher — only show when screen sharing or whiteboard is active */}
        {isConnected && (isScreenSharing || isWhiteboardOpen) && (
          <div className="flex items-center bg-[rgba(15,23,42,0.85)] backdrop-blur-xl rounded-2xl p-1.5 border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.4)] pointer-events-auto">
            <button
              onClick={() => setActiveTab('video')}
              aria-label="Switch to video view"
              aria-pressed={activeTab === 'video'}
              className={`flex items-center gap-2.5 px-7 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'video'
                  ? 'bg-[#13ec5b] text-[#0f172a] shadow-[0_2px_8px_rgba(19,236,91,0.3)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <VideocamOutlined sx={{ fontSize: 18 }} />
              Video
            </button>
            <button
              onClick={() => setActiveTab('screen')}
              aria-label="Switch to screen share view"
              aria-pressed={activeTab === 'screen'}
              className={`flex items-center gap-2.5 px-7 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'screen'
                  ? 'bg-[#13ec5b] text-[#0f172a] shadow-[0_2px_8px_rgba(19,236,91,0.3)]'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <ScreenShareOutlined sx={{ fontSize: 18 }} />
              Screen
            </button>
          </div>
        )}

        {/* Right: info buttons (placeholder) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-10 h-10 rounded-full bg-[rgba(30,41,59,0.5)] flex items-center justify-center text-white font-bold text-sm border-2 border-white/10">
            {roomId.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Main video area */}
      <div className="flex-1 px-4 pt-20 pb-24">
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#0f172a] shadow-2xl">
          {/* Remote video or waiting state */}
          {showWhiteboard ? (
            <ErrorBoundary>
              <Whiteboard
                ref={whiteboardRef}
                className="w-full h-full"
                onElementAdd={onWhiteboardElementAdd}
                onUndo={onWhiteboardUndo}
                onClear={onWhiteboardClear}
              />
            </ErrorBoundary>
          ) : remoteStream && activeTab === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : remoteStream && activeTab === 'screen' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              {isWaiting && (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-[#13ec5b]/30 border-t-[#13ec5b] animate-spin" />
                  <Typography sx={{ color: '#94a3b8', fontSize: '1rem' }}>
                    Waiting for the other participant...
                  </Typography>
                </>
              )}
              {isConnecting && (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-[#a78bfa]/30 border-t-[#a78bfa] animate-spin" />
                  <Typography sx={{ color: '#94a3b8', fontSize: '1rem' }}>
                    Establishing connection...
                  </Typography>
                </>
              )}
            </div>
          )}

          {/* Remote name badge */}
          {remoteStream && !showWhiteboard && (
            <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 rounded-xl bg-[rgba(16,34,22,0.7)] backdrop-blur-md border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#13ec5b] animate-pulse" />
              <span className="text-white font-medium">Remote User</span>
            </div>
          )}

        </div>
      </div>

      {/* Local PiP — always visible during call, positioned above debug log */}
      {localStream && (
        <div
          className="fixed rounded-xl overflow-hidden border-2 border-[#13ec5b]/40 bg-[#1e293b]"
          style={{
            bottom: 420,
            right: 16,
            width: 200,
            height: 150,
            zIndex: 9999,
            boxShadow: '0 0 0 4px rgba(0,0,0,0.3), 0 25px 50px -12px rgba(0,0,0,0.4)',
          }}
        >
          <video
            ref={localVideoCallbackRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-[#0f172a] flex items-center justify-center">
              <span className="text-[#94a3b8] text-xs">Camera off</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-[rgba(16,34,22,0.7)] backdrop-blur-md border border-white/10">
            <span className="text-white text-[10px] font-medium">You</span>
          </div>
        </div>
      )}

      {/* Captions overlay */}
      {captionsEnabled && captions.length > 0 && (
        <div className="absolute bottom-28 left-[20%] right-[20%] z-10 pointer-events-none text-center">
          {captions.map((caption) => (
            <p
              key={caption.id}
              className="text-white text-2xl leading-9 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              style={{
                opacity: caption.isFinal ? 1 : 0.7,
                fontStyle: caption.isFinal ? 'normal' : 'italic',
              }}
            >
              {caption.text}
            </p>
          ))}
        </div>
      )}

      {/* Control bar */}
      <ControlBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        isWhiteboardOpen={isWhiteboardOpen}
        isFilterOpen={filterOpen}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onToggleWhiteboard={onToggleWhiteboard}
        onToggleFilter={() => setFilterOpen(!filterOpen)}
        captionsEnabled={captionsEnabled}
        captionsSupported={captionsSupported}
        onToggleCaptions={onToggleCaptions}
        onHangup={onHangup}
      />

      {/* Filter popup */}
      <FilterPopup
        open={filterOpen}
        activeOptionId={activeFilterId}
        onSelect={(opt) => {
          onSelectFilter(opt);
        }}
        onClose={() => setFilterOpen(false)}
      />

      {/* Debug log */}
      <DebugLog logs={logs} />
    </div>
  );
}
