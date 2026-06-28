import Colors from "@/constants/colors";
import { useThemeStore } from "@/store/themeStore";

export function useTheme() {
  const { isDark, toggleTheme } = useThemeStore();
  const colors = isDark ? Colors.dark : Colors.light;
  return { colors, isDark, toggleTheme };
}
