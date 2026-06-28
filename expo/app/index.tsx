import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";

/** Gold wordmark logo: "Fame" serif + "Pass" italic gold */
function FamePassLogo({ size = 40, colors }: { size?: number; colors: ThemeColors }) {
  return (
    <View style={styles.logoRow}>
      <Text style={[styles.logoFame, { fontSize: size, color: colors.text }]}>Fame</Text>
      <Text style={[styles.logoPass, { fontSize: size, color: colors.accentLight }]}>Pass</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isInfluencer, isLoading } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading && session && isInfluencer) {
      router.replace("/(tabs)/home");
    }
  }, [isLoading, session, isInfluencer]);

  const handleCreator = useCallback(() => {
    router.push("/signup");
  }, [router]);

  const handleSignIn = useCallback(() => {
    router.push("/login");
  }, [router]);

  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={[themedStyles.container, themedStyles.center]}>
        <FamePassLogo size={36} colors={colors} />
      </View>
    );
  }

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top }]}>
      <View style={themedStyles.content}>
        {/* Logo */}
        <View style={themedStyles.logoSection}>
          <View style={themedStyles.logoIconContainer}>
            <FamePassLogo size={42} colors={colors} />
          </View>
          <Text style={themedStyles.tagline}>
            The creator pass to the best{"\n"}venues in the Middle East
          </Text>
        </View>

        {/* Buttons */}
        <View style={themedStyles.buttonSection}>
          <Pressable style={themedStyles.primaryButton} onPress={handleCreator}>
            <Text style={themedStyles.primaryButtonText}>I'm a Creator</Text>
          </Pressable>
          <Pressable style={themedStyles.outlineButton} onPress={handleSignIn}>
            <Text style={themedStyles.outlineButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoFame: { fontFamily: "serif", fontWeight: "700" },
  logoPass: { fontFamily: "serif", fontStyle: "italic", fontWeight: "700" },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: "center", justifyContent: "center" },
    content: { flex: 1, justifyContent: "center", paddingHorizontal: 32, gap: 48 },
    logoSection: { alignItems: "center", gap: 16 },
    logoIconContainer: { marginBottom: 8 },
    tagline: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24, fontWeight: "500" },
    buttonSection: { gap: 14 },
    primaryButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    primaryButtonText: { fontSize: 17, fontWeight: "700", color: colors.background },
    outlineButton: { borderWidth: 1.5, borderColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    outlineButtonText: { fontSize: 17, fontWeight: "600", color: colors.accent },
  });
}
