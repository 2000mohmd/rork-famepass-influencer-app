import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";

export default function ModalScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.overlay} onPress={() => router.back()}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Modal</Text>
          <Text style={styles.description}>
            This is an example modal. You can edit it in app/modal.tsx.
          </Text>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
    modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24, margin: 20, alignItems: "center", minWidth: 300, borderWidth: 1, borderColor: colors.cardBorder },
    title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 16 },
    description: { textAlign: "center", marginBottom: 24, color: colors.textSecondary, lineHeight: 20 },
    closeButton: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, minWidth: 100 },
    closeButtonText: { color: colors.background, fontWeight: "600", textAlign: "center" },
  });
}
