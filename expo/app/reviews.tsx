import { useRouter } from "expo-router";
import { ChevronLeft, Star } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";

type ReviewTab = "received" | "given";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  venueName?: string;
}

/** A completed booking the creator hasn't reviewed yet. */
interface ReviewableBooking {
  id: string;
  venueId: string;
  venueName: string;
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<ReviewTab>("received");
  const [writeFor, setWriteFor] = useState<ReviewableBooking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["reviews", activeTab],
    enabled: !!session,
    queryFn: async () => {
      const data = await apiRequestWithRefresh(`/reviews?type=${activeTab}`) as { reviews?: any[] };
      return (data.reviews ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating ?? 0,
        comment: r.comment ?? null,
        created_at: r.created_at,
        venueName: r.venues?.name,
      }));
    },
  });

  // Completed visits are what you're allowed to review; drop the ones already
  // reviewed so the creator can't double-submit for the same booking.
  const { data: reviewable } = useQuery<ReviewableBooking[]>({
    queryKey: ["reviewable-bookings"],
    enabled: !!session,
    queryFn: async () => {
      const [bookingsRes, givenRes] = await Promise.all([
        apiRequestWithRefresh("/bookings?status=completed") as Promise<{ bookings?: any[] }>,
        apiRequestWithRefresh("/reviews?type=given") as Promise<{ reviews?: any[] }>,
      ]);
      const reviewedBookingIds = new Set(
        (givenRes.reviews ?? []).map((r: any) => r.booking_id).filter(Boolean),
      );
      return (bookingsRes.bookings ?? [])
        .filter((b: any) => !reviewedBookingIds.has(b.id))
        .map((b: any) => ({
          id: b.id,
          venueId: b.venue_id,
          venueName: b.venues?.name ?? "Venue",
        }));
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!writeFor) throw new Error("No booking selected");
      await apiRequestWithRefresh("/reviews", {
        method: "POST",
        body: {
          booking_id: writeFor.id,
          venue_id: writeFor.venueId,
          reviewed_id: writeFor.venueId,
          rating,
          comment: comment.trim() || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviewable-bookings"] });
      setWriteFor(null);
      setComment("");
      setRating(5);
      setWriteError(null);
    },
    onError: (e: any) => setWriteError(e?.message ?? "Failed to submit review."),
  });

  const openWrite = useCallback((booking: ReviewableBooking) => {
    setRating(5);
    setComment("");
    setWriteError(null);
    setWriteFor(booking);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabBar}>
        {(["received", "given"] as ReviewTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "received" ? "About me" : "My reviews"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pending reviews to write */}
      {activeTab === "given" && (reviewable ?? []).length > 0 && (
        <View style={styles.pendingBlock}>
          <Text style={styles.pendingTitle}>Waiting for your review</Text>
          {(reviewable ?? []).map((b) => (
            <Pressable key={b.id} style={styles.pendingRow} onPress={() => openWrite(b)}>
              <Text style={styles.pendingVenue} numberOfLines={1}>{b.venueName}</Text>
              <Text style={styles.pendingAction}>Write review</Text>
            </Pressable>
          ))}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={reviews ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Star size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {activeTab === "received" ? "No reviews about you yet" : "You haven't left a review yet"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardVenue} numberOfLines={1}>{item.venueName ?? "Venue"}</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      color={n <= item.rating ? colors.accent : colors.textMuted}
                      fill={n <= item.rating ? colors.accent : "transparent"}
                    />
                  ))}
                </View>
              </View>
              {!!item.comment && <Text style={styles.cardComment}>{item.comment}</Text>}
              <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
          )}
        />
      )}

      {/* Write review modal */}
      <RNModal visible={!!writeFor} transparent animationType="fade" onRequestClose={() => setWriteFor(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setWriteFor(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Review {writeFor?.venueName}</Text>

            <View style={styles.ratingPicker}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Star
                    size={30}
                    color={n <= rating ? colors.accent : colors.textMuted}
                    fill={n <= rating ? colors.accent : "transparent"}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="How was your visit?"
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
            />

            {writeError && <Text style={styles.errorText}>{writeError}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setWriteFor(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, submitReview.isPending && { opacity: 0.5 }]}
                onPress={() => submitReview.mutate()}
                disabled={submitReview.isPending}
              >
                {submitReview.isPending ? (
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    tabBar: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tabText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    tabTextActive: { color: colors.background },
    pendingBlock: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: colors.accent + "10", borderWidth: 1, borderColor: colors.accent + "30", gap: 8 },
    pendingTitle: { fontSize: 12, fontWeight: "700", color: colors.accent, textTransform: "uppercase" },
    pendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    pendingVenue: { flex: 1, fontSize: 14, color: colors.text },
    pendingAction: { fontSize: 13, fontWeight: "700", color: colors.accent },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 6 },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    cardVenue: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
    starRow: { flexDirection: "row", gap: 2 },
    cardComment: { fontSize: 14, color: colors.textSecondary, lineHeight: 19 },
    cardDate: { fontSize: 11, color: colors.textMuted },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    modalContent: { width: "100%", backgroundColor: colors.card, borderRadius: 18, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.cardBorder },
    modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },
    ratingPicker: { flexDirection: "row", justifyContent: "center", gap: 8 },
    commentInput: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, padding: 12, fontSize: 14, color: colors.text, textAlignVertical: "top" },
    errorText: { fontSize: 13, color: colors.red, textAlign: "center" },
    modalActions: { flexDirection: "row", gap: 10 },
    modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", backgroundColor: colors.surfaceElevated },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    modalSubmit: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", backgroundColor: colors.accent },
    modalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.background },
  });
}
