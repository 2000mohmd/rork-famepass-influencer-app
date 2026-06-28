import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface BookmarkState {
  savedOffers: Set<string>;
  toggle: (offerId: string) => void;
  isSaved: (offerId: string) => boolean;
  list: () => string[];
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      savedOffers: new Set<string>(),
      toggle: (offerId: string) => {
        const next = new Set(get().savedOffers);
        if (next.has(offerId)) {
          next.delete(offerId);
        } else {
          next.add(offerId);
        }
        set({ savedOffers: next });
      },
      isSaved: (offerId: string) => get().savedOffers.has(offerId),
      list: () => Array.from(get().savedOffers),
    }),
    {
      name: "famepass-bookmarks",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedOffers: Array.from(state.savedOffers),
      }),
      merge: (persisted: any, current) => ({
        ...current,
        savedOffers: new Set<string>(persisted?.savedOffers ?? []),
      }),
    },
  ),
);
