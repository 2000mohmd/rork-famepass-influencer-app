import { create } from "zustand";

type AppSettings = Record<string, string>;

interface CurrencyState {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  /** The currency symbol set by the admin (e.g. "AED", "USD", "SAR"). Defaults to "AED". */
  getCurrency: () => string;
}

export const useCurrencyStore = create<CurrencyState>()((set, get) => ({
  settings: {},
  setSettings: (settings: AppSettings) => set({ settings }),
  getCurrency: () => get().settings.currency ?? "AED",
}));
