import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

function FamePassWordmark({ colors }: { colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 24, color: colors.text }}>Fame</Text>
      <Text style={{ fontFamily: "serif", fontStyle: "italic", fontWeight: "700", fontSize: 24, color: colors.accentLight }}>Pass</Text>
    </View>
  );
}

function ProgressBar({ step, total, colors }: { step: number; total: number; colors: ThemeColors }) {
  const pct = (step / total) * 100;
  return (
    <View style={progressStyles.progressBar}>
      <View style={[progressStyles.progressTrack, { backgroundColor: colors.cardBorder }]}>
        <View style={[progressStyles.progressFill, { width: `${pct}%` as any, backgroundColor: colors.accent }]} />
      </View>
      <Text style={[progressStyles.progressText, { color: colors.textMuted }]}>{step} of {total}</Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  progressBar: { gap: 4 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 11, fontWeight: "600", textAlign: "right" },
});

const TOTAL_STEPS = 5;

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [bio, setBio] = useState("");

  // Step 3
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Step 4
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [followers, setFollowers] = useState("");

  // Step 5
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  // Fetch categories (niches) from Supabase
  const { data: niches, isLoading: nichesLoading } = useQuery<CategoryItem[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, icon, color")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as CategoryItem[];
    },
  });

  const toggleNiche = useCallback((nicheId: string) => {
    setSelectedNiches((prev) =>
      prev.includes(nicheId)
        ? prev.filter((n) => n !== nicheId)
        : [...prev, nicheId],
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

  const detectLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Please enable location access in settings.");
      return;
    }
    setLocationLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        setCity(geo.city || geo.subregion || "");
        setCountry(geo.country || "");
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
      }
    } catch {
      Alert.alert("Error", "Could not detect location. Please type it manually.");
    } finally {
      setLocationLoading(false);
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
  const hasAtLeastOneSocial =
    instagram.trim().length > 0 || tiktok.trim().length > 0;
  const canStep4 = hasAtLeastOneSocial && (followers === "" || /^\d+$/.test(followers));
  const canStep5 = selectedNiches.length > 0;

  const canContinue = (() => {
    switch (step) {
      case 1: return canStep1;
      case 2: return canStep2;
      case 3: return true;
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
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          niche: selectedNiches,
          social_links: { instagram: instagram.trim(), tiktok: tiktok.trim(), youtube: youtube.trim() },
        },
      });

      if (invokeError) {
        setError(invokeError.message ?? "Signup failed. Please try again.");
        return;
      }

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
  }, [email, password, fullName, instagram, tiktok, youtube, followers, bio, city, country, latitude, longitude, selectedNiches, router]);

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <ArrowLeft size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>{step === 1 ? "Back" : "Previous"}</Text>
          </Pressable>
          <FamePassWordmark colors={colors} />
          <View style={{ width: 60 }} />
        </View>
        <ProgressBar step={step} total={TOTAL_STEPS} colors={colors} />
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
              <TextInput
                style={styles.input}
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <View style={styles.passwordHints}>
                <HintRow done={password.length >= 8} label="8+ characters" colors={colors} />
                <HintRow done={/[A-Z]/.test(password)} label="Uppercase letter" colors={colors} />
                <HintRow done={/[a-z]/.test(password)} label="Lowercase letter" colors={colors} />
                <HintRow done={/[0-9]/.test(password)} label="Number" colors={colors} />
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
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username (optional)</Text>
              <View style={styles.usernameWrapper}>
                <Text style={[styles.atPrefix, { color: colors.textMuted }]}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            </View>

            {/* Location section */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Location</Text>
              <Pressable style={styles.detectButton} onPress={detectLocation}>
                <MapPin size={16} color={colors.accent} />
                <Text style={styles.detectButtonText}>
                  {locationLoading ? "Detecting..." : "Use my current location"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Dubai, Beirut"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. UAE, Lebanon"
                  placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                  <Camera size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.avatarPickerBadge}>
                <Camera size={14} color="#FFF" />
              </View>
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleContinue}>
              <Text style={styles.skipText}>Skip for now</Text>
              <ArrowRight size={16} color={colors.accentLight} />
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
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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

            {nichesLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.nicheGrid}>
                {(niches ?? []).map((niche) => {
                  const isSelected = selectedNiches.includes(niche.id);
                  return (
                    <Pressable
                      key={niche.id}
                      style={[
                        styles.nichePill,
                        isSelected && styles.nichePillActive,
                      ]}
                      onPress={() => toggleNiche(niche.id)}
                    >
                      <Text
                        style={[
                          styles.nichePillText,
                          isSelected && styles.nichePillTextActive,
                        ]}
                      >
                        {niche.name}
                      </Text>
                      {isSelected && (
                        <CheckCircle2 size={14} color={colors.background} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
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
            <ActivityIndicator size="small" color={colors.background} />
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

function HintRow({ done, label, colors }: { done: boolean; label: string; colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <CheckCircle2
        size={14}
        color={done ? colors.green : colors.textMuted}
      />
      <Text style={{ fontSize: 12, fontWeight: "500", color: done ? colors.green : colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
    backText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingTop: 12, paddingBottom: 100 },
    errorBox: { backgroundColor: colors.red + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.red + "30", marginBottom: 12 },
    errorText: { fontSize: 14, color: colors.red, fontWeight: "500" },
    stepContent: { gap: 16 },
    stepTitle: { fontSize: 24, fontWeight: "700", color: colors.text },
    stepSubtitle: { fontSize: 15, color: colors.textSecondary, marginTop: -8 },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder },
    textArea: { minHeight: 90, paddingTop: 14 },
    usernameWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBackground, borderRadius: 14, borderWidth: 1, borderColor: colors.inputBorder },
    atPrefix: { fontSize: 16, paddingLeft: 16, fontWeight: "600" },
    detectButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.accent + "40", alignSelf: "flex-start" },
    detectButtonText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    row: { flexDirection: "row", gap: 10 },
    passwordHints: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
    avatarPicker: { alignSelf: "center", marginTop: 8 },
    avatarPreview: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.accent },
    avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.cardBorder, borderStyle: "dashed" },
    avatarPickerBadge: { position: "absolute", bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    skipButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
    skipText: { fontSize: 15, fontWeight: "600", color: colors.accentLight },
    nicheGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    nichePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 6 },
    nichePillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    nichePillText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    nichePillTextActive: { color: colors.background },
    bottomBar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    ctaButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontSize: 17, fontWeight: "700", color: colors.background },
  });
}
