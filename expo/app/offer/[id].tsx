import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  MessageSquareText,
  Share2,
  Star,
  Users,
  XCircle,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useBookmarkStore } from "@/store/bookmarkStore";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { apiRequestWithRefresh } from "@/lib/api";
import { mapOfferFromAPI } from "@/constants/mockData";
import type { Platform } from "@/constants/mockData";
import { PLATFORM_NAMES } from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const POST_TYPE_LABELS: Record<string, string> = {
  story: "Story",
  reel: "Reel",
  feed_post: "Feed Post",
};

interface Offer {
  id: string;
  title: string;
  description: string;
  category: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  venueId: string;
  venueName: string;
  venueLogoUrl: string;
  venueVerified: boolean;
  minFollowers: number;
  minEngagementRate: number;
  platforms: Platform[];
  offerValue: string;
  slotsTotal: number;
  slotsRemaining: number;
  expiryDate: string;
  bookingWindow: string;
  location: { address: string; city: string; lat: number; lon: number };
  postRequirements: { postType: string; numberOfPosts: number; captionRequirements: string };
  status: "open" | "full" | "expired";
  type: "offer" | "event";
  eventDate?: string;
  eventTime?: string;
}

interface CategoryLookup {
  [key: string]: { name: string; color: string };
}

function PlatformBadge({ platform, colors }: { platform: Platform; colors: ThemeColors }) {
  return (
    <View style={[pStyles.platformBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
      <Text style={[pStyles.platformBadgeText, { color: colors.textSecondary }]}>{PLATFORM_NAMES[platform]}</Text>
    </View>
  );
}

const pStyles = StyleSheet.create({
  platformBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  platformBadgeText: { fontSize: 12, fontWeight: "600" },
});

export default function OfferDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const currency = useCurrency();
  const bookmarkStore = useBookmarkStore();
  const isBookmarked = bookmarkStore.isSaved(id ?? "");

  const [applied, setApplied] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Fetch categories for display lookup
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, color")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  const categoryLookup = useMemo<CategoryLookup>(() => {
    const map: CategoryLookup = {};
    (categoriesData ?? []).forEach((c: any) => {
      map[c.id] = { name: c.name, color: c.color ?? colors.accent };
      if (c.name) {
        const slug = c.name.toLowerCase().replace(/[\s&]+/g, '_').replace(/[^a-z0-9_]/g, '');
        map[slug] = { name: c.name, color: c.color ?? colors.accent };
      }
    });
    return map;
  }, [categoriesData, colors.accent]);

  // Fetch offer via API
  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => {
      if (!id) return null;
      const data = await apiRequestWithRefresh(`/offers/${id}`) as { offer?: any };
      const raw = data.offer ?? data;
      if (!raw) return null;
      return mapOfferFromAPI(raw);
    },
    enabled: !!id,
  });

  // Check if already applied
  const { data: alreadyApplied } = useQuery({
    queryKey: ["offer-redemption", id, session?.user?.id],
    queryFn: async () => {
      if (!id || !session?.user?.id) return false;
      const { count } = await supabase
        .from("offer_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("offer_id", id)
        .eq("influencer_id", session.user.id);
      return (count ?? 0) > 0;
    },
    enabled: !!id && !!session?.user?.id,
  });

  // Apply via API
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No offer ID");
      return apiRequestWithRefresh(`/offers/${id}/accept`, { method: "POST" }) as any;
    },
    onSuccess: (data) => {
      setQrCode(data.qr_code ?? null);
      setShowSuccess(true);
      setShowDatePicker(false);
      queryClient.invalidateQueries({ queryKey: ["offer-redemption", id] });
    },
    onError: (e: any) => {
      Alert.alert("Error", e.message ?? "Failed to apply");
    },
  });

  // ALL hooks must be above this line — styles useMemo before any early returns
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.notFoundText}>Offer not found</Text>
        <Pressable style={styles.backButtonAlt} onPress={() => router.back()}>
          <Text style={styles.backButtonAltText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const catInfo = categoryLookup[offer.category] ?? { name: offer.category, color: colors.accent };
  const statusColor =
    offer.status === "open" ? colors.statusOpen
    : offer.status === "full" ? colors.statusFull
    : colors.statusExpired;
  const statusLabel =
    offer.status === "open" ? "Open"
    : offer.status === "full" ? "Full"
    : "Expired";
  const isFull = offer.status === "full" || (offer.slotsRemaining <= 0 && offer.status === "open");
  const buttonDisabled = offer.status !== "open" || (alreadyApplied ?? false) || applied || isFull;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroContainer}>
          {offer.mediaType === "video" && offer.mediaUrl ? (
            <Video
              source={{ uri: offer.mediaUrl }}
              style={styles.heroMedia}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              useNativeControls
            />
          ) : offer.mediaUrl ? (
            <Image source={{ uri: offer.mediaUrl }} style={styles.heroMedia} resizeMode="cover" />
          ) : (
            <View style={[styles.heroMedia, styles.heroPlaceholder]}>
              <MapPin size={48} color={colors.textMuted} />
            </View>
          )}
          <Pressable
            style={styles.bookmarkHeart}
            onPress={() => bookmarkStore.toggle(id ?? "")}
            hitSlop={8}
          >
            <Heart size={20} color={isBookmarked ? colors.red : "#FFF"} fill={isBookmarked ? colors.red : "transparent"} />
          </Pressable>
          <View style={styles.heroOverlay}>
            <View style={styles.heroTopRow}>
              <View style={[styles.statusChip, { backgroundColor: statusColor + "25", borderColor: statusColor + "40" }]}>
                <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={[styles.categoryChip, { backgroundColor: catInfo.color + "30" }]}>
                <Text style={[styles.categoryChipText, { color: catInfo.color }]}>{catInfo.name}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Venue */}
        <View style={styles.venueSection}>
          <View style={styles.venueRow}>
            {offer.venueLogoUrl ? (
              <Image source={{ uri: offer.venueLogoUrl }} style={styles.venueLogo} />
            ) : (
              <View style={[styles.venueLogo, styles.venueLogoPlaceholder]} />
            )}
            <View style={styles.venueInfo}>
              <View style={styles.venueNameRow}>
                <Text style={styles.venueName}>{offer.venueName}</Text>
                {offer.venueVerified && <Star size={14} color={colors.accent} fill={colors.accent} />}
              </View>
              <View style={styles.locationRow}>
                <MapPin size={13} color={colors.textMuted} />
                <Text style={styles.locationText} numberOfLines={1}>{offer.location.address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Title & Description */}
        <View style={styles.contentSection}>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.offerDescription}>{offer.description}</Text>
        </View>

        {/* Details Grid */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>Offer Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>{currency} {parseFloat(offer.offerValue.replace(/^[^0-9]*/, ""))?.toLocaleString() || offer.offerValue}</Text>
              <Text style={styles.detailCardLabel}>Value / Worth</Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>{offer.slotsRemaining}</Text>
              <Text style={styles.detailCardLabel}>Slots Available</Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>{offer.slotsTotal}</Text>
              <Text style={styles.detailCardLabel}>Total Slots</Text>
            </View>
            <View style={styles.detailCard}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={styles.detailCardDate}>{offer.expiryDate}</Text>
              <Text style={styles.detailCardLabel}>Expiry Date</Text>
            </View>
          </View>
        </View>

        {/* Requirements */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>Requirements</Text>
          <View style={styles.requirementsCard}>
            <View style={styles.requirementRow}>
              <Users size={15} color={colors.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Minimum Followers</Text>
                <Text style={styles.requirementValue}>{offer.minFollowers.toLocaleString()}+</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <Star size={15} color={colors.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Min Engagement Rate</Text>
                <Text style={styles.requirementValue}>{offer.minEngagementRate}%</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <Share2 size={15} color={colors.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Accepted Platforms</Text>
                <View style={styles.platformsRow}>
                  {offer.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} colors={colors} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Post Requirements */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>What You Need to Post</Text>
          <View style={styles.requirementsCard}>
            <View style={styles.requirementRow}>
              <MessageSquareText size={15} color={colors.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Post Type</Text>
                <Text style={styles.requirementValue}>{POST_TYPE_LABELS[offer.postRequirements.postType] ?? offer.postRequirements.postType}</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <CheckCircle2 size={15} color={colors.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Number of Posts</Text>
                <Text style={styles.requirementValue}>{offer.postRequirements.numberOfPosts} {offer.postRequirements.numberOfPosts === 1 ? "post" : "posts"}</Text>
              </View>
            </View>
            {offer.postRequirements.captionRequirements ? (
              <>
                <View style={styles.requirementDivider} />
                <View style={styles.captionContainer}>
                  <Text style={styles.captionLabel}>Caption Requirements</Text>
                  <Text style={styles.captionText}>{offer.postRequirements.captionRequirements}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Location */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>Location</Text>
          <View style={styles.mapCard}>
            <MapPin size={24} color={colors.accent} />
            <Text style={styles.mapAddress}>{offer.location.address}</Text>
          </View>
        </View>

        {/* Event */}
        {offer.type === "event" && offer.eventDate && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionLabel}>Event Details</Text>
            <View style={styles.eventCard}>
              <View style={styles.eventRow}>
                <Calendar size={16} color={colors.accent} />
                <View>
                  <Text style={styles.eventLabel}>Date</Text>
                  <Text style={styles.eventValue}>{offer.eventDate}</Text>
                </View>
              </View>
              <View style={styles.requirementDivider} />
              <View style={styles.eventRow}>
                <Clock size={16} color={colors.accent} />
                <View>
                  <Text style={styles.eventLabel}>Time</Text>
                  <Text style={styles.eventValue}>{offer.eventTime ?? "TBD"}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        {applied || alreadyApplied ? (
          <View style={[styles.ctaButton, styles.ctaSuccess]}>
            <CheckCircle2 size={18} color={colors.green} />
            <Text style={styles.ctaSuccessText}>Applied</Text>
          </View>
        ) : offer.status === "expired" ? (
          <View style={[styles.ctaButton, styles.ctaDisabled]}>
            <Text style={styles.ctaDisabledText}>Offer Expired</Text>
          </View>
        ) : isFull ? (
          <View style={[styles.ctaButton, styles.ctaDisabled]}>
            <XCircle size={18} color={colors.textMuted} />
            <Text style={styles.ctaDisabledText}>All Slots Full</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.ctaButton, applyMutation.isPending && { opacity: 0.6 }]}
            onPress={() => setShowDatePicker(true)}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.ctaText}>Request to Attend</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Date Picker Modal */}
      <RNModal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.dateModal} onPress={() => {}}>
            <Calendar size={32} color={colors.accent} />
            <Text style={styles.dateModalTitle}>Choose visit date</Text>
            <Text style={styles.dateModalSubtitle}>Let the venue know when you plan to visit</Text>

            <View style={styles.dateInputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateInputLabel}>Date</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={visitDate}
                  onChangeText={setVisitDate}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateInputLabel}>Time (optional)</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="e.g. 19:00"
                  placeholderTextColor={colors.textMuted}
                  value={visitTime}
                  onChangeText={setVisitTime}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.dateModalActions}>
              <Pressable style={styles.dateModalCancel} onPress={() => { setShowDatePicker(false); setVisitDate(""); setVisitTime(""); }}>
                <Text style={styles.dateModalCancelText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.dateModalSubmit, applyMutation.isPending && { opacity: 0.6 }]}
                onPress={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.dateModalSubmitText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </RNModal>

      {/* Success Modal with QR Code */}
      <RNModal visible={showSuccess} transparent animationType="slide" onRequestClose={() => setShowSuccess(false)}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModal}>
            <CheckCircle2 size={48} color={colors.green} />
            <Text style={styles.successTitle}>Application Submitted!</Text>
            <Text style={styles.successText}>
              The venue will review and confirm your visit.
            </Text>
            {qrCode && (
              <View style={styles.qrCodeBox}>
                <Text style={styles.qrCode}>{qrCode}</Text>
              </View>
            )}
            <Text style={styles.successHint}>Show this code at the venue when you visit.</Text>
            <Pressable
              style={styles.successBtn}
              onPress={() => {
                setShowSuccess(false);
                router.navigate("/(tabs)/attendance" as any);
              }}
            >
              <Text style={styles.successBtnText}>View My Bookings</Text>
            </Pressable>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContent: { alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 18, fontWeight: "600", color: colors.textSecondary, marginBottom: 16 },
    backButtonAlt: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.accent, borderRadius: 12 },
    backButtonAltText: { fontSize: 15, fontWeight: "600", color: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 120 },
    heroContainer: { width: SCREEN_WIDTH, height: 280, position: "relative" },
    heroMedia: { width: "100%", height: "100%" },
    heroPlaceholder: { backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
    heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between", paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: "rgba(0,0,0,0.25)" },
    heroTopRow: { flexDirection: "row", justifyContent: "space-between" },
    statusChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    statusChipText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    categoryChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.5)" },
    categoryChipText: { fontSize: 12, fontWeight: "700" },
    venueSection: { paddingHorizontal: 20, marginTop: -24, zIndex: 10 },
    venueRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
    venueLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.background },
    venueLogoPlaceholder: { backgroundColor: colors.surfaceElevated },
    venueInfo: { flex: 1 },
    venueNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    venueName: { fontSize: 16, fontWeight: "700", color: colors.text },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    locationText: { fontSize: 13, color: colors.textMuted, flex: 1 },
    contentSection: { paddingHorizontal: 20, marginTop: 24 },
    offerTitle: { fontSize: 24, fontWeight: "700", color: colors.text, lineHeight: 30 },
    offerDescription: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginTop: 10 },
    sectionLabel: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
    detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    detailCard: { width: "47%", backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 },
    detailCardValue: { fontSize: 20, fontWeight: "700", color: colors.accent },
    detailCardDate: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginTop: 4 },
    detailCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    requirementsCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
    requirementRow: { flexDirection: "row", padding: 14, gap: 12, alignItems: "flex-start" },
    requirementContent: { flex: 1 },
    requirementLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500", marginBottom: 2 },
    requirementValue: { fontSize: 15, fontWeight: "600", color: colors.text },
    requirementDivider: { height: 1, backgroundColor: colors.cardBorder, marginLeft: 40 },
    platformsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    captionContainer: { padding: 14, paddingLeft: 40, gap: 4 },
    captionLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    captionText: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: "500" },
    mapCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, padding: 20, alignItems: "center", gap: 8 },
    mapAddress: { fontSize: 14, color: colors.textSecondary, textAlign: "center", fontWeight: "500", lineHeight: 20 },
    eventCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
    eventRow: { flexDirection: "row", padding: 14, gap: 12, alignItems: "center" },
    eventLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    eventValue: { fontSize: 15, fontWeight: "600", color: colors.text },
    bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    ctaButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    ctaText: { fontSize: 17, fontWeight: "700", color: colors.background },
    ctaDisabled: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    ctaDisabledText: { fontSize: 17, fontWeight: "600", color: colors.textMuted },
    ctaSuccess: { backgroundColor: colors.green + "15", borderWidth: 1, borderColor: colors.green + "30" },
    ctaSuccessText: { fontSize: 17, fontWeight: "700", color: colors.green },
    bookmarkHeart: { position: "absolute", top: 50, right: 16, zIndex: 5, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 32 },
    dateModal: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
    dateModalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    dateModalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    dateInputRow: { flexDirection: "row", gap: 10, width: "100%" },
    dateInputLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 },
    dateInput: { backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: colors.text, borderWidth: 1, borderColor: colors.inputBorder, textAlign: "center" },
    dateModalActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
    dateModalCancel: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder },
    dateModalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    dateModalSubmit: { flex: 1, alignItems: "center", backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14 },
    dateModalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.background },
    successModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 32 },
    successModal: { backgroundColor: colors.card, borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder, gap: 16 },
    successTitle: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" },
    successText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
    successHint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
    qrCodeBox: { backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.cardBorder, width: "100%", alignItems: "center" },
    qrCode: { fontSize: 28, fontWeight: "700", color: colors.accent, letterSpacing: 4 },
    successBtn: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14, paddingHorizontal: 32, width: "100%", alignItems: "center" },
    successBtnText: { fontSize: 16, fontWeight: "700", color: colors.background },
  });
}
