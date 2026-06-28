import { useRouter } from "expo-router";
import {
  ChevronRight,
  Pencil,
  Settings,
  Wallet,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { colors } = useTheme();
  const currency = useCurrency();
  const [avatarError, setAvatarError] = useState(false);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/dashboard") as any;
      return data ?? {};
    },
    enabled: !!session?.user?.id,
  });

  const bookingCounts = {
    completed: dashboard?.bookingCounts?.completed ?? 0,
    cancelled: dashboard?.bookingCounts?.cancelled ?? 0,
  };
  const walletBalance = dashboard?.walletBalance ?? 0;

  const followersFormatted = profile?.followers_count
    ? (profile.followers_count >= 1000000
      ? `${(profile.followers_count / 1000000).toFixed(1)}M`
      : profile.followers_count >= 1000
        ? `${(profile.followers_count / 1000).toFixed(0)}K`
        : String(profile.followers_count))
    : "—";

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <Pressable style={styles.settingsGear} onPress={() => router.push("/settings")}>
            <Settings size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            {profile?.avatar_url && !avatarError ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
          </View>
          <Text style={styles.name}>{profile?.full_name ?? "Creator"}</Text>
          <Text style={styles.username}>@{profile?.instagram_handle ?? "famepass"}</Text>
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          <Pressable style={styles.editButton} onPress={() => router.push("/edit-profile")}>
            <Pencil size={14} color={colors.accent} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Connected Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
          <View style={styles.socialRow}>
            <View style={styles.socialBadge}>
              <Text style={styles.socialEmoji}>📸</Text>
              <Text style={styles.socialBadgeName}>Instagram</Text>
              <Text style={styles.socialFollowers}>
                {profile?.instagram_handle
                  ? `@${profile.instagram_handle}${profile.followers_count ? ` · ${followersFormatted}` : ""}`
                  : "Not connected"}
              </Text>
            </View>
            <View style={styles.socialBadge}>
              <Text style={styles.socialEmoji}>🎵</Text>
              <Text style={styles.socialBadgeName}>TikTok</Text>
              <Text style={styles.socialFollowers}>
                {profile?.tiktok_handle
                  ? `@${profile.tiktok_handle}${profile.followers_count ? ` · ${followersFormatted}` : ""}`
                  : "Not connected"}
              </Text>
            </View>
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsGrid}>
            <View style={styles.insightCard}>
              <View style={[styles.insightDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.insightValue}>{followersFormatted}</Text>
              <Text style={styles.insightLabel}>Total Followers</Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightDot, { backgroundColor: colors.green }]} />
              <Text style={styles.insightValue}>{profile?.engagement_rate ? `${profile.engagement_rate}%` : "—"}</Text>
              <Text style={styles.insightLabel}>Engagement Rate</Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightDot, { backgroundColor: colors.accentLight }]} />
              <Text style={styles.insightValue}>{String(bookingCounts?.completed ?? 0)}</Text>
              <Text style={styles.insightLabel}>Offers Attended</Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightDot, { backgroundColor: colors.red }]} />
              <Text style={styles.insightValue}>{String(bookingCounts?.cancelled ?? 0)}</Text>
              <Text style={styles.insightLabel}>Cancelled</Text>
            </View>
          </View>
        </View>

        {/* Quick links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.settingsList}>
            <Pressable style={styles.settingsItem} onPress={() => router.push("/(tabs)/attendance")}>
              <View style={styles.settingsItemLeft}>
                <Wallet size={18} color={colors.textSecondary} />
                <Text style={styles.settingsItemText}>My Bookings</Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable style={styles.settingsItem} onPress={() => router.push("/(tabs)/earnings")}>
              <View style={styles.settingsItemLeft}>
                <Wallet size={18} color={colors.accentLight} />
                <Text style={styles.settingsItemText}>Earnings{walletBalance > 0 ? ` · ${currency} ${walletBalance.toLocaleString()}` : ""}</Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.settingsItem, { borderBottomWidth: 0 }]} onPress={() => router.push("/settings")}>
              <View style={styles.settingsItemLeft}>
                <Settings size={18} color={colors.textSecondary} />
                <Text style={styles.settingsItemText}>Settings</Text>
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    settingsGear: { position: "absolute", top: 8, right: 20, zIndex: 10, padding: 8 },
    profileHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
    avatarContainer: { position: "relative", marginBottom: 16 },
    avatarGlow: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: 50, backgroundColor: colors.accent + "18" },
    avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: colors.accent + "40" },
    avatarPlaceholder: { backgroundColor: colors.surfaceElevated },
    name: { fontSize: 22, fontWeight: "700", color: colors.text },
    username: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    bio: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 10, lineHeight: 20, paddingHorizontal: 8 },
    editButton: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.accent + "40", gap: 6 },
    editButtonText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    section: { marginTop: 24, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 14 },
    socialRow: { flexDirection: "row", gap: 10 },
    socialBadge: { flex: 1, alignItems: "center", backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.cardBorder, gap: 6 },
    socialEmoji: { fontSize: 18 },
    socialBadgeName: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    socialFollowers: { fontSize: 12, fontWeight: "700", color: colors.text },
    insightsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    insightCard: { width: "47%", backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 },
    insightDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    insightValue: { fontSize: 22, fontWeight: "700", color: colors.text },
    insightLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
    settingsList: { backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.cardBorder },
    settingsItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    settingsItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingsItemText: { fontSize: 15, fontWeight: "500", color: colors.text },
  });
}
