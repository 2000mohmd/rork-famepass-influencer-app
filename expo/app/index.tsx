import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/app/_layout";

/** Gold wordmark logo: "Fame" serif + "Pass" italic gold */
function FamePassLogo({ size = 40 }: { size?: number }) {
  return (
    <View style={styles.logoRow}>
      <Text style={[styles.logoFame, { fontSize: size }]}>Fame</Text>
      <Text style={[styles.logoPass, { fontSize: size }]}>Pass</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isInfluencer, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <FamePassLogo size={36} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoIconContainer}>
            <FamePassLogo size={42} />
          </View>
          <Text style={styles.tagline}>
            The creator pass to the best{"\n"}venues in the Middle East
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonSection}>
          <Pressable style={styles.primaryButton} onPress={handleCreator}>
            <Text style={styles.primaryButtonText}>I'm a Creator</Text>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={handleSignIn}>
            <Text style={styles.outlineButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 48,
  },
  logoSection: {
    alignItems: "center",
    gap: 16,
  },
  logoIconContainer: {
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoFame: {
    fontFamily: "serif",
    fontWeight: "700",
    color: Colors.dark.text,
  },
  logoPass: {
    fontFamily: "serif",
    fontStyle: "italic",
    fontWeight: "700",
    color: Colors.dark.accentLight,
  },
  tagline: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  buttonSection: {
    gap: 14,
  },
  primaryButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.dark.background,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: Colors.dark.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  outlineButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
});
