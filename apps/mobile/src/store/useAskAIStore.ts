import { create } from "zustand";
import { AIChatMessage } from "../types/api";
import { getStoredValue, setStoredValue } from "../utils/sessionStorage";

const ASK_AI_CONVERSATIONS_STORAGE_KEY = "huanjia_ask_ai_conversations";
const MAX_ASK_AI_CONVERSATIONS = 30;

export type AskAIConversation = {
  id: string;
  title: string;
  messages: AIChatMessage[];
  updatedAt: number;
};

type AskAIState = {
  promptText: string;
  handImageUri: string | null;
  selectedHandPhotoId: string | null;
  selectedStyleId: string | null;
  conversations: AskAIConversation[];
  conversationsHydrated: boolean;
  currentConversationId: string | null;
  setPromptText: (value: string) => void;
  setHandImageUri: (value: string | null) => void;
  setSelectedHandPhotoId: (value: string | null) => void;
  setSelectedStyleId: (value: string | null) => void;
  loadConversations: () => Promise<void>;
  startConversation: () => void;
  selectConversation: (id: string) => AskAIConversation | null;
  saveConversation: (messages: AIChatMessage[], title?: string) => Promise<void>;
  reset: () => void;
};

function createConversationId(): string {
  return `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessages(messages: AIChatMessage[], title?: string): string {
  const source = title || messages.find((message) => message.role === "user")?.content || "新会话";
  const normalized = source.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

async function persistConversations(conversations: AskAIConversation[]): Promise<void> {
  await setStoredValue(ASK_AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_ASK_AI_CONVERSATIONS)));
}

export const useAskAIStore = create<AskAIState>((set, get) => ({
  promptText: "",
  handImageUri: null,
  selectedHandPhotoId: null,
  selectedStyleId: null,
  conversations: [],
  conversationsHydrated: false,
  currentConversationId: null,
  setPromptText: (promptText) => set({ promptText }),
  setHandImageUri: (handImageUri) => set({ handImageUri }),
  setSelectedHandPhotoId: (selectedHandPhotoId) => set({ selectedHandPhotoId }),
  setSelectedStyleId: (selectedStyleId) => set({ selectedStyleId }),
  loadConversations: async () => {
    const raw = await getStoredValue(ASK_AI_CONVERSATIONS_STORAGE_KEY);
    if (!raw) {
      set({ conversations: [], conversationsHydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AskAIConversation[];
      const conversations = Array.isArray(parsed)
        ? parsed
            .filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
            .slice(0, MAX_ASK_AI_CONVERSATIONS)
        : [];
      set({ conversations, conversationsHydrated: true });
    } catch {
      set({ conversations: [], conversationsHydrated: true });
    }
  },
  startConversation: () => set({ currentConversationId: null }),
  selectConversation: (id) => {
    const conversation = get().conversations.find((item) => item.id === id) ?? null;
    set({ currentConversationId: conversation?.id ?? null });
    return conversation;
  },
  saveConversation: async (messages, title) => {
    const trimmedMessages = messages.slice(-24);
    if (!trimmedMessages.length) return;
    const state = get();
    const conversationId = state.currentConversationId ?? createConversationId();
    const nextConversation: AskAIConversation = {
      id: conversationId,
      title: titleFromMessages(trimmedMessages, title),
      messages: trimmedMessages,
      updatedAt: Date.now(),
    };
    const conversations = [
      nextConversation,
      ...state.conversations.filter((item) => item.id !== conversationId),
    ].slice(0, MAX_ASK_AI_CONVERSATIONS);
    await persistConversations(conversations);
    set({ conversations, currentConversationId: conversationId, conversationsHydrated: true });
  },
  reset: () => set({ promptText: "", handImageUri: null, selectedHandPhotoId: null, selectedStyleId: null, currentConversationId: null }),
}));
