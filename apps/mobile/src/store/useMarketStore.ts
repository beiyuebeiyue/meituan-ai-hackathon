import { create } from "zustand";
import { DEFAULT_MARKET_CITY } from "../utils/marketCities";

type MarketState = {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  selectedCity: DEFAULT_MARKET_CITY,
  setSelectedCity: (city) => set({ selectedCity: city }),
}));
