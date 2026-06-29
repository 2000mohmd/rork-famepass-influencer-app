import { useRouter } from "expo-router";
import {
  ArrowRight,
  Calendar,
  Clock,
  Heart,
  MapPin,
  Star,
  TrendingUp,
} from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
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

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useBookmarkStore } from "@/store/bookmarkStore";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";
import { resolveStorageUrl } from "@/lib/storage";
import { mapOfferFromAPI } from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OFFER_CARD_WIDTH = SCREEN_WIDTH * 0.68;
const CATEGORY_ITEM_SIZE = (SCREEN_WIDTH - 64) / 4;

interface Offer {
  id: string;
  title: string;
  description: string;
  category: string;
  mediaUrl: string;
  mediaType: string;
  venueId: string;
  venueName: string;
  venueLogoUrl: string;
  venueVerified: boolean;
  minFollowers: number;
  minEngagementRate: number;
  platforms: string[];
  offerValue: string;
  isFree: boolean;
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

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  coverUrl: string | null;
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function mapOfferHome(item: any): Offer {
  const mapped = mapOfferFromAPI(item);
  return {
    ...mapped,
    category: mapped.category ?? "",
    venueLogoUrl: item.venues?.logo_url ?? "",
  } as Offer;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { colors } = useTheme();

  // Use the /home endpoint which returns profile, categories, featured_offers, offers_by_category
  const { data: homeData, isLoading: homeLoading } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/home") as any;
      return data;
    },
    enabled: !!session,
  });

  // Extract offers from /home (featured_offers)
  const offers = useMemo<Offer[]>(() => {
    const raw = homeData?.featured_offers ?? homeData?.offers ?? [];
    return (Array.isArray(raw) ? raw : []).map(mapOfferHome);
  }, [homeData]);

  // Derive events from offers
  const events = useMemo(() => offers.filter((o: Offer) => o.type === "event").slice(0, 5), [offers]);

  // Extract categories from /home, with covers derived from offers_by_category
  const categories = useMemo<CategoryItem[]>(() => {
    const cats = homeData?.categories ?? [];
    const byCat = (homeData?.offers_by_category ?? {}) as Record<string, any[]>;
    return (Array.isArray(cats) ? cats : []).map((c: any) => {
      const catOffers = byCat[c.id] ?? [];
      const firstOfferCover = catOffers[0]?.cover_image_url || catOffers[0]?.image_url || catOffers[0]?.media_url;
      return {
        id: c.id,
        name: c.name ?? "",
        color: c.color ?? colors.accent,
        icon: c.icon ?? null,
        coverUrl: firstOfferCover ? resolveStorageUrl(firstOfferCover, "offers") : null,
      };
    });
  }, [homeData, colors.accent]);

  // Offers grouped by category name for sectioned display
  const offersByCategory = useMemo(() => {
    const grouped: Record<string, Offer[]> = {};
    // Use offers_by_category from /home response if available
    if (homeData?.offers_by_category) {
      const catMap = new Map<string, string>(); // category_id -> category name
      (categories ?? []).forEach((c) => catMap.set(c.id, c.name));
      Object.entries(homeData.offers_by_category as Record<string, any[]>).forEach(([catId, catOffers]) => {
        const catName = catMap.get(catId) ?? "Other";
        if (!grouped[catName]) grouped[catName] = [];
        (catOffers ?? []).forEach((o: any) => grouped[catName].push(mapOfferHome(o)));
      });
    } else {
      // Fallback: group by category field on each offer
      offers.forEach((offer: Offer) => {
        const cat = offer.category || "Other";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(offer);
      });
    }
    return grouped;
  }, [homeData, offers, categories]);

  const handleOfferPress = useCallback((offerId: string) => {
    router.push(`/offer/${offerId}`);
  }, [router]);

  const handleCategoryPress = useCallback((categoryId: string) => {
    router.push({ pathname: "/(tabs)/explore", params: { category: categoryId } });
  }, [router]);

  const followersFormatted = profile?.followers_count
    ? (profile.followers_count >= 1000000
      ? `${(profile.followers_count / 1000000).toFixed(1)}M`
      : profile.followers_count >= 1000
        ? `${(profile.followers_count / 1000).toFixed(0)}K`
        : String(profile.followers_count))
    : "—";

  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <TrendingUp size={16} color={colors.green} />
            <Text style={styles.statValue}>{profile?.engagement_rate ? `${profile.engagement_rate}%` : "—"}</Text>
            <Text style={styles.statLabel}>Engagement</Text>
          </View>
          <View style={styles.statCard}>
            <Star size={16} color={colors.accent} />
            <Text style={styles.statValue}>{followersFormatted}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar size={16} color={colors.accentLight} />
            <Pressable onPress={() => router.push("/(tabs)/attendance")}>
              <Text style={[styles.statLabel, { color: colors.accentLight, marginTop: 6 }]}>My Bookings</Text>
            </Pressable>
          </View>
        </View>

        {/* Featured Offers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Offers</Text>
            <Pressable style={styles.seeAllButton} onPress={() => router.push("/(tabs)/explore")}>
              <Text style={styles.seeAllText}>See all</Text>
              <ArrowRight size={14} color={colors.accent} />
            </Pressable>
          </View>
          {homeLoading && offers.length === 0 ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 20 }} />
          ) : (
            <FlatList
              data={offers}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalScrollContent}
              snapToInterval={OFFER_CARD_WIDTH + 12}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <OfferCard offer={item} colors={colors} onPress={() => handleOfferPress(item.id)} />
              )}
            />
          )}
        </View>

        {/* Upcoming Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <Pressable style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See all</Text>
                <ArrowRight size={14} color={colors.accent} />
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
              renderItem={({ item }) => (
                <OfferCard offer={item} colors={colors} onPress={() => handleOfferPress(item.id)} />
              )}
            />
          </View>
        )}

        {/* Browse by Category */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Category</Text>
          </View>
          <View style={styles.categoryGrid}>
            {(categories ?? []).map((cat) => (
              <CategoryItemView key={cat.id} category={cat} colors={colors} onPress={() => handleCategoryPress(cat.id)} />
            ))}
          </View>
        </View>

        {/* Offers by Category */}
        {Object.entries(offersByCategory).slice(0, 3).map(([categoryName, catOffers]) => (
          <View key={categoryName} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{categoryName}</Text>
              <Pressable style={styles.seeAllButton} onPress={() => router.push({ pathname: "/(tabs)/explore", params: { category: categoryName } })}>
                <Text style={styles.seeAllText}>See all</Text>
                <ArrowRight size={14} color={colors.accent} />
              </Pressable>
            </View>
            {(catOffers as Offer[]).slice(0, 2).map((offer: Offer) => (
              <View key={offer.id} style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <OfferCard offer={offer} colors={colors} onPress={() => handleOfferPress(offer.id)} />
              </View>
            ))}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function OfferCard({ offer, colors, onPress }: { offer: Offer; colors: ThemeColors; onPress: () => void }) {
  const currency = useCurrency();
  const bookmarkStore = useBookmarkStore();
  const isSaved = bookmarkStore.isSaved(offer.id);
  const statusColor =
    offer.status === "open" ? colors.statusOpen
    : offer.status === "full" ? colors.statusFull
    : colors.statusExpired;
  const statusLabel =
    offer.status === "open" ? "Open"
    : offer.status === "full" ? "Full"
    : "Expired";

  const displayValue = offer.isFree
    ? "Free"
    : `${currency} ${parseFloat(offer.offerValue.replace(/^[^0-9]*/, ""))?.toLocaleString() || offer.offerValue}`;

  const cardStyles = useMemo(() => createOfferCardStyles(colors), [colors]);

  return (
    <Pressable style={[cardStyles.offerCard, { width: OFFER_CARD_WIDTH }]} onPress={onPress}>
      <View style={cardStyles.offerImageContainer}>
        <Image source={{ uri: offer.mediaUrl }} style={cardStyles.offerImage} resizeMode="cover" />
        <View style={cardStyles.offerImageOverlay} />
        <Pressable
          style={cardStyles.heartButton}
          onPress={(e) => { e.stopPropagation(); bookmarkStore.toggle(offer.id); }}
          hitSlop={8}
        >
          <Heart size={18} color={isSaved ? colors.red : "#FFF"} fill={isSaved ? colors.red : "transparent"} />
        </Pressable>
        <View style={[cardStyles.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor }]}>
          <Text style={[cardStyles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <View style={cardStyles.categoryBadge}>
          <Text style={cardStyles.categoryBadgeText}>{offer.category}</Text>
        </View>
      </View>
      <View style={cardStyles.offerCardContent}>
        <View style={cardStyles.venueRow}>
          {offer.venueLogoUrl ? (
            <Image source={{ uri: resolveStorageUrl(offer.venueLogoUrl) ?? offer.venueLogoUrl }} style={cardStyles.venueLogo} />
          ) : (
            <View style={[cardStyles.venueLogo, { backgroundColor: colors.surfaceElevated }]} />
          )}
          <View style={cardStyles.venueInfo}>
            <View style={cardStyles.venueNameRow}>
              <Text style={cardStyles.venueName} numberOfLines={1}>{offer.venueName}</Text>
              {offer.venueVerified && <Star size={12} color={colors.accent} fill={colors.accent} />}
            </View>
            <Text style={cardStyles.offerTitle} numberOfLines={1}>{offer.title}</Text>
          </View>
        </View>
        {offer.type === "event" && offer.eventDate && (
          <View style={cardStyles.detailRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={cardStyles.detailText}>{offer.eventDate} at {offer.eventTime ?? "TBD"}</Text>
          </View>
        )}
        <View style={cardStyles.detailRow}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text style={cardStyles.detailText} numberOfLines={1}>{offer.location.city}</Text>
        </View>
        <View style={cardStyles.offerFooter}>
          <Text style={cardStyles.offerValue}>{displayValue}</Text>
          <Text style={cardStyles.slotsText}>{offer.slotsRemaining} / {offer.slotsTotal} slots</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CategoryItemView({ category, colors, onPress }: { category: CategoryItem; colors: ThemeColors; onPress: () => void }) {
  return (
    <Pressable style={[localStyles.categoryItem, { width: CATEGORY_ITEM_SIZE }]} onPress={onPress}>
      <View style={[localStyles.categoryIconContainer, { backgroundColor: category.color + "18", borderColor: category.color + "30" }]}>
        {category.coverUrl ? (
          <Image source={{ uri: category.coverUrl }} style={localStyles.categoryCover} resizeMode="cover" />
        ) : (
          <View style={[localStyles.categoryDot, { backgroundColor: category.color }]} />
        )}
      </View>
      <Text style={[localStyles.categoryLabel, { color: colors.textSecondary }]} numberOfLines={2}>{category.name}</Text>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  categoryItem: { alignItems: "center", paddingVertical: 10, gap: 8 },
  categoryIconContainer: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  categoryCover: { width: "100%", height: "100%", borderRadius: 16 },
  categoryDot: { width: 22, height: 22, borderRadius: 8 },
  categoryLabel: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 14 },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
    greetingBlock: { flex: 1 },
    greeting: { fontSize: 16, color: colors.textSecondary, fontWeight: "500" },
    name: { fontSize: 26, fontWeight: "700", color: colors.text, marginTop: 2 },
    avatarButton: { position: "relative" },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accent + "60" },
    avatarPlaceholder: { backgroundColor: colors.surfaceElevated },
    avatarGlow: { position: "absolute", top: -4, left: -4, right: -4, bottom: -4, borderRadius: 28, backgroundColor: colors.accent + "15", zIndex: -1 },
    quickStats: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 28 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder },
    statValue: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: "500" },
    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
    sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    seeAllButton: { flexDirection: "row", alignItems: "center", gap: 4 },
    seeAllText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    horizontalScrollContent: { paddingLeft: 20, paddingRight: 8, gap: 12 },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 4 },
  });
}

function createOfferCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    offerCard: { backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.cardBorder },
    offerImageContainer: { position: "relative", height: 140 },
    offerImage: { width: "100%", height: "100%" },
    offerImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
    statusBadge: { position: "absolute", top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.6)" },
    statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    categoryBadge: { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.65)" },
    categoryBadgeText: { fontSize: 11, fontWeight: "600", color: colors.text },
    offerCardContent: { padding: 14, gap: 8 },
    venueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    venueLogo: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceElevated },
    venueInfo: { flex: 1 },
    venueNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    venueName: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    offerTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 1 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    detailText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
    offerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    heartButton: { position: "absolute", bottom: 10, left: 10, zIndex: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    offerValue: { fontSize: 16, fontWeight: "700", color: colors.accent },
    slotsText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  });
}
