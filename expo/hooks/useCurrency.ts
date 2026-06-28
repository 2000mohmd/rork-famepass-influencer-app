import { useCurrencyStore } from "@/store/currencyStore";

/** Returns the admin-configured currency symbol (e.g. "AED", "USD"). Defaults to "AED". */
export function useCurrency(): string {
  return useCurrencyStore((s) => s.getCurrency());
}
