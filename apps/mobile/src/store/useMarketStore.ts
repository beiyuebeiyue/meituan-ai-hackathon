import { create } from "zustand";
import { DEFAULT_MARKET_CITY } from "../utils/marketCities";

export type MarketSort = "default" | "distance";

type MarketState = {
  selectedCity: string;
  sort: MarketSort;
  searchDraft: string;
  submittedPlace: string;
  selectedShopId: string | null;
  setSelectedCity: (city: string) => void;
  setSort: (sort: MarketSort) => void;
  setSearchDraft: (text: string) => void;
  setSubmittedPlace: (place: string) => void;
  setSelectedShopId: (shopId: string | null) => void;
  clearSearch: () => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  selectedCity: DEFAULT_MARKET_CITY,
  sort: "default",
  searchDraft: "",
  submittedPlace: "",
  selectedShopId: null,
  setSelectedCity: (city) => set({ selectedCity: city }),
  setSort: (sort) => set({ sort }),
  setSearchDraft: (searchDraft) => set({ searchDraft }),
  setSubmittedPlace: (submittedPlace) => set({ submittedPlace }),
  setSelectedShopId: (selectedShopId) => set({ selectedShopId }),
  clearSearch: () => set({ searchDraft: "", submittedPlace: "" }),
}));
