import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  KeyRound,
  MapPin,
  Star,
  XCircle,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal as RNModal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { apiRequestWithRefresh } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "#34D399" },
  pending: { label: "Pending", color: "#F59E0B" },
  checked_in: { label: "Checked In", color: "#B8923A" },
  completed: { label: "Completed", color: "#34D399" },
  no_show: { label: "No Show", color: "#EF4444" },
  cancelled: { label: "Cancelled", color: "#EF4444" },
};

export default function BookingDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const currency = useCurrency();

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      if (!id) return null;
      const data = await apiRequestWithRefresh(`/bookings/${id}`) as { booking?: any };
      const b = data.booking ?? data;
      if (!b) return null;
      return {
        id: b.id,
        status: b.status ?? "confirmed",
        date: b.booking_date ?? b.created_at,
        checkedInAt: b.checked_in_at ?? null,
        qrCode: b.qr_code ?? null,
        venueName: b.venues?.name ?? "Venue",
        venueLogoUrl: b.venues?.logo_url ?? null,
        venueAddress: b.venues?.address ?? "",
        venueCity: b.venues?.city ?? "",
        offerTitle: b.offers?.title ?? "Offer",
        offerValue: b.offers?.value_worth ?? "0",
      };
    },
    enabled: !!id,
  });

  const checkInMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!id) throw new Error("No booking");
      await apiRequestWithRefresh(`/bookings/${id}/checkin`, {
        method: "POST",
        body: { code },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setShowCheckIn(false);
      setOtpInput("");
      setOtpError(null);
    },
    onError: (err: any) => {
      setOtpError(err?.message ?? "Failed to check in.");
    },
  });

  const handleCheckIn = useCallback(() => {
    if (otpInput.trim()) {
      checkInMutation.mutate(otpInput.trim());
    }
  }, [otpInput]);

  const isUpcoming = booking?.status === "confirmed" || booking?.status === "pending";
  const statusCfg = booking ? (STATUS_CONFIG[booking.status] ?? { label: booking.status, color: "#5E5E5E" }) : null;

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.notFoundText}>Booking not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const resolvedLogoUrl = booking.venueLogoUrl
    ? (booking.venueLogoUrl.startsWith("http")
      ? booking.venueLogoUrl
      : supabase.storage.from("venues").getPublicUrl(booking.venueLogoUrl).data.publicUrl)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Venue Card */}
        <View style={styles.venueCard}>
          {resolvedLogoUrl ? (
            <Image source={{ uri: resolvedLogoUrl }} style={styles.venueLogo} />
          ) : (
            <View style={[styles.venueLogo, styles.venueLogoPlaceholder]} />
          )}
          <View style={styles.venueInfo}>
            <Text style={styles.venueName}>{booking.venueName}</Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {booking.venueAddress || booking.venueCity || "Location TBD"}
              </Text>
            </View>
          </View>
          {statusCfg && (
            <View style={[styles.statusChip, { backgroundColor: statusCfg.color + "18", borderColor: statusCfg.color + "40" }]}>
              <Text style={[styles.statusChipText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          )}
        </View>

        {/* Offer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Offer</Text>
          <Text style={styles.offerTitle}>{booking.offerTitle}</Text>
          <Text style={styles.offerValue}>{currency} {parseFloat(String(booking.offerValue).replace(/^[^0-9]*/, ""))?.toLocaleString() || booking.offerValue}</Text>
        </View>

        {/* Booking Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Booking Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailCard}>
              <Calendar size={14} color={colors.accent} />
              <Text style={styles.detailCardValue}>
                {new Date(booking.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={styles.detailCardLabel}>Booking Date</Text>
            </View>
            {booking.checkedInAt && (
              <View style={styles.detailCard}>
                <Clock size={14} color={colors.green} />
                <Text style={styles.detailCardValue}>
                  {new Date(booking.checkedInAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text style={styles.detailCardLabel}>Checked In</Text>
              </View>
            )}
          </View>
        </View>

        {/* Check In */}
        {isUpcoming && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Actions</Text>
            <Pressable style={styles.checkInButton} onPress={() => { setOtpInput(""); setOtpError(null); setShowCheckIn(true); }}>
              <KeyRound size={18} color={colors.background} />
              <Text style={styles.checkInButtonText}>Check In at Venue</Text>
            </Pressable>
            <Text style={styles.checkInHint}>Enter the code provided by the venue to confirm your attendance.</Text>
          </View>
        )}
      </ScrollView>

      {/* Check-in Modal */}
      <RNModal visible={showCheckIn} transparent animationType="fade" onRequestClose={() => setShowCheckIn(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCheckIn(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <KeyRound size={36} color={colors.accent} />
            <Text style={styles.modalTitle}>Check In</Text>
            <Text style={styles.modalSubtitle}>
              Enter the code provided by {booking.venueName}
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
              <Pressable style={styles.modalCancel} onPress={() => setShowCheckIn(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, checkInMutation.isPending && { opacity: 0.5 }]}
                onPress={handleCheckIn}
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
    center: { alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 18, fontWeight: "600", color: colors.textSecondary, marginBottom: 16 },
    backButton: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.accent, borderRadius: 12 },
    backButtonText: { fontSize: 15, fontWeight: "600", color: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    venueCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 12,
    },
    venueLogo: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.surfaceElevated },
    venueLogoPlaceholder: { backgroundColor: colors.surfaceElevated },
    venueInfo: { flex: 1 },
    venueName: { fontSize: 17, fontWeight: "700", color: colors.text },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    locationText: { fontSize: 13, color: colors.textMuted, flex: 1 },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
    },
    statusChipText: { fontSize: 11, fontWeight: "700" },
    section: { marginTop: 24 },
    sectionLabel: { fontSize: 14, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    offerTitle: { fontSize: 22, fontWeight: "700", color: colors.text, lineHeight: 28 },
    offerValue: { fontSize: 18, fontWeight: "700", color: colors.accent, marginTop: 6 },
    detailsGrid: { flexDirection: "row", gap: 10 },
    detailCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 4,
    },
    detailCardValue: { fontSize: 16, fontWeight: "700", color: colors.text },
    detailCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    checkInButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
    },
    checkInButtonText: { fontSize: 17, fontWeight: "700", color: colors.background },
    checkInHint: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 10 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 32 },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 14,
    },
    modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    otpInput: {
      width: "100%",
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      textAlign: "center",
    },
    otpError: { fontSize: 13, color: colors.red, fontWeight: "500" },
    modalActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
    modalCancel: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    modalSubmit: { flex: 1, alignItems: "center", backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14 },
    modalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.background },
  });
}
