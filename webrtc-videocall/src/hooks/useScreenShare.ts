import { useRef, useCallback, useState } from 'react';

interface UseScreenShareOptions {
  onLog: (source: 'pc', message: string) => void;
}

export function useScreenShare({ onLog }: UseScreenShareOptions) {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  // Refs to hold latest pc/localStream for the onended callback
  const pcArgRef = useRef<RTCPeerConnection | null>(null);
  const localStreamArgRef = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(async (
    pc: RTCPeerConnection | null,
    localStream: MediaStream | null,
  ) => {
    // Stop screen tracks
    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) {
        track.stop();
      }
      screenStreamRef.current = null;
    }

    // Restore original camera track
    if (pc && localStream) {
      const cameraTrack = localStream.getVideoTracks()[0];
      if (cameraTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(cameraTrack);
          onLog('pc', 'restored camera track');
        }
      }
    }

    setIsSharing(false);
    onLog('pc', 'screen sharing stopped');
  }, [onLog]);

  const stopScreenShareRef = useRef(stopScreenShare);
  stopScreenShareRef.current = stopScreenShare;

  const startScreenShare = useCallback(async (
    pc: RTCPeerConnection | null,
    localStream: MediaStream | null,
  ) => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      // Store latest args for the onended callback
      pcArgRef.current = pc;
      localStreamArgRef.current = localStream;

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace the video track in the peer connection
      if (pc && localStream) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
          onLog('pc', 'replaced video track with screen share');
        }
      }

      // When user stops sharing via browser UI, use refs to get latest values
      screenTrack.onended = () => {
        stopScreenShareRef.current(pcArgRef.current, localStreamArgRef.current);
      };

      setIsSharing(true);
      onLog('pc', 'screen sharing started');
      return screenStream;
    } catch (err) {
      onLog('pc', `screen share error: ${err instanceof Error ? err.message : 'cancelled'}`);
      return null;
    }
  }, [onLog]);

  return {
    isSharing,
    screenStreamRef,
    startScreenShare,
    stopScreenShare,
  };
}
