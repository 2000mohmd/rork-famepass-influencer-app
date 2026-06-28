import { useRouter } from "expo-router";
import {
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

type InviteTab = "pending" | "accepted" | "declined";

interface Invitation {
  id: string;
  influencer_id: string;
  venue_id: string;
  offer_id: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  venue_name?: string;
  venue_logo_url?: string;
  offer_title?: string;
}

const TABS: { key: InviteTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];

export default function InvitationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const currency = useCurrency();
  const [activeTab, setActiveTab] = useState<InviteTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["invitations", activeTab],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select(`
          *,
          venues:venue_id (name, logo_url),
          offers:offer_id (title)
        `)
        .eq("influencer_id", session.user.id)
        .eq("status", activeTab)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((inv: any) => ({
        ...inv,
        venue_name: inv.venues?.name ?? "Venue",
        venue_logo_url: inv.venues?.logo_url ?? null,
        offer_title: inv.offers?.title ?? "Offer",
      })) as Invitation[];
    },
    enabled: !!session?.user?.id,
  });

  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitationId);
      await supabase.from("bookings").insert({
        influencer_id: session?.user?.id,
        invitation_id: invitationId,
        status: "confirmed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invitations-count"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await supabase.from("invitations").update({ status: "declined" }).eq("id", invitationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invitations-count"] });
    },
  });

  const handleAction = useCallback(
    async (invitationId: string, action: "accept" | "decline") => {
      setActionLoading(invitationId);
      try {
        if (action === "accept") {
          await acceptMutation.mutateAsync(invitationId);
        } else {
          await declineMutation.mutateAsync(invitationId);
        }
      } finally {
        setActionLoading(null);
      }
    },
    [],
  );

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invitations</Text>
        <Text style={styles.headerSubtitle}>Offers from venues waiting for your reply</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Clock size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} invitations</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                {item.venue_logo_url ? (
                  <Image source={{ uri: item.venue_logo_url }} style={styles.venueLogo} />
                ) : (
                  <View style={[styles.venueLogo, styles.venueLogoPlaceholder]} />
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.venueName}>{item.venue_name}</Text>
                  <Text style={styles.offerTitle} numberOfLines={1}>
                    {item.offer_title}
                  </Text>
                  {item.message && (
                    <Text style={styles.message} numberOfLines={2}>
                      {item.message}
                    </Text>
                  )}
                </View>
              </View>

              {activeTab === "pending" && (
                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.acceptButton, actionLoading === item.id && styles.buttonDisabled]}
                    onPress={() => handleAction(item.id, "accept")}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color={colors.background} />
                        <Text style={styles.acceptText}>Accept</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.declineButton, actionLoading === item.id && styles.buttonDisabled]}
                    onPress={() => handleAction(item.id, "decline")}
                    disabled={actionLoading === item.id}
                  >
                    <XCircle size={16} color={colors.red} />
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {activeTab !== "pending" && (
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, {
                    backgroundColor: activeTab === "accepted" ? colors.green + "18" : colors.red + "18",
                  }]}>
                    <Text style={[styles.statusBadgeText, {
                      color: activeTab === "accepted" ? colors.green : colors.red,
                    }]}>
                      {activeTab === "accepted" ? "Accepted" : "Declined"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: "700", color: colors.text },
    headerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    tabBar: { flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.cardBorder },
    tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11 },
    tabActive: { backgroundColor: colors.accent + "18" },
    tabText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    tabTextActive: { color: colors.accent },
    listContent: { padding: 16, paddingBottom: 100 },
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
    cardTop: { flexDirection: "row", gap: 12 },
    venueLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceElevated },
    venueLogoPlaceholder: { backgroundColor: colors.surfaceElevated },
    cardInfo: { flex: 1, gap: 4 },
    venueName: { fontSize: 15, fontWeight: "600", color: colors.text },
    offerTitle: { fontSize: 13, color: colors.textSecondary },
    message: { fontSize: 13, color: colors.textMuted, lineHeight: 18, fontStyle: "italic" },
    cardActions: { flexDirection: "row", gap: 10 },
    acceptButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 12, gap: 6 },
    acceptText: { fontSize: 15, fontWeight: "700", color: colors.background },
    declineButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.red + "40", gap: 6 },
    declineText: { fontSize: 15, fontWeight: "600", color: colors.red },
    buttonDisabled: { opacity: 0.5 },
    statusRow: { alignItems: "flex-end" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusBadgeText: { fontSize: 12, fontWeight: "700" },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  });
}
