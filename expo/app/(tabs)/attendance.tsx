import { useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  KeyRound,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal as RNModal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

type BookingTab = "upcoming" | "past" | "cancelled";

interface Booking {
  id: string;
  venue_name?: string;
  venue_logo_url?: string;
  offer_title?: string;
  value_worth?: string;
  date: string;
  status: string;
  qr_code?: string;
  offer_id?: string;
}

const TABS: { key: BookingTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "#34D399" },
  pending: { label: "Pending", color: "#F59E0B" },
  checked_in: { label: "Checked In", color: "#B8923A" },
  completed: { label: "Completed", color: "#34D399" },
  no_show: { label: "No Show", color: "#EF4444" },
  cancelled: { label: "Cancelled", color: "#EF4444" },
};

const UPCOMING_STATUSES = ["confirmed", "pending"];
const PAST_STATUSES = ["checked_in", "completed", "no_show"];
const CANCELLED_STATUSES = ["cancelled"];

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: "#5E5E5E" };
}

export default function AttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await supabase
        .from("bookings")
        .select(`
          *,
          offers!inner(id, title, value_worth, offer_type),
          venues!inner(id, name, logo_url, city)
        `)
        .eq("influencer_id", session.user.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((b: any) => ({
        id: b.id,
        venue_name: b.venues?.name ?? "Venue",
        venue_logo_url: b.venues?.logo_url ?? null,
        offer_title: b.offers?.title ?? "Offer",
        value_worth: b.offers?.value_worth ?? "$0",
        date: b.booking_date ?? b.created_at,
        status: b.status ?? "confirmed",
        qr_code: b.qr_code ?? null,
        offer_id: b.offer_id ?? null,
      })) as Booking[];
    },
    enabled: !!session?.user?.id,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ bookingId, code }: { bookingId: string; code: string }) => {
      const { data: booking } = await supabase
        .from("bookings")
        .select("qr_code")
        .eq("id", bookingId)
        .single();

      if (booking?.qr_code && booking.qr_code !== code) {
        throw new Error("Invalid code. Please check the code from the venue.");
      }

      await supabase.from("bookings").update({ status: "checked_in" }).eq("id", bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setCheckInBooking(null);
      setOtpInput("");
      setOtpError(null);
    },
    onError: (err: any) => {
      setOtpError(err?.message ?? "Failed to check in.");
    },
  });

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    switch (activeTab) {
      case "upcoming":
        return bookings.filter((b: Booking) => UPCOMING_STATUSES.includes(b.status));
      case "past":
        return bookings.filter((b: Booking) => PAST_STATUSES.includes(b.status));
      case "cancelled":
        return bookings.filter((b: Booking) => CANCELLED_STATUSES.includes(b.status));
    }
  }, [bookings, activeTab]);

  const handleCheckIn = useCallback((booking: Booking) => {
    setOtpInput("");
    setOtpError(null);
    setCheckInBooking(booking);
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>Track your confirmed offers and events</Text>
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
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
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
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Calendar size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusConfig = getStatusConfig(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  {item.venue_logo_url ? (
                    <Image source={{ uri: item.venue_logo_url }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, styles.cardImagePlc]} />
                  )}
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardVenue} numberOfLines={1}>{item.venue_name}</Text>
                      <View style={[styles.statusChip, { backgroundColor: statusConfig.color + "18" }]}>
                        <Text style={[styles.statusChipText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.offer_title}</Text>
                    <View style={styles.cardMeta}>
                      <View style={styles.cardDateRow}>
                        <Calendar size={13} color={colors.textMuted} />
                        <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardValue}>{item.value_worth}</Text>
                      {activeTab === "upcoming" && (
                        <Pressable style={styles.checkInButton} onPress={() => handleCheckIn(item)}>
                          <KeyRound size={13} color={colors.accent} />
                          <Text style={styles.checkInText}>Check In</Text>
                        </Pressable>
                      )}
                      {item.offer_id && (
                        <Pressable onPress={() => router.push(`/offer/${item.offer_id}`)}>
                          <ChevronRight size={16} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Check-in Modal */}
      <RNModal
        visible={!!checkInBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckInBooking(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCheckInBooking(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <KeyRound size={36} color={colors.accent} />
            <Text style={styles.modalTitle}>Check In</Text>
            <Text style={styles.modalSubtitle}>
              Enter the code provided by {checkInBooking?.venue_name}
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={otpInput}
              onChangeText={setOtpInput}
              autoCapitalize="none"
              autoFocus
            />

            {otpError && <Text style={styles.otpError}>{otpError}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setCheckInBooking(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, checkInMutation.isPending && { opacity: 0.5 }]}
                onPress={() => {
                  if (checkInBooking && otpInput.trim()) {
                    checkInMutation.mutate({ bookingId: checkInBooking.id, code: otpInput.trim() });
                  }
                }}
                disabled={checkInMutation.isPending || !otpInput.trim()}
              >
                {checkInMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </RNModal>
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
    card: { backgroundColor: colors.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.cardBorder },
    cardTop: { flexDirection: "row" },
    cardImage: { width: 110, minHeight: 130, backgroundColor: colors.surfaceElevated },
    cardImagePlc: {},
    cardContent: { flex: 1, padding: 12, justifyContent: "space-between" },
    cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardVenue: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, flex: 1, marginRight: 8 },
    statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusChipText: { fontSize: 10, fontWeight: "700" },
    cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 18, marginTop: 4 },
    cardMeta: { marginTop: 6, gap: 4 },
    cardDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    cardDate: { fontSize: 12, color: colors.textMuted },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    cardValue: { fontSize: 15, fontWeight: "700", color: colors.accent },
    checkInButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.accent + "12" },
    checkInText: { fontSize: 12, fontWeight: "600", color: colors.accent },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 32 },
    modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder, gap: 14 },
    modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    otpInput: { width: "100%", backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: "700", color: colors.text, borderWidth: 1, borderColor: colors.inputBorder, textAlign: "center" },
    otpError: { fontSize: 13, color: colors.red, fontWeight: "500" },
    modalActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
    modalCancel: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    modalSubmit: { flex: 1, alignItems: "center", backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14 },
    modalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.background },
  });
}
