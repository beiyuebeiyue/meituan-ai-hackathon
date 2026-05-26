import { create } from "zustand";
import { DEFAULT_MARKET_CITY } from "../utils/marketCities";

export type MarketSort = "default" | "distance";

type MarketState = {
  selectedCity: string;
  sort: MarketSort;
  searchDraft: string;
  submittedPlace: string;
  selectedShopId: string | null;
  pendingBookingStyleId: string | null;
  pendingBookingTryOnJobId: string | null;
  setSelectedCity: (city: string) => void;
  setSort: (sort: MarketSort) => void;
  setSearchDraft: (text: string) => void;
  setSubmittedPlace: (place: string) => void;
  setSelectedShopId: (shopId: string | null) => void;
  setPendingBookingStyleId: (styleId: string | null) => void;
  setPendingBookingTryOnJobId: (jobId: string | null) => void;
  clearSearch: () => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  selectedCity: DEFAULT_MARKET_CITY,
  sort: "default",
  searchDraft: "",
  submittedPlace: "",
  selectedShopId: null,
  pendingBookingStyleId: null,
  pendingBookingTryOnJobId: null,
  setSelectedCity: (city) => set({ selectedCity: city }),
  setSort: (sort) => set({ sort }),
  setSearchDraft: (searchDraft) => set({ searchDraft }),
  setSubmittedPlace: (submittedPlace) => set({ submittedPlace }),
  setSelectedShopId: (selectedShopId) => set({ selectedShopId }),
  setPendingBookingStyleId: (pendingBookingStyleId) => set({ pendingBookingStyleId }),
  setPendingBookingTryOnJobId: (pendingBookingTryOnJobId) => set({ pendingBookingTryOnJobId }),
  clearSearch: () => set({ searchDraft: "", submittedPlace: "" }),
}));
