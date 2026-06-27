import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import {
  Calendar,
  CheckCircle2,
  Clock,
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
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import {
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  PLATFORM_NAMES,
  type Platform,
  type Offer,
  type OfferStatus,
} from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const POST_TYPE_LABELS: Record<string, string> = {
  story: "Story",
  reel: "Reel",
  feed_post: "Feed Post",
};

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <View style={styles.platformBadge}>
      <Text style={styles.platformBadgeText}>{PLATFORM_NAMES[platform]}</Text>
    </View>
  );
}

function mapOfferFromDB(item: any): Offer {
  return {
    id: item.id,
    title: item.title ?? "",
    description: item.description ?? "",
    category: item.category ?? "food_drink",
    mediaUrl: item.media_url ?? "",
    mediaType: item.media_type ?? "image",
    venueId: item.venue_id ?? "",
    venueName: item.venues?.name ?? "Venue",
    venueLogoUrl: item.venues?.logo_url ?? "",
    venueVerified: item.venues?.verified ?? false,
    minFollowers: item.min_followers ?? 0,
    minEngagementRate: item.min_engagement_rate ?? 0,
    platforms: item.platforms ?? [],
    offerValue: item.value_worth ?? "$0",
    slotsTotal: item.max_redemptions ?? 0,
    slotsRemaining: (item.max_redemptions ?? 0) - (item.current_redemptions ?? 0),
    expiryDate: item.end_date ?? "",
    bookingWindow: "",
    location: { address: item.venues?.address ?? "", city: item.venues?.city ?? "", lat: 0, lon: 0 },
    postRequirements: {
      postType: item.post_type ?? "story",
      numberOfPosts: item.number_of_posts ?? 1,
      captionRequirements: item.caption_requirements ?? "",
    },
    status: item.is_active
      ? ((item.max_redemptions && item.current_redemptions >= item.max_redemptions) ? "full" : "open")
      : "expired",
    type: item.type ?? "offer",
    eventDate: item.event_date ?? undefined,
    eventTime: item.event_time ?? undefined,
  };
}

function getStatusColor(status: OfferStatus): string {
  switch (status) {
    case "open": return Colors.dark.statusOpen;
    case "full": return Colors.dark.statusFull;
    default: return Colors.dark.statusExpired;
  }
}

function getStatusLabel(status: OfferStatus): string {
  switch (status) {
    case "open": return "Open";
    case "full": return "Full";
    default: return "Expired";
  }
}

export default function OfferDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  const [applied, setApplied] = useState(false);

  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("offers")
        .select("*, venues:venue_id(name, logo_url, verified, address, city)")
        .eq("id", id)
        .single();
      if (!data) return null;
      return mapOfferFromDB(data);
    },
    enabled: !!id,
  });

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

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!id || !session?.user?.id) throw new Error("Not authenticated");
      await supabase.from("offer_redemptions").insert({
        offer_id: id,
        influencer_id: session.user.id,
        status: "pending",
      });
    },
    onSuccess: () => {
      setApplied(true);
      queryClient.invalidateQueries({ queryKey: ["offer-redemption", id] });
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
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

  const statusColor = getStatusColor(offer.status);
  const statusLabel = getStatusLabel(offer.status);
  const categoryColor = CATEGORY_COLORS[offer.category];
  const isDisabled = offer.status !== "open" || (alreadyApplied ?? false) || applied;
  const isFull = offer.status === "full" || (offer.slotsRemaining <= 0 && offer.status === "open");

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
              <MapPin size={48} color={Colors.dark.textMuted} />
            </View>
          )}
          <View style={styles.heroOverlay}>
            <View style={styles.heroTopRow}>
              <View style={[styles.statusChip, { backgroundColor: statusColor + "25", borderColor: statusColor + "40" }]}>
                <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={[styles.categoryChip, { backgroundColor: categoryColor + "30" }]}>
                <Text style={[styles.categoryChipText, { color: categoryColor }]}>{CATEGORY_NAMES[offer.category]}</Text>
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
                {offer.venueVerified && <Star size={14} color={Colors.dark.accent} fill={Colors.dark.accent} />}
              </View>
              <View style={styles.locationRow}>
                <MapPin size={13} color={Colors.dark.textMuted} />
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
              <Text style={styles.detailCardValue}>{offer.offerValue}</Text>
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
              <Calendar size={14} color={Colors.dark.textSecondary} />
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
              <Users size={15} color={Colors.dark.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Minimum Followers</Text>
                <Text style={styles.requirementValue}>{offer.minFollowers.toLocaleString()}+</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <Star size={15} color={Colors.dark.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Min Engagement Rate</Text>
                <Text style={styles.requirementValue}>{offer.minEngagementRate}%</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <Share2 size={15} color={Colors.dark.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Accepted Platforms</Text>
                <View style={styles.platformsRow}>
                  {offer.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
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
              <MessageSquareText size={15} color={Colors.dark.textSecondary} />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Post Type</Text>
                <Text style={styles.requirementValue}>{POST_TYPE_LABELS[offer.postRequirements.postType] ?? offer.postRequirements.postType}</Text>
              </View>
            </View>
            <View style={styles.requirementDivider} />
            <View style={styles.requirementRow}>
              <CheckCircle2 size={15} color={Colors.dark.textSecondary} />
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
            <MapPin size={24} color={Colors.dark.accent} />
            <Text style={styles.mapAddress}>{offer.location.address}</Text>
          </View>
        </View>

        {/* Event */}
        {offer.type === "event" && offer.eventDate && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionLabel}>Event Details</Text>
            <View style={styles.eventCard}>
              <View style={styles.eventRow}>
                <Calendar size={16} color={Colors.dark.accent} />
                <View>
                  <Text style={styles.eventLabel}>Date</Text>
                  <Text style={styles.eventValue}>{offer.eventDate}</Text>
                </View>
              </View>
              <View style={styles.requirementDivider} />
              <View style={styles.eventRow}>
                <Clock size={16} color={Colors.dark.accent} />
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
            <CheckCircle2 size={18} color={Colors.dark.green} />
            <Text style={styles.ctaSuccessText}>Applied</Text>
          </View>
        ) : offer.status === "expired" ? (
          <View style={[styles.ctaButton, styles.ctaDisabled]}>
            <Text style={styles.ctaDisabledText}>Offer Expired</Text>
          </View>
        ) : isFull ? (
          <View style={[styles.ctaButton, styles.ctaDisabled]}>
            <XCircle size={18} color={Colors.dark.textMuted} />
            <Text style={styles.ctaDisabledText}>All Slots Full</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.ctaButton, applyMutation.isPending && { opacity: 0.6 }]}
            onPress={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.dark.background} />
            ) : (
              <Text style={styles.ctaText}>Request to Attend</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  centerContent: { alignItems: "center", justifyContent: "center" },
  notFoundText: { fontSize: 18, fontWeight: "600", color: Colors.dark.textSecondary, marginBottom: 16 },
  backButtonAlt: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.dark.accent, borderRadius: 12 },
  backButtonAltText: { fontSize: 15, fontWeight: "600", color: Colors.dark.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  heroContainer: { width: SCREEN_WIDTH, height: 280, position: "relative" },
  heroMedia: { width: "100%", height: "100%" },
  heroPlaceholder: { backgroundColor: Colors.dark.surfaceElevated, alignItems: "center", justifyContent: "center" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between", paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: "rgba(0,0,0,0.25)" },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between" },
  statusChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  statusChipText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.5)" },
  categoryChipText: { fontSize: 12, fontWeight: "700" },
  venueSection: { paddingHorizontal: 20, marginTop: -24, zIndex: 10 },
  venueRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.dark.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder, gap: 12 },
  venueLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.dark.surfaceElevated, borderWidth: 2, borderColor: Colors.dark.background },
  venueLogoPlaceholder: { backgroundColor: Colors.dark.surfaceElevated },
  venueInfo: { flex: 1 },
  venueNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  venueName: { fontSize: 16, fontWeight: "700", color: Colors.dark.text },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { fontSize: 13, color: Colors.dark.textMuted, flex: 1 },
  contentSection: { paddingHorizontal: 20, marginTop: 24 },
  offerTitle: { fontSize: 24, fontWeight: "700", color: Colors.dark.text, lineHeight: 30 },
  offerDescription: { fontSize: 15, color: Colors.dark.textSecondary, lineHeight: 22, marginTop: 10 },
  sectionLabel: { fontSize: 16, fontWeight: "700", color: Colors.dark.text, marginBottom: 12 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailCard: { width: "47%", backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder, gap: 4 },
  detailCardValue: { fontSize: 20, fontWeight: "700", color: Colors.dark.accent },
  detailCardDate: { fontSize: 14, fontWeight: "600", color: Colors.dark.textSecondary, marginTop: 4 },
  detailCardLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: "500" },
  requirementsCard: { backgroundColor: Colors.dark.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, overflow: "hidden" },
  requirementRow: { flexDirection: "row", padding: 14, gap: 12, alignItems: "flex-start" },
  requirementContent: { flex: 1 },
  requirementLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: "500", marginBottom: 2 },
  requirementValue: { fontSize: 15, fontWeight: "600", color: Colors.dark.text },
  requirementDivider: { height: 1, backgroundColor: Colors.dark.cardBorder, marginLeft: 40 },
  platformsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  platformBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.dark.surfaceElevated, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  platformBadgeText: { fontSize: 12, fontWeight: "600", color: Colors.dark.textSecondary },
  captionContainer: { padding: 14, paddingLeft: 40, gap: 4 },
  captionLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: "500" },
  captionText: { fontSize: 14, color: Colors.dark.text, lineHeight: 20, fontWeight: "500" },
  mapCard: { backgroundColor: Colors.dark.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 20, alignItems: "center", gap: 8 },
  mapAddress: { fontSize: 14, color: Colors.dark.textSecondary, textAlign: "center", fontWeight: "500", lineHeight: 20 },
  eventCard: { backgroundColor: Colors.dark.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, overflow: "hidden" },
  eventRow: { flexDirection: "row", padding: 14, gap: 12, alignItems: "center" },
  eventLabel: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: "500" },
  eventValue: { fontSize: 15, fontWeight: "600", color: Colors.dark.text },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.dark.background, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  ctaButton: { backgroundColor: Colors.dark.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaText: { fontSize: 17, fontWeight: "700", color: Colors.dark.background },
  ctaDisabled: { backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  ctaDisabledText: { fontSize: 17, fontWeight: "600", color: Colors.dark.textMuted },
  ctaSuccess: { backgroundColor: Colors.dark.green + "15", borderWidth: 1, borderColor: Colors.dark.green + "30" },
  ctaSuccessText: { fontSize: 17, fontWeight: "700", color: Colors.dark.green },
});
