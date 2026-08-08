import { useRouter } from "expo-router";
import { Camera, Save } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { resolveStorageUrl } from "@/lib/storage";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [instagram, setInstagram] = useState(profile?.instagram_handle ?? "");
  const [tiktok, setTiktok] = useState(profile?.tiktok_handle ?? "");
  const [followers, setFollowers] = useState(
    profile?.followers_count ? String(profile.followers_count) : "",
  );
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [tiktokFollowers, setTiktokFollowers] = useState(
    profile?.tiktok_followers ? String(profile.tiktok_followers) : "",
  );
  const [selectedNiches, setSelectedNiches] = useState<string[]>(profile?.niche ?? []);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Niches come from `categories`, matching how signup collects them.
  const { data: niches } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/categories") as any;
      const cats = Array.isArray(data) ? data : (data?.categories ?? []);
      return (cats as any[]).map((c: any) => ({ id: c.id, name: c.name ?? "" }));
    },
  });

  // Pre-fill all fields from profile on mount
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setBio(profile.bio ?? "");
      setCity(profile.city ?? "");
      setCountry(profile.country ?? "");
      setInstagram(profile.instagram_handle ?? "");
      setTiktok(profile.tiktok_handle ?? "");
      setFollowers(profile.followers_count ? String(profile.followers_count) : "");
      setPhone(profile.phone ?? "");
      setTiktokFollowers(profile.tiktok_followers ? String(profile.tiktok_followers) : "");
      setSelectedNiches(profile.niche ?? []);
    }
  }, [profile]);

  const toggleNiche = useCallback((id: string) => {
    setSelectedNiches((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }, []);

  // Upload to the avatars bucket and store the path; the API resolves it to a URL.
  const pickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);

    const userId = profile?.user_id ?? profile?.id;
    if (!userId) return;
    setAvatarUploading(true);
    try {
      const res = await fetch(uri);
      const arrayBuffer = await res.arrayBuffer();
      const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      await apiRequestWithRefresh("/profile", { method: "PUT", body: { avatar_url: path } });
      refreshProfile?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload photo.");
      setAvatarUri(null);
    } finally {
      setAvatarUploading(false);
    }
  }, [profile, refreshProfile]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(false);
    if (!fullName.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    try {
      await apiRequestWithRefresh("/profile", {
        method: "PUT",
        body: {
          full_name: fullName.trim(),
          bio: bio.trim(),
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          instagram_handle: instagram.trim(),
          tiktok_handle: tiktok.trim(),
          followers_count: Number(followers) || 0,
          phone: phone.trim() || undefined,
          tiktok_followers: Number(tiktokFollowers) || 0,
          niche: selectedNiches,
        },
      });

      refreshProfile?.();
      setSuccess(true);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }, [fullName, bio, city, country, instagram, tiktok, followers, phone, tiktokFollowers, selectedNiches, profile, refreshProfile, router]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Profile updated!</Text>
          </View>
        )}

        {/* Profile photo */}
        <View style={styles.avatarSection}>
          <Pressable style={styles.avatarWrapper} onPress={pickAvatar} disabled={avatarUploading}>
            {avatarUri || profile?.avatar_url ? (
              <Image
                source={{ uri: avatarUri ?? resolveStorageUrl(profile?.avatar_url, "avatars") ?? undefined }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Camera size={22} color={colors.textMuted} />
              </View>
            )}
            {avatarUploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            )}
          </Pressable>
          <Text style={styles.avatarHint}>
            {avatarUploading ? "Uploading…" : "Tap to change photo"}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />
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

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="Your city"
              placeholderTextColor={colors.textMuted}
              value={city}
              onChangeText={setCity}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="Your country"
              placeholderTextColor={colors.textMuted}
              value={country}
              onChangeText={setCountry}
            />
          </View>
        </View>

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

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Instagram followers</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={followers}
              onChangeText={setFollowers}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>TikTok followers</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 20000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={tiktokFollowers}
              onChangeText={setTiktokFollowers}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Your phone number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your niches</Text>
          <View style={styles.nicheGrid}>
            {(niches ?? []).map((n) => {
              const active = selectedNiches.includes(n.id);
              return (
                <Pressable
                  key={n.id}
                  style={[styles.nicheChip, active && styles.nicheChipActive]}
                  onPress={() => toggleNiche(n.id)}
                >
                  <Text style={[styles.nicheChipText, active && { color: colors.background }]}>
                    {n.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Save size={18} color={colors.background} />
              <Text style={styles.saveText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 20, gap: 16, paddingBottom: 60 },
    errorBox: { backgroundColor: colors.red + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.red + "30" },
    errorText: { fontSize: 14, color: colors.red, fontWeight: "500" },
    successBox: { backgroundColor: colors.green + "18", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.green + "30" },
    successText: { fontSize: 14, color: colors.green, fontWeight: "600" },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder },
    textArea: { minHeight: 90, paddingTop: 14 },
    row: { flexDirection: "row", gap: 10 },
    avatarSection: { alignItems: "center", gap: 8, marginBottom: 4 },
    avatarWrapper: { position: "relative" },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceElevated },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder },
    avatarOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
    avatarHint: { fontSize: 12, color: colors.textMuted },
    nicheGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    nicheChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    nicheChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    nicheChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    saveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, marginTop: 12, gap: 8 },
    saveText: { fontSize: 17, fontWeight: "700", color: colors.background },
  });
}
