import { useRouter } from "expo-router";
import {
  ChevronRight,
  Pencil,
  Settings,
  Wallet,
} from "lucide-react-native";
import React, { useCallback } from "react";
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

import Colors from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

function InsightCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightDot, { backgroundColor: color }]} />
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();

  const { data: bookingCounts } = useQuery({
    queryKey: ["booking-counts"],
    queryFn: async () => {
      if (!session?.user?.id) return { completed: 0, cancelled: 0 };
      const [{ count: completed }, { count: cancelled }] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("influencer_id", session.user.id).eq("status", "completed"),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("influencer_id", session.user.id).eq("status", "cancelled"),
      ]);
      return { completed: completed ?? 0, cancelled: cancelled ?? 0 };
    },
    enabled: !!session?.user?.id,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      if (!session?.user?.id) return 0;
      const { data } = await supabase.rpc("get_wallet_balance", { _user_id: session.user.id });
      return (data as number) ?? 0;
    },
    enabled: !!session?.user?.id,
  });

  const followersFormatted = profile?.followers_count
    ? (profile.followers_count >= 1000000
      ? `${(profile.followers_count / 1000000).toFixed(1)}M`
      : profile.followers_count >= 1000
        ? `${(profile.followers_count / 1000).toFixed(0)}K`
        : String(profile.followers_count))
    : "—";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <Pressable style={styles.settingsGear} onPress={() => router.push("/settings")}>
            <Settings size={20} color={Colors.dark.textSecondary} />
          </Pressable>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
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
            <Pencil size={14} color={Colors.dark.accent} />
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
                {profile?.instagram_handle ? `@${profile.instagram_handle}` : "Not connected"}
              </Text>
            </View>
            <View style={styles.socialBadge}>
              <Text style={styles.socialEmoji}>🎵</Text>
              <Text style={styles.socialBadgeName}>TikTok</Text>
              <Text style={styles.socialFollowers}>
                {profile?.tiktok_handle ? `@${profile.tiktok_handle}` : "Not connected"}
              </Text>
            </View>
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsGrid}>
            <InsightCard label="Total Followers" value={followersFormatted} color={Colors.dark.accent} />
            <InsightCard label="Engagement Rate" value={profile?.engagement_rate ? `${profile.engagement_rate}%` : "—"} color={Colors.dark.green} />
            <InsightCard label="Offers Attended" value={String(bookingCounts?.completed ?? 0)} color={Colors.dark.accentLight} />
            <InsightCard label="Cancelled" value={String(bookingCounts?.cancelled ?? 0)} color={Colors.dark.red} />
          </View>
        </View>

        {/* Quick links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.settingsList}>
            <Pressable style={styles.settingsItem} onPress={() => router.push("/(tabs)/attendance")}>
              <View style={styles.settingsItemLeft}>
                <Wallet size={18} color={Colors.dark.textSecondary} />
                <Text style={styles.settingsItemText}>My Bookings</Text>
              </View>
              <ChevronRight size={16} color={Colors.dark.textMuted} />
            </Pressable>
            <Pressable style={styles.settingsItem} onPress={() => router.push("/(tabs)/earnings")}>
              <View style={styles.settingsItemLeft}>
                <Wallet size={18} color={Colors.dark.accentLight} />
                <Text style={styles.settingsItemText}>Earnings{walletBalance ? ` · AED ${walletBalance.toLocaleString()}` : ""}</Text>
              </View>
              <ChevronRight size={16} color={Colors.dark.textMuted} />
            </Pressable>
            <Pressable style={[styles.settingsItem, { borderBottomWidth: 0 }]} onPress={() => router.push("/settings")}>
              <View style={styles.settingsItemLeft}>
                <Settings size={18} color={Colors.dark.textSecondary} />
                <Text style={styles.settingsItemText}>Settings</Text>
              </View>
              <ChevronRight size={16} color={Colors.dark.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  settingsGear: { position: "absolute", top: 8, right: 20, zIndex: 10, padding: 8 },
  profileHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatarGlow: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: 50, backgroundColor: Colors.dark.accent + "18" },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: Colors.dark.accent + "40" },
  avatarPlaceholder: { backgroundColor: Colors.dark.surfaceElevated },
  name: { fontSize: 22, fontWeight: "700", color: Colors.dark.text },
  username: { fontSize: 14, color: Colors.dark.textSecondary, marginTop: 2 },
  bio: { fontSize: 14, color: Colors.dark.textMuted, textAlign: "center", marginTop: 10, lineHeight: 20, paddingHorizontal: 8 },
  editButton: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: Colors.dark.accent + "40", gap: 6 },
  editButtonText: { fontSize: 14, fontWeight: "600", color: Colors.dark.accent },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.dark.text, marginBottom: 14 },
  socialRow: { flexDirection: "row", gap: 10 },
  socialBadge: { flex: 1, alignItems: "center", backgroundColor: Colors.dark.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder, gap: 6 },
  socialEmoji: { fontSize: 18 },
  socialBadgeName: { fontSize: 11, fontWeight: "600", color: Colors.dark.textSecondary },
  socialFollowers: { fontSize: 12, fontWeight: "700", color: Colors.dark.text },
  insightsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  insightCard: { width: "47%", backgroundColor: Colors.dark.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, gap: 4 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  insightValue: { fontSize: 22, fontWeight: "700", color: Colors.dark.text },
  insightLabel: { fontSize: 12, color: Colors.dark.textSecondary, fontWeight: "500" },
  settingsList: { backgroundColor: Colors.dark.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.dark.cardBorder },
  settingsItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  settingsItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingsItemText: { fontSize: 15, fontWeight: "500", color: Colors.dark.text },
});
