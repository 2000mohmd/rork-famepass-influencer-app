import { useRouter } from "expo-router";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Star,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_NAMES,
  type Offer,
  type Category,
} from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OFFER_CARD_WIDTH = SCREEN_WIDTH * 0.68;
const CATEGORY_ITEM_SIZE = (SCREEN_WIDTH - 64) / 4;

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function OfferCard({ offer, onPress }: { offer: Offer; onPress: () => void }) {
  const statusColor =
    offer.status === "open" ? Colors.dark.statusOpen
    : offer.status === "full" ? Colors.dark.statusFull
    : Colors.dark.statusExpired;
  const statusLabel =
    offer.status === "open" ? "Open"
    : offer.status === "full" ? "Full"
    : "Expired";
  return (
    <Pressable style={[styles.offerCard, { width: OFFER_CARD_WIDTH }]} onPress={onPress}>
      <View style={styles.offerImageContainer}>
        <Image source={{ uri: offer.mediaUrl }} style={styles.offerImage} resizeMode="cover" />
        <View style={styles.offerImageOverlay} />
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{CATEGORY_NAMES[offer.category]}</Text>
        </View>
      </View>
      <View style={styles.offerCardContent}>
        <View style={styles.venueRow}>
          <Image source={{ uri: offer.venueLogoUrl }} style={styles.venueLogo} />
          <View style={styles.venueInfo}>
            <View style={styles.venueNameRow}>
              <Text style={styles.venueName} numberOfLines={1}>{offer.venueName}</Text>
              {offer.venueVerified && <Star size={12} color={Colors.dark.accent} fill={Colors.dark.accent} />}
            </View>
            <Text style={styles.offerTitle} numberOfLines={1}>{offer.title}</Text>
          </View>
        </View>
        {offer.type === "event" && offer.eventDate && (
          <View style={styles.detailRow}>
            <Clock size={14} color={Colors.dark.textSecondary} />
            <Text style={styles.detailText}>{offer.eventDate} at {offer.eventTime ?? "TBD"}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <MapPin size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>{offer.location.city}</Text>
        </View>
        <View style={styles.offerFooter}>
          <Text style={styles.offerValue}>{offer.offerValue}</Text>
          <Text style={styles.slotsText}>{offer.slotsRemaining} / {offer.slotsTotal} slots</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CategoryIcon({ category, onPress }: { category: typeof CATEGORIES[0]; onPress: () => void }) {
  const color = CATEGORY_COLORS[category.key];
  return (
    <Pressable style={[styles.categoryItem, { width: CATEGORY_ITEM_SIZE }]} onPress={onPress}>
      <View style={[styles.categoryIconContainer, { backgroundColor: color + "18", borderColor: color + "30" }]}>
        <View style={[styles.categoryDot, { backgroundColor: color }]} />
      </View>
      <Text style={styles.categoryLabel} numberOfLines={2}>{category.label}</Text>
    </Pressable>
  );
}

function mapOfferFromDB(item: any): Offer {
  return {
    id: item.id,
    title: item.title ?? "",
    description: item.description ?? "",
    category: item.category ?? "food_drink",
    mediaUrl: item.media_url ?? "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
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
    postRequirements: { postType: "story", numberOfPosts: 1, captionRequirements: "" },
    status: item.is_active ? ((item.max_redemptions && item.current_redemptions >= item.max_redemptions) ? "full" : "open") : "expired",
    type: item.type ?? "offer",
    eventDate: item.event_date ?? undefined,
    eventTime: item.event_time ?? undefined,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ["home-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("offers")
        .select("*, venues:venue_id(name, logo_url, verified, address, city)")
        .eq("is_active", true)
        .limit(10)
        .order("created_at", { ascending: false });
      return (data ?? []).map(mapOfferFromDB);
    },
  });

  const { data: events } = useQuery({
    queryKey: ["home-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, venues:venue_id(name, logo_url, verified, address, city)")
        .eq("is_active", true)
        .limit(5)
        .order("event_date", { ascending: true });
      return (data ?? []).map(mapOfferFromDB);
    },
  });

  const handleOfferPress = useCallback(
    (offerId: string) => { router.push(`/offer/${offerId}`); },
    [router],
  );

  const handleCategoryPress = useCallback(
    (category: Category) => {
      router.push({ pathname: "/(tabs)/explore", params: { category } });
    },
    [router],
  );

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
        <View style={styles.header}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{timeGreeting()},</Text>
            <Text style={styles.name}>{profile?.full_name ?? "Creator"}</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.avatarButton}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <View style={styles.avatarGlow} />
          </Pressable>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <TrendingUp size={16} color={Colors.dark.green} />
            <Text style={styles.statValue}>{profile?.engagement_rate ? `${profile.engagement_rate}%` : "—"}</Text>
            <Text style={styles.statLabel}>Engagement</Text>
          </View>
          <View style={styles.statCard}>
            <Star size={16} color={Colors.dark.accent} />
            <Text style={styles.statValue}>{followersFormatted}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar size={16} color={Colors.dark.accentLight} />
            <Pressable onPress={() => router.push("/(tabs)/attendance")}>
              <Text style={[styles.statLabel, { color: Colors.dark.accentLight, marginTop: 6 }]}>My Bookings</Text>
            </Pressable>
          </View>
        </View>

        {/* Featured Offers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Offers</Text>
            <Pressable style={styles.seeAllButton} onPress={() => router.push("/(tabs)/explore")}>
              <Text style={styles.seeAllText}>See all</Text>
              <ArrowRight size={14} color={Colors.dark.accent} />
            </Pressable>
          </View>
          {offersLoading ? (
            <ActivityIndicator size="small" color={Colors.dark.accent} style={{ marginLeft: 20 }} />
          ) : (
            <FlatList
              data={offers ?? []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalScrollContent}
              snapToInterval={OFFER_CARD_WIDTH + 12}
              decelerationRate="fast"
              renderItem={({ item }) => <OfferCard offer={item} onPress={() => handleOfferPress(item.id)} />}
            />
          )}
        </View>

        {/* Upcoming Events */}
        {events && events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <Pressable style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See all</Text>
                <ArrowRight size={14} color={Colors.dark.accent} />
              </Pressable>
            </View>
            <FlatList
              data={events}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalScrollContent}
              snapToInterval={OFFER_CARD_WIDTH + 12}
              decelerationRate="fast"
              renderItem={({ item }) => <OfferCard offer={item} onPress={() => handleOfferPress(item.id)} />}
            />
          </View>
        )}

        {/* Browse by Category */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Category</Text>
          </View>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <CategoryIcon key={cat.key} category={cat} onPress={() => handleCategoryPress(cat.key)} />
            ))}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  greetingBlock: { flex: 1 },
  greeting: { fontSize: 16, color: Colors.dark.textSecondary, fontWeight: "500" },
  name: { fontSize: 26, fontWeight: "700", color: Colors.dark.text, marginTop: 2 },
  avatarButton: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.dark.accent + "60" },
  avatarPlaceholder: { backgroundColor: Colors.dark.surfaceElevated },
  avatarGlow: { position: "absolute", top: -4, left: -4, right: -4, bottom: -4, borderRadius: 28, backgroundColor: Colors.dark.accent + "15", zIndex: -1 },
  quickStats: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.dark.cardBorder },
  statValue: { fontSize: 18, fontWeight: "700", color: Colors.dark.text, marginTop: 8 },
  statLabel: { fontSize: 11, color: Colors.dark.textSecondary, marginTop: 2, fontWeight: "500" },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: Colors.dark.text },
  seeAllButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  seeAllText: { fontSize: 14, fontWeight: "600", color: Colors.dark.accent },
  horizontalScrollContent: { paddingLeft: 20, paddingRight: 8, gap: 12 },
  offerCard: { backgroundColor: Colors.dark.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.dark.cardBorder },
  offerImageContainer: { position: "relative", height: 140 },
  offerImage: { width: "100%", height: "100%" },
  offerImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  statusBadge: { position: "absolute", top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  categoryBadge: { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.65)" },
  categoryBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.dark.text },
  offerCardContent: { padding: 14, gap: 8 },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  venueLogo: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.dark.surfaceElevated },
  venueInfo: { flex: 1 },
  venueNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  venueName: { fontSize: 14, fontWeight: "600", color: Colors.dark.textSecondary },
  offerTitle: { fontSize: 15, fontWeight: "600", color: Colors.dark.text, marginTop: 1 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13, color: Colors.dark.textSecondary, flex: 1 },
  offerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  offerValue: { fontSize: 16, fontWeight: "700", color: Colors.dark.accent },
  slotsText: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: "500" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 4 },
  categoryItem: { alignItems: "center", paddingVertical: 10, gap: 8 },
  categoryIconContainer: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  categoryDot: { width: 22, height: 22, borderRadius: 8 },
  categoryLabel: { fontSize: 11, fontWeight: "600", color: Colors.dark.textSecondary, textAlign: "center", lineHeight: 14 },
});
