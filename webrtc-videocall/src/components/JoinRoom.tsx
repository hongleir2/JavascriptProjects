import { useState, useRef, useEffect, useCallback } from 'react';
import {
  TextField,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  VideocamOutlined,
  MicOffOutlined,
  VideocamOffOutlined,
  KeyboardOutlined,
  VerifiedUserOutlined,
  GroupsOutlined,
} from '@mui/icons-material';

interface JoinRoomProps {
  onJoin: (roomId: string) => void;
  isConnecting: boolean;
}

export function JoinRoom({ onJoin, isConnecting }: JoinRoomProps) {
  const [roomId, setRoomId] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  // Monotonic counter to guard against stale getUserMedia resolutions
  const requestIdRef = useRef(0);

  // Completely destroy the current stream and all its tracks
  const destroyStream = useCallback(() => {
    // Bump request ID so any in-flight getUserMedia is discarded
    requestIdRef.current += 1;
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setPreviewStream(null);
  }, []);

  // Create a new stream with only the requested devices
  const acquireStream = useCallback((audio: boolean, video: boolean) => {
    if (!audio && !video) {
      destroyStream();
      return;
    }
    // Capture the request ID before the async call
    requestIdRef.current += 1;
    const myId = requestIdRef.current;
    navigator.mediaDevices?.getUserMedia({
      video,
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
    })
      .then((stream) => {
        // If another toggle happened while we were waiting, discard this stream
        if (myId !== requestIdRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        // Stop any previous stream before replacing
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(t => t.stop());
        }
        previewStreamRef.current = stream;
        setPreviewStream(stream);
      })
      .catch(() => {});
  }, [destroyStream]);

  // Connect stream to video element after render
  useEffect(() => {
    if (localVideoRef.current && previewStream && camOn) {
      localVideoRef.current.srcObject = previewStream;
    }
  }, [previewStream, camOn]);

  // Cleanup on unmount only — no auto-acquire
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleMic = () => {
    const nextMic = !micOn;
    setMicOn(nextMic);
    destroyStream();
    if (nextMic || camOn) {
      acquireStream(nextMic, camOn);
    }
  };

  const toggleCam = () => {
    const nextCam = !camOn;
    setCamOn(nextCam);
    destroyStream();
    if (micOn || nextCam) {
      acquireStream(micOn, nextCam);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomId.trim();
    if (trimmed) {
      destroyStream();
      onJoin(trimmed);
    }
  };

  const handleNewMeeting = () => {
    const id = `${randomWord()}-${randomWord()}-${randomWord()}`;
    setRoomId(id);
    destroyStream();
    onJoin(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#102216] select-none" onDragStart={(e) => e.preventDefault()}>
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-4 border-b border-[rgba(19,236,91,0.1)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#13ec5b] flex items-center justify-center">
            <VideocamOutlined sx={{ fontSize: 20, color: '#102216' }} />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Simple WebRTC Call</span>
        </div>
        <div className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium">
          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          {' \u2022 '}
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center gap-12 px-6 max-w-[1280px] mx-auto w-full flex-wrap">
        {/* Left: Hero text + actions */}
        <div className="flex flex-col gap-8 w-full max-w-[672px] shrink-0">
          <div className="flex flex-col gap-4">
            <h1 className="text-white font-bold text-[60px] leading-[60px] tracking-[-1.5px]">
              Secure video meetings<br />for everyone.
            </h1>
            <p className="text-[#94a3b8] text-xl leading-7 max-w-[512px]">
              Connect, collaborate, and celebrate from anywhere<br />with Simple WebRTC Call.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-4">
            <Button
              type="button"
              onClick={handleNewMeeting}
              disabled={isConnecting}
              sx={{
                bgcolor: '#13ec5b',
                color: '#102216',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                borderRadius: '8px',
                px: 3, py: 1.75,
                boxShadow: '0 10px 15px -3px rgba(19,236,91,0.2)',
                '&:hover': { bgcolor: '#10d450' },
                '&.Mui-disabled': { bgcolor: 'rgba(19,236,91,0.3)', color: 'rgba(16,34,22,0.5)' },
                gap: 1,
              }}
            >
              <VideocamOutlined sx={{ fontSize: 18 }} />
              New meeting
            </Button>

            <TextField
              variant="outlined"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyboardOutlined sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: 256,
                '& .MuiOutlinedInput-root': {
                  color: '#f1f5f9',
                  borderRadius: '8px',
                  '& fieldset': { borderColor: '#334155' },
                  '&:hover fieldset': { borderColor: '#475569' },
                  '&.Mui-focused fieldset': { borderColor: '#13ec5b', borderWidth: 1 },
                },
                '& .MuiInputBase-input': { py: '14px' },
                '& .MuiInputBase-input::placeholder': { color: '#94a3b8', opacity: 1 },
              }}
            />

            <Button
              type="submit"
              disabled={!roomId.trim() || isConnecting}
              sx={{
                color: '#13ec5b',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                '&.Mui-disabled': { color: 'rgba(19,236,91,0.3)' },
              }}
            >
              Join
            </Button>
          </form>

          <div className="border-t border-[#1e293b] pt-6">
            <p className="text-sm">
              <span className="text-[#13ec5b]">Learn more</span>
              <span className="text-[#94a3b8]"> about Simple WebRTC Call security</span>
            </p>
          </div>
        </div>

        {/* Right: Preview card */}
        <div className="flex flex-col gap-8 w-full max-w-[512px] shrink-0">
          <div className="relative">
            {/* Glow border */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[rgba(19,236,91,0.3)] to-[rgba(59,130,246,0.3)] opacity-25 blur-sm" />

            <div className="relative bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden">
              {/* Video preview */}
              <div className="relative bg-[#1e293b] aspect-video">
                {previewStream && camOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover opacity-80"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#94a3b8] text-sm">
                    {previewStream ? 'Camera is off' : 'Camera preview unavailable'}
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(16,34,22,0.8)] via-transparent to-transparent" />

                {/* Preview badge */}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-white text-xs font-medium">
                  Preview
                </div>

                {/* Mic/Cam toggles */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button
                    onClick={toggleMic}
                    aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                    className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition ${
                      micOn
                        ? 'bg-[rgba(15,23,42,0.6)] border-white/20 text-white hover:bg-[rgba(15,23,42,0.8)]'
                        : 'bg-[rgba(239,68,68,0.3)] border-red-500/40 text-red-400 hover:bg-[rgba(239,68,68,0.4)]'
                    }`}
                  >
                    {micOn ? (
                      <svg width="16" height="19" viewBox="0 0 14 19" fill="none"><path d="M7 12a3 3 0 003-3V4a3 3 0 10-6 0v5a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9a5 5 0 01-10 0M7 14v3m-3 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    ) : (
                      <MicOffOutlined sx={{ fontSize: 18 }} />
                    )}
                  </button>
                  <button
                    onClick={toggleCam}
                    aria-label={camOn ? 'Turn off camera' : 'Turn on camera'}
                    className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition ${
                      camOn
                        ? 'bg-[rgba(15,23,42,0.6)] border-white/20 text-white hover:bg-[rgba(15,23,42,0.8)]'
                        : 'bg-[rgba(239,68,68,0.3)] border-red-500/40 text-red-400 hover:bg-[rgba(239,68,68,0.4)]'
                    }`}
                  >
                    {camOn ? (
                      <VideocamOutlined sx={{ fontSize: 18 }} />
                    ) : (
                      <VideocamOffOutlined sx={{ fontSize: 18 }} />
                    )}
                  </button>
                </div>
              </div>

              {/* Card text */}
              <div className="p-8 text-center">
                <h3 className="text-[#f1f5f9] font-semibold text-xl">Join or start a meeting</h3>
                <p className="text-[#94a3b8] mt-2">Everything is ready for your next call.</p>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-[#94a3b8] text-sm">
              <VerifiedUserOutlined sx={{ fontSize: 18, color: '#13ec5b' }} />
              End-to-end encrypted
            </div>
            <div className="flex items-center gap-2 text-[#94a3b8] text-sm">
              <GroupsOutlined sx={{ fontSize: 20, color: '#94a3b8' }} />
              Up to 100 participants
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-10 py-8">
        <div className="flex gap-8 text-[#94a3b8] text-sm">
          <span className="cursor-pointer hover:text-white transition">Privacy</span>
          <span className="cursor-pointer hover:text-white transition">Terms</span>
          <span className="cursor-pointer hover:text-white transition">Feedback</span>
        </div>
        <span className="text-[#94a3b8] text-sm">&copy; 2024 Simple WebRTC Inc.</span>
      </footer>
    </div>
  );
}

function randomWord() {
  const words = ['alpha', 'beta', 'gamma', 'delta', 'echo', 'fox', 'golf', 'halo', 'iris', 'jade', 'kite', 'luna', 'mars', 'nova', 'onyx', 'pine', 'ruby', 'sage', 'tide', 'vibe', 'wave', 'zeal'];
  return words[Math.floor(Math.random() * words.length)];
}
