import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, EyeOff } from "lucide-react-native";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/_layout";

function FamePassWordmark({ colors }: { colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 32, color: colors.text }}>Fame</Text>
      <Text style={{ fontFamily: "serif", fontStyle: "italic", fontWeight: "700", fontSize: 32, color: colors.accentLight }}>Pass</Text>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (!data.user) {
        setError("Something went wrong. Please try again.");
        return;
      }
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (roleData?.role !== "influencer") {
        await supabase.auth.signOut();
        setError("This app is for creators only.");
        return;
      }
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <FamePassWordmark colors={colors} />
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={18} color={colors.textMuted} />
              ) : (
                <Eye size={18} color={colors.textMuted} />
              )}
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => router.push("/forgot-password")}
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.bottomText}>New creator? </Text>
        <Pressable onPress={() => router.push("/signup")}>
          <Text style={styles.bottomLink}>Sign up</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 18 },
    logoSection: { alignItems: "center", marginBottom: 20 },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 10, fontWeight: "500" },
    errorBox: { backgroundColor: colors.red + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.red + "30" },
    errorText: { fontSize: 14, color: colors.red, fontWeight: "500" },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder },
    passwordWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBackground, borderRadius: 14, borderWidth: 1, borderColor: colors.inputBorder },
    eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
    primaryButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { fontSize: 17, fontWeight: "700", color: colors.background },
    linkButton: { alignItems: "center", paddingVertical: 4 },
    linkText: { fontSize: 14, fontWeight: "600", color: colors.accentLight },
    bottomSection: { flexDirection: "row", justifyContent: "center", paddingVertical: 16 },
    bottomText: { fontSize: 14, color: colors.textSecondary },
    bottomLink: { fontSize: 14, fontWeight: "700", color: colors.accent },
  });
}
