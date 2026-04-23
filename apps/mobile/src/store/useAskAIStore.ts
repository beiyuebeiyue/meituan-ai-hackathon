import { create } from "zustand";

type AskAIState = {
  promptText: string;
  handImageUri: string | null;
  selectedHandPhotoId: string | null;
  selectedStyleId: string | null;
  setPromptText: (value: string) => void;
  setHandImageUri: (value: string | null) => void;
  setSelectedHandPhotoId: (value: string | null) => void;
  setSelectedStyleId: (value: string | null) => void;
  reset: () => void;
};

export const useAskAIStore = create<AskAIState>((set) => ({
  promptText: "",
  handImageUri: null,
  selectedHandPhotoId: null,
  selectedStyleId: null,
  setPromptText: (promptText) => set({ promptText }),
  setHandImageUri: (handImageUri) => set({ handImageUri }),
  setSelectedHandPhotoId: (selectedHandPhotoId) => set({ selectedHandPhotoId }),
  setSelectedStyleId: (selectedStyleId) => set({ selectedStyleId }),
  reset: () => set({ promptText: "", handImageUri: null, selectedHandPhotoId: null, selectedStyleId: null }),
}));
