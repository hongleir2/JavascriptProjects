import { create } from 'zustand';
import { ChatMessage, WebSocketStatus } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  users: string[];
  status: WebSocketStatus;
  error: string | null;
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  updateUsers: (users: string[]) => void;
  setStatus: (status: WebSocketStatus) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  users: [],
  status: 'disconnected',
  error: null,

  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateUsers: (users: string[]) => {
    set({ users });
  },

  setStatus: (status: WebSocketStatus) => {
    set({ status });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  reset: () => {
    set({
      messages: [],
      users: [],
      status: 'disconnected',
      error: null,
    });
  },
}));
