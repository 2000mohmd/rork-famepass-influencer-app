import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  Sparkles,
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
import { apiRequestWithRefresh } from "@/lib/api";

function FamePassWordmark({ colors, size = 22 }: { colors: ThemeColors; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: size, color: colors.text }}>Fame</Text>
      <Text style={{ fontFamily: "serif", fontStyle: "italic", fontWeight: "700", fontSize: size, color: colors.accentLight }}>Pass</Text>
    </View>
  );
}

const TOTAL_STEPS = 5;
const STEP_NAMES = ["Account", "You", "Photo", "Socials", "Niches"];

/** Named, segmented progress tracker — replaces the flat "3 of 5" bar. */
function StepTracker({ step, colors }: { step: number; colors: ThemeColors }) {
  return (
    <View style={trackerStyles.wrap}>
      <View style={trackerStyles.segments}>
        {STEP_NAMES.map((_, i) => {
          const done = i + 1 < step;
          const active = i + 1 === step;
          return (
            <View
              key={i}
              style={[
                trackerStyles.seg,
                { backgroundColor: done || active ? colors.accent : colors.cardBorder },
                active && { backgroundColor: colors.accent, opacity: 1 },
              ]}
            />
          );
        })}
      </View>
      <Text style={[trackerStyles.label, { color: colors.textMuted }]}>
        Step {step} of {TOTAL_STEPS} · {STEP_NAMES[step - 1]}
      </Text>
    </View>
  );
}

const trackerStyles = StyleSheet.create({
  wrap: { gap: 6 },
  segments: { flexDirection: "row", gap: 5 },
  seg: { height: 4, borderRadius: 2, flex: 1 },
  label: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
});

/** Per-step eyebrow + serif headline that frames signup as claiming a pass. */
const STEP_COPY: { eyebrow: string; title: string; subtitle: string }[] = [
  { eyebrow: "Step 1 · Account", title: "Claim your creator pass", subtitle: "Start your FamePass journey" },
  { eyebrow: "Step 2 · About you", title: "Tell venues who you are", subtitle: "This helps venues find you" },
  { eyebrow: "Step 3 · Your photo", title: "Put a face to your pass", subtitle: "Help venues recognize you" },
  { eyebrow: "Step 4 · Your reach", title: "Connect your socials", subtitle: "At least one platform. Followers auto-detected." },
  { eyebrow: "Step 5 · Your niches", title: "What do you create?", subtitle: "Pick the categories that fit your content" },
];

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

const SOCIAL_META: Record<"instagram" | "tiktok" | "youtube", { label: string; glyph: string; bg: string }> = {
  instagram: { label: "Instagram", glyph: "◎", bg: "#DD2A7B" },
  tiktok: { label: "TikTok", glyph: "♪", bg: "#111111" },
  youtube: { label: "YouTube", glyph: "▶", bg: "#FF0000" },
};

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

  // Step 5
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  const [focusedField, setFocusedField] = useState<string | null>(null);

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

  /** Uploads the picked avatar to the "avatars" bucket and returns its storage path. */
  const uploadAvatar = useCallback(async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;
    try {
      const res = await fetch(avatarUri);
      const arrayBuffer = await res.arrayBuffer();
      const ext = (avatarUri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadError) return null;
      return path;
    } catch {
      return null;
    }
  }, [avatarUri]);

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
  const canStep4 = hasAtLeastOneSocial;
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
          youtube_handle: youtube.replace(/^@/, ""),
          bio: bio.trim(),
          city: city.trim(),
          country: country.trim(),
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          niche: selectedNiches,
          social_links: { instagram: instagram.trim(), tiktok: tiktok.trim(), youtube: youtube.trim() },
        },
      });

      // Show an error and STAY on this screen. Only clear a session if one was
      // actually created (a stray signed-in session would otherwise let the
      // global auth guard navigate away). No session → don't touch auth, which
      // avoids bouncing the user back to the welcome screen.
      const failWith = async (message: string) => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) await supabase.auth.signOut();
        setError(message);
      };

      // Network / non-2xx failure from the edge function itself.
      if (invokeError) {
        await failWith(invokeError.message ?? "Signup failed. Please try again.");
        return;
      }

      // The function can return an error in the body with a 200 status
      // (e.g. duplicate email), which invokeError does NOT catch. Inspect the body.
      if (data?.error) {
        await failWith(
          data.code === "email_exists" || data.should_sign_in
            ? "This email is already registered. Go back and use a different email, or sign in."
            : data.error,
        );
        return;
      }

      // Signup succeeded only if the function returned the created user.
      if (!data?.user) {
        await failWith("Signup did not complete. Please try again.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        // Most common cause: the project has email confirmation enabled.
        await failWith(
          /confirm/i.test(signInError.message)
            ? "Account created. Please confirm your email, then sign in."
            : "Account created but automatic sign-in failed. Please sign in manually.",
        );
        return;
      }

      // Now that we have a session, upload the avatar (if picked) and save it.
      const userId = (data.user as { id?: string })?.id;
      if (avatarUri && userId) {
        const path = await uploadAvatar(userId);
        if (path) {
          try {
            await apiRequestWithRefresh("/profile", {
              method: "PUT",
              body: { avatar_url: path },
            });
          } catch {
            // Non-fatal — the account is created; avatar can be set later in Edit Profile.
          }
        }
      }

      // Fully successful — navigation happens here only.
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e?.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [email, password, fullName, instagram, tiktok, youtube, bio, city, country, latitude, longitude, selectedNiches, avatarUri, uploadAvatar, router]);

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = STEP_COPY[step - 1];

  const inputStyle = (field: string) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              if (step === 1) {
                router.back();
              } else {
                setError(null);
                setStep(step - 1);
              }
            }}
          >
            <ArrowLeft size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>{step === 1 ? "Back" : "Previous"}</Text>
          </Pressable>
          <FamePassWordmark colors={colors} />
          <View style={{ width: 60 }} />
        </View>
        <StepTracker step={step} colors={colors} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reward reminder — shows what the creator is unlocking */}
        <View style={styles.rewardBanner}>
          <Sparkles size={14} color={colors.accent} />
          <Text style={styles.rewardText}>Unlock free tables, event passes & paid collabs</Text>
        </View>

        {/* Per-step framing */}
        <View style={styles.stepIntro}>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.stepTitle}>{copy.title}</Text>
          <Text style={styles.stepSubtitle}>{copy.subtitle}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Step 1 — Account */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={inputStyle("email")}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={inputStyle("password")}
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <View style={styles.passwordHints}>
                <HintRow done={password.length >= 8} label="8+ characters" colors={colors} />
                <HintRow done={/[A-Z]/.test(password)} label="Uppercase" colors={colors} />
                <HintRow done={/[a-z]/.test(password)} label="Lowercase" colors={colors} />
                <HintRow done={/[0-9]/.test(password)} label="Number" colors={colors} />
              </View>
            </View>
          </View>
        )}

        {/* Step 2 — Profile */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={inputStyle("fullName")}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocusedField("fullName")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username (optional)</Text>
              <View style={[styles.usernameWrapper, focusedField === "username" && styles.inputFocused]}>
                <Text style={[styles.atPrefix, { color: colors.textMuted }]}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your location</Text>
              <Pressable
                style={[styles.detectButton, (city || country) && styles.detectButtonFilled]}
                onPress={detectLocation}
              >
                <MapPin size={16} color={colors.accent} />
                <Text style={styles.detectButtonText}>
                  {locationLoading
                    ? "Detecting…"
                    : city || country
                      ? `${city}${city && country ? ", " : ""}${country}`
                      : "Use my current location"}
                </Text>
                {(city || country) && !locationLoading && <CheckCircle2 size={15} color={colors.green} />}
              </Pressable>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={inputStyle("city")}
                  placeholder="Dubai"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                  onFocus={() => setFocusedField("city")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={inputStyle("country")}
                  placeholder="UAE"
                  placeholderTextColor={colors.textMuted}
                  value={country}
                  onChangeText={setCountry}
                  onFocus={() => setFocusedField("country")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Bio</Text>
                <Text style={styles.counter}>{bio.length}/160</Text>
              </View>
              <TextInput
                style={[inputStyle("bio"), styles.textArea]}
                placeholder="Tell venues about your content style…"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={160}
                textAlignVertical="top"
                value={bio}
                onChangeText={setBio}
                onFocus={() => setFocusedField("bio")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>
        )}

        {/* Step 3 — Photo */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
              <View style={styles.avatarRing}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera size={34} color={colors.accent} />
                  </View>
                )}
              </View>
              <View style={styles.avatarBadge}>
                <Camera size={14} color={colors.background} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {avatarUri ? "Looking good — tap to change" : "Tap to add · uploads to your profile"}
            </Text>

            <Pressable style={styles.skipButton} onPress={handleContinue}>
              <Text style={styles.skipText}>Skip for now</Text>
              <ArrowRight size={16} color={colors.accentLight} />
            </Pressable>
          </View>
        )}

        {/* Step 4 — Social Handles */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <SocialRow
              platform="instagram"
              value={instagram}
              onChangeText={setInstagram}
              focused={focusedField === "instagram"}
              onFocus={() => setFocusedField("instagram")}
              onBlur={() => setFocusedField(null)}
              colors={colors}
              styles={styles}
            />
            <SocialRow
              platform="tiktok"
              value={tiktok}
              onChangeText={setTiktok}
              focused={focusedField === "tiktok"}
              onFocus={() => setFocusedField("tiktok")}
              onBlur={() => setFocusedField(null)}
              colors={colors}
              styles={styles}
            />
            <SocialRow
              platform="youtube"
              value={youtube}
              optional
              onChangeText={setYoutube}
              focused={focusedField === "youtube"}
              onFocus={() => setFocusedField("youtube")}
              onBlur={() => setFocusedField(null)}
              colors={colors}
              styles={styles}
            />

            <View style={[styles.followerNote, hasAtLeastOneSocial && styles.followerNoteOk]}>
              <Text style={styles.followerNoteText}>
                {hasAtLeastOneSocial
                  ? "Great — your follower count will be auto-detected from your connected accounts."
                  : "Add at least Instagram or TikTok to continue."}
              </Text>
            </View>
          </View>
        )}

        {/* Step 5 — Niches */}
        {step === 5 && (
          <View style={styles.stepContent}>
            {nichesLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.nicheGrid}>
                {(niches ?? []).map((niche) => {
                  const isSelected = selectedNiches.includes(niche.id);
                  return (
                    <Pressable
                      key={niche.id}
                      style={[styles.nichePill, isSelected && styles.nichePillActive]}
                      onPress={() => toggleNiche(niche.id)}
                    >
                      <Text style={[styles.nichePillText, isSelected && styles.nichePillTextActive]}>
                        {niche.name}
                      </Text>
                      {isSelected && <CheckCircle2 size={14} color={colors.background} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
            {selectedNiches.length > 0 && (
              <Text style={styles.nicheCount}>{selectedNiches.length} selected</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={[styles.ctaButton, (!canContinue || loading) && styles.ctaDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>
                {step === TOTAL_STEPS ? "Create my pass" : "Continue"}
              </Text>
              <ArrowRight size={18} color={colors.background} />
            </View>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SocialRow({
  platform, value, onChangeText, focused, onFocus, onBlur, colors, styles, optional,
}: {
  platform: "instagram" | "tiktok" | "youtube";
  value: string;
  onChangeText: (t: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  optional?: boolean;
}) {
  const meta = SOCIAL_META[platform];
  return (
    <View style={[styles.socialRow, focused && styles.inputFocused]}>
      <View style={[styles.socialIcon, { backgroundColor: meta.bg }]}>
        <Text style={styles.socialGlyph}>{meta.glyph}</Text>
      </View>
      <View style={styles.socialField}>
        <Text style={styles.socialLabel}>
          {meta.label}{optional ? " · optional" : ""}
        </Text>
        <TextInput
          style={styles.socialInput}
          placeholder="@yourhandle"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>
      {value.trim().length > 0 && <CheckCircle2 size={16} color={colors.green} />}
    </View>
  );
}

function HintRow({ done, label, colors }: { done: boolean; label: string; colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <CheckCircle2 size={13} color={done ? colors.green : colors.textMuted} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: done ? colors.green : colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    backButton: { flexDirection: "row", alignItems: "center", gap: 4, width: 80 },
    backText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingTop: 8, paddingBottom: 100 },

    rewardBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent + "12", borderWidth: 1, borderColor: colors.accent + "22", marginBottom: 20 },
    rewardText: { fontSize: 12.5, fontWeight: "600", color: colors.accentLight },

    stepIntro: { marginBottom: 22, gap: 4 },
    eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.accent },
    stepTitle: { fontFamily: "serif", fontSize: 27, fontWeight: "700", color: colors.text, lineHeight: 32 },
    stepSubtitle: { fontSize: 14.5, color: colors.textSecondary },

    errorBox: { backgroundColor: colors.red + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.red + "30", marginBottom: 16 },
    errorText: { fontSize: 14, color: colors.red, fontWeight: "500" },

    stepContent: { gap: 16 },
    inputGroup: { gap: 6 },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    counter: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1.5, borderColor: colors.inputBorder },
    inputFocused: { borderColor: colors.accent, backgroundColor: colors.card },
    textArea: { minHeight: 90, paddingTop: 14 },
    usernameWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBackground, borderRadius: 14, borderWidth: 1.5, borderColor: colors.inputBorder },
    atPrefix: { fontSize: 16, paddingLeft: 16, fontWeight: "600" },
    row: { flexDirection: "row", gap: 10 },
    passwordHints: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6, marginLeft: 4 },

    detectButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.accent + "40", backgroundColor: colors.accent + "0A" },
    detectButtonFilled: { borderColor: colors.green + "50", backgroundColor: colors.green + "0F" },
    detectButtonText: { fontSize: 14.5, fontWeight: "600", color: colors.accent, flex: 1 },

    avatarPicker: { alignSelf: "center", marginTop: 10 },
    avatarRing: { width: 132, height: 132, borderRadius: 66, padding: 4, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
    avatarPreview: { width: "100%", height: "100%", borderRadius: 62 },
    avatarPlaceholder: { width: "100%", height: "100%", borderRadius: 62, backgroundColor: colors.accent + "12", alignItems: "center", justifyContent: "center" },
    avatarBadge: { position: "absolute", bottom: 4, right: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background },
    avatarHint: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 14, fontWeight: "500" },
    skipButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, marginTop: 4 },
    skipText: { fontSize: 15, fontWeight: "600", color: colors.accentLight },

    socialRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.inputBackground, borderRadius: 14, borderWidth: 1.5, borderColor: colors.inputBorder, paddingHorizontal: 12, paddingVertical: 10 },
    socialIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    socialGlyph: { fontSize: 18, color: "#FFFFFF", fontWeight: "700" },
    socialField: { flex: 1 },
    socialLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
    socialInput: { fontSize: 16, color: colors.text, paddingVertical: Platform.OS === "ios" ? 2 : 0 },

    followerNote: { backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 4 },
    followerNoteOk: { backgroundColor: colors.accent + "0D", borderColor: colors.accent + "22" },
    followerNoteText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500", textAlign: "center" },

    nicheGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    nichePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder, gap: 6 },
    nichePillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    nichePillText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    nichePillTextActive: { color: colors.background },
    nicheCount: { fontSize: 13, fontWeight: "600", color: colors.accent, marginTop: 4 },

    bottomBar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    ctaButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    ctaInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontSize: 17, fontWeight: "700", color: colors.background },
  });
}
