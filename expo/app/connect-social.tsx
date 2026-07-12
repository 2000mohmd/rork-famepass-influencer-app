import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import {
  PLATFORM_NAMES,
  type Platform,
} from "@/constants/offerMapper";

const PLATFORM_DETAILS: Record<
  Platform,
  { color: string; description: string; dataPoints: string[] }
> = {
  instagram: {
    color: "#E1306C",
    description:
      "Connect your Instagram account to verify your follower count, engagement rate, and unlock exclusive offers.",
    dataPoints: [
      "Follower count & growth",
      "Engagement rate",
      "Content performance",
      "Audience demographics",
    ],
  },
  tiktok: {
    color: "#00F2EA",
    description:
      "Connect your TikTok account to showcase your content reach and unlock brand collaborations.",
    dataPoints: [
      "Follower count & growth",
      "Video views & engagement",
      "Trending content analytics",
      "Audience insights",
    ],
  },
  youtube: {
    color: "#FF0000",
    description:
      "Connect your YouTube channel to share your subscriber base and video performance metrics.",
    dataPoints: [
      "Subscriber count",
      "Video views & watch time",
      "Engagement analytics",
      "Content categories",
    ],
  },
  snapchat: {
    color: "#FFFC00",
    description:
      "Connect your Snapchat to unlock exclusive event passes and share your story reach.",
    dataPoints: [
      "Subscriber count",
      "Story views",
      "Engagement metrics",
      "Audience reach",
    ],
  },
};

export default function ConnectSocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string }>();
  const platform = (params.platform as Platform) ?? "instagram";
  const { colors } = useTheme();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const details = PLATFORM_DETAILS[platform];

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsConnecting(false);
    setIsConnected(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  }, [router]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Platform Header */}
        <View style={styles.platformHeader}>
          <View
            style={[
              styles.platformIconLarge,
              { backgroundColor: details.color + "18" },
            ]}
          >
            <ExternalLink size={32} color={details.color} />
          </View>
          <Text style={styles.platformTitle}>
            Connect {PLATFORM_NAMES[platform]}
          </Text>
          <Text style={styles.platformDescription}>
            {details.description}
          </Text>
        </View>

        {/* Data Points */}
        <View style={styles.dataSection}>
          <Text style={styles.dataSectionTitle}>
            What we'll access
          </Text>
          <View style={styles.dataList}>
            {details.dataPoints.map((point, i) => (
              <View key={i} style={styles.dataPoint}>
                <CheckCircle2 size={16} color={colors.green} />
                <Text style={styles.dataPointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.privacyNote}>
          <View style={styles.privacyIconContainer}>
            <ShieldCheck size={20} color={colors.textMuted} />
          </View>
          <Text style={styles.privacyTitle}>Your data is secure</Text>
          <Text style={styles.privacyText}>
            We only read your public profile data and engagement metrics. We
            never post on your behalf without explicit permission. You can
            disconnect at any time from your Profile settings.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        {isConnected ? (
          <View style={styles.successContainer}>
            <CheckCircle2 size={20} color={colors.green} />
            <Text style={styles.successText}>
              Connected! Redirecting...
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.connectButton,
              { backgroundColor: details.color },
              isConnecting && styles.connectButtonDisabled,
            ]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.connectButtonText}>Connecting...</Text>
              </>
            ) : (
              <>
                <ExternalLink size={18} color="#FFF" />
                <Text style={styles.connectButtonText}>
                  Connect {PLATFORM_NAMES[platform]}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingBottom: 120 },
    platformHeader: { alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
    platformIconLarge: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    platformTitle: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 12 },
    platformDescription: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
    dataSection: { marginHorizontal: 20, backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.cardBorder },
    dataSectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 },
    dataList: { gap: 14 },
    dataPoint: { flexDirection: "row", alignItems: "center", gap: 12 },
    dataPointText: { fontSize: 15, color: colors.text, fontWeight: "500" },
    privacyNote: { marginHorizontal: 20, marginTop: 20, alignItems: "center", paddingHorizontal: 12 },
    privacyIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    privacyTitle: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
    privacyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
    bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    connectButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 8 },
    connectButtonDisabled: { opacity: 0.7 },
    connectButtonText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
    successContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, backgroundColor: colors.green + "15", borderRadius: 16, gap: 8, borderWidth: 1, borderColor: colors.green + "30" },
    successText: { fontSize: 16, fontWeight: "600", color: colors.green },
  });
}
