import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Save,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import Colors from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [instagram, setInstagram] = useState(profile?.instagram_handle ?? "");
  const [tiktok, setTiktok] = useState(profile?.tiktok_handle ?? "");
  const [followers, setFollowers] = useState(
    profile?.followers_count ? String(profile.followers_count) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(false);
    if (!fullName.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          bio: bio.trim(),
          instagram_handle: instagram.trim(),
          tiktok_handle: tiktok.trim(),
          followers_count: Number(followers) || 0,
        })
        .eq("id", profile?.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      refreshProfile?.();
      setSuccess(true);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }, [fullName, bio, instagram, tiktok, followers, profile, refreshProfile, router]);

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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.dark.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />
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
          <Text style={styles.label}>Follower count</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 50000"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="numeric"
            value={followers}
            onChangeText={setFollowers}
          />
        </View>

        <Pressable
          style={[styles.saveButton, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.dark.background} />
          ) : (
            <>
              <Save size={18} color={Colors.dark.background} />
              <Text style={styles.saveText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  errorBox: {
    backgroundColor: Colors.dark.red + "18",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.red + "30",
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.red,
    fontWeight: "500",
  },
  successBox: {
    backgroundColor: Colors.dark.green + "18",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.green + "30",
  },
  successText: {
    fontSize: 14,
    color: Colors.dark.green,
    fontWeight: "600",
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
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.accent,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
    gap: 8,
  },
  saveText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.dark.background,
  },
});
