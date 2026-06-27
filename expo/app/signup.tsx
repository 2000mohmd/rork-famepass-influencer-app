import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import Colors from "@/constants/colors";
import { NICHES, Niche } from "@/constants/mockData";
import { supabase } from "@/lib/supabase";

function FamePassWordmark() {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 24, color: Colors.dark.text }}>Fame</Text>
      <Text style={{ fontFamily: "serif", fontStyle: "italic", fontWeight: "700", fontSize: 24, color: Colors.dark.accentLight }}>Pass</Text>
    </View>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = (step / total) * 100;
  return (
    <View style={styles.progressBar}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={styles.progressText}>{step} of {total}</Text>
    </View>
  );
}

const TOTAL_STEPS = 5;

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");

  // Step 3
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Step 4
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [followers, setFollowers] = useState("");

  // Step 5
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>([]);

  const toggleNiche = useCallback((niche: Niche) => {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : [...prev, niche],
    );
  }, []);

  const pickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  const canStep1 = isEmailValid && isPasswordStrong;
  const canStep2 = fullName.trim().length > 0 && city.trim().length > 0 && country.trim().length > 0;
  // Step 3 is optional (skip available)
  const hasAtLeastOneSocial =
    instagram.trim().length > 0 || tiktok.trim().length > 0;
  const canStep4 = hasAtLeastOneSocial && (followers === "" || /^\d+$/.test(followers));
  const canStep5 = selectedNiches.length > 0;

  const canContinue = (() => {
    switch (step) {
      case 1: return canStep1;
      case 2: return canStep2;
      case 3: return true; // optional
      case 4: return canStep4;
      case 5: return canStep5;
      default: return false;
    }
  })();

  const handleFinalSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("signup-user", {
        body: {
          email: email.trim(),
          password,
          role: "influencer",
          full_name: fullName.trim(),
          instagram_handle: instagram.replace(/^@/, ""),
          tiktok_handle: tiktok.replace(/^@/, ""),
          followers_count: Number(followers) || 0,
          bio: bio.trim(),
          city: city.trim(),
          country: country.trim(),
          niche: selectedNiches,
          social_links: { instagram: instagram.trim(), tiktok: tiktok.trim(), youtube: youtube.trim() },
        },
      });

      if (invokeError) {
        setError(invokeError.message ?? "Signup failed. Please try again.");
        return;
      }

      // Auto sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Account created but login failed. Please sign in manually.");
        router.replace("/login");
        return;
      }

      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [email, password, fullName, instagram, tiktok, youtube, followers, bio, city, country, selectedNiches, router]);

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleFinalSubmit();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            style={styles.backButton}
            onPress={() => (step === 1 ? router.back() : setStep(step - 1))}
          >
            <ArrowLeft size={20} color={Colors.dark.textSecondary} />
            <Text style={styles.backText}>{step === 1 ? "Back" : "Previous"}</Text>
          </Pressable>
          <FamePassWordmark />
          <View style={{ width: 60 }} />
        </View>
        <ProgressBar step={step} total={TOTAL_STEPS} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Step 1 — Account */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create your account</Text>
            <Text style={styles.stepSubtitle}>Start your FamePass journey</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.dark.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <View style={styles.passwordHints}>
                <HintRow done={password.length >= 8} label="8+ characters" />
                <HintRow done={/[A-Z]/.test(password)} label="Uppercase letter" />
                <HintRow done={/[a-z]/.test(password)} label="Lowercase letter" />
                <HintRow done={/[0-9]/.test(password)} label="Number" />
              </View>
            </View>
          </View>
        )}

        {/* Step 2 — Profile */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            <Text style={styles.stepSubtitle}>This helps venues find you</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={Colors.dark.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username (optional)</Text>
              <View style={styles.usernameWrapper}>
                <Text style={styles.atPrefix}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="username"
                  placeholderTextColor={Colors.dark.textMuted}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Your city</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dubai"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={styles.input}
                  placeholder="UAE"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={country}
                  onChangeText={setCountry}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell venues about your content style..."
                placeholderTextColor={Colors.dark.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={bio}
                onChangeText={setBio}
              />
            </View>
          </View>
        )}

        {/* Step 3 — Photo */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add a profile photo</Text>
            <Text style={styles.stepSubtitle}>Help venues recognize you</Text>

            <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Camera size={36} color={Colors.dark.textMuted} />
                </View>
              )}
              <View style={styles.avatarPickerBadge}>
                <Camera size={14} color={Colors.dark.background} />
              </View>
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleContinue}>
              <Text style={styles.skipText}>Skip for now</Text>
              <ArrowRight size={16} color={Colors.dark.accentLight} />
            </Pressable>
          </View>
        )}

        {/* Step 4 — Social Handles */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect your socials</Text>
            <Text style={styles.stepSubtitle}>At least one platform required</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instagram handle</Text>
              <TextInput
                style={styles.input}
                placeholder="@yourhandle"
                placeholderTextColor={Colors.dark.textMuted}
                autoCapitalize="none"
                value={instagram}
                onChangeText={setInstagram}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>TikTok handle</Text>
              <TextInput
                style={styles.input}
                placeholder="@yourhandle"
                placeholderTextColor={Colors.dark.textMuted}
                autoCapitalize="none"
                value={tiktok}
                onChangeText={setTiktok}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>YouTube (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="@yourchannel"
                placeholderTextColor={Colors.dark.textMuted}
                autoCapitalize="none"
                value={youtube}
                onChangeText={setYoutube}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Total follower count</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50000"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="numeric"
                value={followers}
                onChangeText={setFollowers}
              />
            </View>
          </View>
        )}

        {/* Step 5 — Niches */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose your niches</Text>
            <Text style={styles.stepSubtitle}>Pick at least one category that fits your content</Text>

            <View style={styles.nicheGrid}>
              {NICHES.map((niche) => {
                const isSelected = selectedNiches.includes(niche.key);
                return (
                  <Pressable
                    key={niche.key}
                    style={[
                      styles.nichePill,
                      isSelected && styles.nichePillActive,
                    ]}
                    onPress={() => toggleNiche(niche.key)}
                  >
                    <Text
                      style={[
                        styles.nichePillText,
                        isSelected && styles.nichePillTextActive,
                      ]}
                    >
                      {niche.label}
                    </Text>
                    {isSelected && (
                      <CheckCircle2 size={14} color={Colors.dark.background} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={[
            styles.ctaButton,
            (!canContinue || loading) && styles.ctaDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.dark.background} />
          ) : (
            <Text style={styles.ctaText}>
              {step === TOTAL_STEPS ? "Create Account" : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function HintRow({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.hintRow}>
      <CheckCircle2
        size={14}
        color={done ? Colors.dark.green : Colors.dark.textMuted}
      />
      <Text
        style={[styles.hintText, done && { color: Colors.dark.green }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  progressBar: {
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.dark.cardBorder,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.dark.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    textAlign: "right",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  errorBox: {
    backgroundColor: Colors.dark.red + "18",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.red + "30",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.red,
    fontWeight: "500",
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  stepSubtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: -8,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 14,
  },
  usernameWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  atPrefix: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    paddingLeft: 16,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  passwordHints: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hintText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  avatarPicker: {
    alignSelf: "center",
    marginTop: 8,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.dark.accent,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.dark.cardBorder,
    borderStyle: "dashed",
  },
  avatarPickerBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.accentLight,
  },
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nichePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    gap: 6,
  },
  nichePillActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  nichePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  nichePillTextActive: {
    color: Colors.dark.background,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBorder,
  },
  ctaButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.dark.background,
  },
});
