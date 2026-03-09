export type AppState = 'idle' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'ended';

export type Role = 'caller' | 'callee';

export type ViewTab = 'video' | 'screen';

export interface SignalingMessage {
  type: 'join' | 'joined' | 'full' | 'offer' | 'answer' | 'candidate' | 'hangup' | 'peer-joined' | 'peer-left' | 'error';
  roomId?: string;
  role?: Role;
  participants?: number;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  message?: string;
}

export interface LogEntry {
  timestamp: number;
  source: 'ws' | 'pc' | 'ui' | 'ice';
  direction?: 'send' | 'recv';
  message: string;
}

export type WhiteboardTool = 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'text' | 'eraser';

export interface WhiteboardElement {
  id: string;
  tool: WhiteboardTool;
  color: string;
  lineWidth: number;
  fill?: string;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
}
