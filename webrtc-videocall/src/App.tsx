import { useState, useCallback, useRef, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Snackbar, Alert } from '@mui/material';
import { JoinRoom } from '@/components/JoinRoom';
import { VideoCall } from '@/components/VideoCall';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC, type DataChannelMessage } from '@/hooks/useWebRTC';
import { useScreenShare } from '@/hooks/useScreenShare';
import { useVirtualBackground, type BackgroundOption } from '@/hooks/useVirtualBackground';
import { useSpeechCaptions } from '@/hooks/useSpeechCaptions';
import type { WhiteboardHandle } from '@/components/Whiteboard';
import type { AppState, Role, SignalingMessage, LogEntry } from '@/types';

const MAX_LOG_ENTRIES = 500;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#102216', paper: '#102216' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
  },
});

function getSignalingUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

function App() {
  const [state, setState] = useState<AppState>('idle');
  const [roomId, setRoomId] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roleRef = useRef<Role | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const whiteboardRef = useRef<WhiteboardHandle>(null);

  // Keep localStreamRef in sync with state
  localStreamRef.current = localStream;

  const addLog = useCallback((source: LogEntry['source'], message: string, direction?: LogEntry['direction']) => {
    setLogs((prev) => {
      const next = [...prev, { timestamp: Date.now(), source, direction, message }];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const onLog = useCallback((source: 'ws', direction: 'send' | 'recv', message: string) => {
    addLog(source, message, direction);
  }, [addLog]);

  const onPcLog = useCallback((source: 'pc' | 'ice', message: string) => {
    addLog(source, message);
  }, [addLog]);

  const handleDataChannelMessage = useCallback((msg: DataChannelMessage) => {
    switch (msg.type) {
      case 'wb-open':
        setIsWhiteboardOpen(true);
        addLog('pc', 'remote peer opened whiteboard');
        break;
      case 'wb-close':
        setIsWhiteboardOpen(false);
        addLog('pc', 'remote peer closed whiteboard');
        break;
      case 'wb-element':
        whiteboardRef.current?.addRemoteElement(msg.element as never);
        break;
      case 'wb-undo':
        whiteboardRef.current?.remoteUndo();
        break;
      case 'wb-clear':
        whiteboardRef.current?.remoteClear();
        break;
    }
  }, [addLog]);

  const screenShare = useScreenShare({ onLog: onPcLog });
  const screenShareRef = useRef(screenShare);
  screenShareRef.current = screenShare;

  const virtualBg = useVirtualBackground({ onLog: onPcLog });
  const virtualBgRef = useRef(virtualBg);
  virtualBgRef.current = virtualBg;

  const speechCaptions = useSpeechCaptions({ lang: 'zh-CN', onLog: onPcLog });

  // Use refs for rtc and signaling to break stale closure chains
  const rtcRef = useRef<ReturnType<typeof useWebRTC>>(null!);
  const signalingRef = useRef<ReturnType<typeof useSignaling>>(null!);

  const handleEndCall = useCallback(() => {
    screenShareRef.current.stopScreenShare(pcRef.current, localStreamRef.current);
    virtualBgRef.current.cleanup();
    rtcRef.current.cleanup();
    signalingRef.current.disconnect();
    setRemoteStream(null);
    setLocalStream(null);
    setState('idle');
    roleRef.current = null;
    pcRef.current = null;
    setIsWhiteboardOpen(false);
    addLog('ui', 'call ended');
  }, [addLog]);

  const handleEndCallRef = useRef(handleEndCall);
  handleEndCallRef.current = handleEndCall;

  const handleSignalingMessage = useCallback((msg: SignalingMessage) => {
    switch (msg.type) {
      case 'joined': {
        const r = msg.role!;
        roleRef.current = r;
        if (msg.participants === 1) {
          setState('waiting');
        } else {
          setState('connecting');
        }
        break;
      }
      case 'full':
        setError('Room is full. Please try a different room ID.');
        setState('idle');
        break;
      case 'peer-joined':
        setState('connecting');
        if (roleRef.current === 'caller') {
          rtcRef.current.createOffer();
        }
        break;
      case 'offer':
        rtcRef.current.handleOffer(msg.sdp!);
        break;
      case 'answer':
        rtcRef.current.handleAnswer(msg.sdp!);
        break;
      case 'candidate':
        rtcRef.current.handleCandidate(msg.candidate!);
        break;
      case 'hangup':
      case 'peer-left':
        addLog('ui', 'peer disconnected');
        handleEndCallRef.current();
        break;
    }
  }, [addLog]);

  const signaling = useSignaling({ onMessage: handleSignalingMessage, onLog });
  signalingRef.current = signaling;

  const rtc = useWebRTC({
    onRemoteStream: (stream) => {
      setRemoteStream(stream);
      setState('connected');
    },
    onIceStateChange: (iceState) => {
      if (iceState === 'connected' || iceState === 'completed') {
        setState('connected');
      }
      if (iceState === 'disconnected' || iceState === 'failed') {
        addLog('ice', `connection ${iceState}`);
      }
    },
    send: signaling.send,
    onLog: onPcLog,
    roomId,
    onPeerConnection: (pc) => { pcRef.current = pc; },
    onDataChannelMessage: handleDataChannelMessage,
  });
  rtcRef.current = rtc;

  const handleJoin = useCallback(async (rid: string) => {
    try {
      setState('joining');
      setRoomId(rid);
      setLogs([]);
      addLog('ui', `joining room: ${rid}`);

      const stream = await rtcRef.current.getLocalStream();
      setLocalStream(stream);

      await signalingRef.current.connect(getSignalingUrl());
      signalingRef.current.send({ type: 'join', roomId: rid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join';
      setError(msg);
      setState('idle');
      addLog('ui', `error: ${msg}`);
    }
  }, [addLog]);

  const handleHangup = useCallback(() => {
    signalingRef.current.send({ type: 'hangup', roomId });
    signalingRef.current.disconnect();
    handleEndCallRef.current();
  }, [roomId]);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled(prev => {
      const next = !prev;
      rtcRef.current.toggleAudio(next);
      return next;
    });
  }, []);

  const handleToggleVideo = useCallback(() => {
    setVideoEnabled(prev => {
      const next = !prev;
      rtcRef.current.toggleVideo(next);
      return next;
    });
  }, []);

  const handleToggleScreenShare = useCallback(async () => {
    if (screenShareRef.current.isSharing) {
      await screenShareRef.current.stopScreenShare(pcRef.current, localStreamRef.current);
    } else {
      await screenShareRef.current.startScreenShare(pcRef.current, localStreamRef.current);
    }
  }, []);

  const handleToggleWhiteboard = useCallback(() => {
    setIsWhiteboardOpen(prev => {
      const next = !prev;
      addLog('ui', next ? 'whiteboard opened' : 'whiteboard closed');
      rtcRef.current.sendDataChannelMessage({ type: next ? 'wb-open' : 'wb-close' });
      return next;
    });
  }, [addLog]);

  const handleSelectFilter = useCallback(async (option: BackgroundOption) => {
    await virtualBgRef.current.applyOption(option, localStreamRef.current, pcRef.current);
  }, []);

  const handleWbElementAdd = useCallback((element: unknown) => {
    rtcRef.current.sendDataChannelMessage({ type: 'wb-element', element });
  }, []);

  const handleWbUndo = useCallback(() => {
    rtcRef.current.sendDataChannelMessage({ type: 'wb-undo' });
  }, []);

  const handleWbClear = useCallback(() => {
    rtcRef.current.sendDataChannelMessage({ type: 'wb-clear' });
  }, []);

  const isInCall = state !== 'idle' && state !== 'ended';

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {isInCall ? (
        <VideoCall
          state={state}
          roomId={roomId}
          localStream={virtualBg.processedStream || localStream}
          remoteStream={remoteStream}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          logs={logs}
          isScreenSharing={screenShare.isSharing}
          isWhiteboardOpen={isWhiteboardOpen}
          activeFilterId={virtualBg.activeOption.id}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleWhiteboard={handleToggleWhiteboard}
          onSelectFilter={handleSelectFilter}
          onHangup={handleHangup}
          whiteboardRef={whiteboardRef}
          onWhiteboardElementAdd={handleWbElementAdd}
          onWhiteboardUndo={handleWbUndo}
          onWhiteboardClear={handleWbClear}
          captionsEnabled={speechCaptions.enabled}
          captionsSupported={speechCaptions.isSupported}
          captions={speechCaptions.captions}
          onToggleCaptions={speechCaptions.toggle}
        />
      ) : (
        <JoinRoom onJoin={handleJoin} isConnecting={state === 'joining' as AppState} />
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
