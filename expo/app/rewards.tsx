import { useRouter } from "expo-router";
import { Award, ChevronLeft, Crown, Trophy } from "lucide-react-native";
import React, { useMemo } from "react";
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
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";
import { resolveStorageUrl } from "@/lib/storage";

/** Tier thresholds mirror the web app's rewards page. */
const TIER_CONFIG: Record<string, { icon: typeof Award; next: string; pointsNeeded: number }> = {
  bronze: { icon: Award, next: "Silver", pointsNeeded: 500 },
  silver: { icon: Award, next: "Gold", pointsNeeded: 1500 },
  gold: { icon: Crown, next: "Platinum", pointsNeeded: 5000 },
  platinum: { icon: Crown, next: "Elite", pointsNeeded: 15000 },
  elite: { icon: Trophy, next: "", pointsNeeded: 0 },
};

interface RewardsResponse {
  points: number;
  tier: string;
  influencer_score: number;
  badge: string;
}

interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  influencer_score: number | null;
  points: number | null;
}

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: rewards, isLoading } = useQuery<RewardsResponse>({
    queryKey: ["rewards"],
    enabled: !!session,
    queryFn: async () => await apiRequestWithRefresh("/rewards") as RewardsResponse,
  });

  const { data: leaderboard } = useQuery<LeaderboardRow[]>({
    queryKey: ["leaderboard"],
    enabled: !!session,
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/leaderboard?limit=10") as { leaderboard?: LeaderboardRow[] };
      return data.leaderboard ?? [];
    },
  });

  const tier = rewards?.tier ?? "bronze";
  const points = rewards?.points ?? 0;
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.bronze;
  const TierIcon = config.icon;
  const progress = config.pointsNeeded > 0
    ? Math.min((points / config.pointsNeeded) * 100, 100)
    : 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Rewards & Status</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Current tier */}
          <View style={styles.tierCard}>
            <View style={styles.tierRow}>
              <TierIcon size={38} color={colors.accent} />
              <View>
                <Text style={styles.tierName}>{tier} tier</Text>
                <Text style={styles.tierPoints}>{points.toLocaleString()} points earned</Text>
              </View>
            </View>

            {config.pointsNeeded > 0 && (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {Math.max(config.pointsNeeded - points, 0).toLocaleString()} points to {config.next}
                </Text>
              </>
            )}
          </View>

          {/* Score */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{rewards?.influencer_score ?? 0}</Text>
              <Text style={styles.statLabel}>Creator score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statBadge]}>{rewards?.badge ?? "bronze"}</Text>
              <Text style={styles.statLabel}>Badge</Text>
            </View>
          </View>

          {/* Leaderboard */}
          <Text style={styles.sectionTitle}>Top creators</Text>
          <View style={styles.leaderCard}>
            {(leaderboard ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No leaderboard data yet.</Text>
            ) : (
              (leaderboard ?? []).map((row, i) => {
                const isMe = row.user_id === session?.user?.id;
                const avatar = resolveStorageUrl(row.avatar_url, "avatars");
                return (
                  <View key={row.user_id} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                    <Text style={styles.leaderRank}>{i + 1}</Text>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.leaderAvatar} />
                    ) : (
                      <View style={[styles.leaderAvatar, styles.leaderAvatarPlc]} />
                    )}
                    <Text style={styles.leaderName} numberOfLines={1}>
                      {row.full_name ?? "Creator"}{isMe ? " (you)" : ""}
                    </Text>
                    <Text style={styles.leaderScore}>{row.influencer_score ?? 0}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
    tierCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, padding: 16, gap: 12 },
    tierRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    tierName: { fontSize: 20, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
    tierPoints: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
    progressText: { fontSize: 12, color: colors.textMuted },
    statsRow: { flexDirection: "row", gap: 12 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, alignItems: "center", gap: 4 },
    statValue: { fontSize: 22, fontWeight: "700", color: colors.accent },
    statBadge: { fontSize: 18, textTransform: "capitalize" },
    statLabel: { fontSize: 12, color: colors.textMuted },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    leaderCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
    leaderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    leaderRowMe: { backgroundColor: colors.accent + "12" },
    leaderRank: { fontSize: 13, fontWeight: "700", color: colors.textMuted, width: 20 },
    leaderAvatar: { width: 32, height: 32, borderRadius: 16 },
    leaderAvatarPlc: { backgroundColor: colors.surfaceElevated },
    leaderName: { flex: 1, fontSize: 14, color: colors.text },
    leaderScore: { fontSize: 14, fontWeight: "700", color: colors.accent },
    emptyText: { fontSize: 13, color: colors.textMuted, padding: 16, textAlign: "center" },
  });
}
