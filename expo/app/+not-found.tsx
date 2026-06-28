import { Link, Stack } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: colors.background },
    title: { fontSize: 20, fontWeight: "bold", color: colors.text },
    link: { marginTop: 15, paddingVertical: 15 },
    linkText: { fontSize: 14, color: colors.accent },
  });
}
