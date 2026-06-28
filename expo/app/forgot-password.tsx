import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react-native";
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

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: "famepass://reset-password" },
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {sent ? (
          <View style={styles.successState}>
            <View style={styles.successIcon}>
              <CheckCircle2 size={48} color={colors.green} />
            </View>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              We've sent a password reset link to{"\n"}{email.trim()}. Tap the link in the email to reset your password.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => router.replace("/login")}>
              <Text style={styles.primaryButtonText}>Back to Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.headerSection}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email and we'll send you a link to reset your password.
              </Text>
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

            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 18 },
    backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    backText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    headerSection: { gap: 8, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
    errorBox: { backgroundColor: colors.red + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.red + "30" },
    errorText: { fontSize: 14, color: colors.red, fontWeight: "500" },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder },
    primaryButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: { fontSize: 17, fontWeight: "700", color: colors.background },
    successState: { alignItems: "center", gap: 16, paddingTop: 20 },
    successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.green + "15", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    successTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
    successText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  });
}
