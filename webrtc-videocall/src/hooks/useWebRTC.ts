import { useRef, useCallback } from 'react';
import type { SignalingMessage } from '@/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface DataChannelMessage {
  type: 'wb-open' | 'wb-close' | 'wb-element' | 'wb-undo' | 'wb-clear';
  element?: unknown;
}

interface UseWebRTCOptions {
  onRemoteStream: (stream: MediaStream) => void;
  onIceStateChange: (state: RTCIceConnectionState) => void;
  send: (msg: SignalingMessage) => void;
  onLog: (source: 'pc' | 'ice', message: string) => void;
  roomId: string;
  onPeerConnection?: (pc: RTCPeerConnection) => void;
  onDataChannelMessage?: (msg: DataChannelMessage) => void;
}

export function useWebRTC({ onRemoteStream, onIceStateChange, send, onLog, roomId, onPeerConnection, onDataChannelMessage }: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const onDataChannelMessageRef = useRef(onDataChannelMessage);
  onDataChannelMessageRef.current = onDataChannelMessage;

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera/microphone access requires HTTPS. Please use https:// to access this page.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localStreamRef.current = stream;
    onLog('pc', 'local media acquired');
    return stream;
  }, [onLog]);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    hasRemoteDescRef.current = false;
    pendingCandidatesRef.current = [];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: 'candidate', roomId, candidate: event.candidate.toJSON() });
        onLog('ice', `send candidate: ${event.candidate.candidate.substring(0, 50)}...`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      onLog('ice', `state: ${pc.iceConnectionState}`);
      onIceStateChange(pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      onLog('pc', `signalingState: ${pc.signalingState}`);
    };

    pc.ontrack = (event) => {
      onLog('pc', 'remote track received');
      onRemoteStream(event.streams[0]);
    };

    // Setup data channel handler for incoming channels (callee side)
    const setupChannel = (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as DataChannelMessage;
          onDataChannelMessageRef.current?.(msg);
        } catch { /* ignore malformed */ }
      };
      channel.onopen = () => onLog('pc', 'data channel open');
      channel.onclose = () => onLog('pc', 'data channel closed');
    };

    pc.ondatachannel = (event) => {
      onLog('pc', 'received data channel from peer');
      setupChannel(event.channel);
    };

    // Caller creates the data channel
    const dc = pc.createDataChannel('whiteboard', { ordered: true });
    setupChannel(dc);

    // Add local tracks
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
      onLog('pc', 'local tracks added to peer connection');
    }

    onLog('pc', 'peer connection created');
    onPeerConnection?.(pc);
    return pc;
  }, [send, onRemoteStream, onIceStateChange, onLog, roomId, onPeerConnection]);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        onLog('ice', 'queued remote candidate added');
      } catch (err) {
        onLog('ice', `failed to add queued candidate: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
    pendingCandidatesRef.current = [];
  }, [onLog]);

  const createOffer = useCallback(async () => {
    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'offer', roomId, sdp: pc.localDescription! });
      onLog('pc', 'offer created and sent');
    } catch (err) {
      onLog('pc', `createOffer error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [createPeerConnection, send, onLog, roomId]);

  const handleOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    try {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      hasRemoteDescRef.current = true;
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', roomId, sdp: pc.localDescription! });
      onLog('pc', 'answer created and sent');
    } catch (err) {
      onLog('pc', `handleOffer error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [createPeerConnection, flushPendingCandidates, send, onLog, roomId]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    try {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      hasRemoteDescRef.current = true;
      await flushPendingCandidates(pc);
      onLog('pc', 'remote description set');
    } catch (err) {
      onLog('pc', `handleAnswer error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [flushPendingCandidates, onLog]);

  const handleCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc) return;

    // Queue candidates until remote description is set
    if (!hasRemoteDescRef.current) {
      pendingCandidatesRef.current.push(candidate);
      onLog('ice', 'candidate queued (waiting for remote description)');
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      onLog('ice', 'remote candidate added');
    } catch (err) {
      onLog('ice', `addIceCandidate error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, [onLog]);

  const sendDataChannelMessage = useCallback((msg: DataChannelMessage) => {
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(msg));
    }
  }, []);

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    hasRemoteDescRef.current = false;
    pendingCandidatesRef.current = [];

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    onLog('pc', 'cleaned up');
  }, [onLog]);

  const toggleAudio = useCallback((enabled: boolean) => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled;
      onLog('pc', `audio ${enabled ? 'unmuted' : 'muted'}`);
    }
  }, [onLog]);

  const toggleVideo = useCallback((enabled: boolean) => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
      onLog('pc', `video ${enabled ? 'on' : 'off'}`);
    }
  }, [onLog]);

  return {
    getLocalStream,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleCandidate,
    cleanup,
    toggleAudio,
    toggleVideo,
    localStreamRef,
    sendDataChannelMessage,
  };
}
