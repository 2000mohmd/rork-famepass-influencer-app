import { useLocalSearchParams, useRouter } from "expo-router";
import {
  List,
  Map,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  type Category,
  type Offer,
} from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

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

function OfferGridCard({ offer, onPress }: { offer: Offer; onPress: () => void }) {
  const statusColor =
    offer.status === "open" ? Colors.dark.statusOpen
    : offer.status === "full" ? Colors.dark.statusFull
    : Colors.dark.statusExpired;
  const statusLabel =
    offer.status === "open" ? "OPEN"
    : offer.status === "full" ? "FULL"
    : "EXPIRED";
  return (
    <Pressable style={[styles.gridCard, { width: GRID_CARD_WIDTH }]} onPress={onPress}>
      <View style={styles.gridImageContainer}>
        <Image source={{ uri: offer.mediaUrl }} style={styles.gridImage} resizeMode="cover" />
        <View style={[styles.gridBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.gridBadgeText}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.gridCardContent}>
        <Text style={styles.gridCategory} numberOfLines={1}>{CATEGORY_NAMES[offer.category]}</Text>
        <Text style={styles.gridTitle} numberOfLines={2}>{offer.title}</Text>
        <View style={styles.gridFooter}>
          <Text style={styles.gridValue}>{offer.offerValue}</Text>
          <Text style={styles.gridSlots}>{offer.slotsRemaining} left</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    (params.category as Category) ?? null,
  );
  const [showFilters, setShowFilters] = useState(false);

  const { data: allOffers, isLoading } = useQuery({
    queryKey: ["explore-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("offers")
        .select("*, venues:venue_id(name, logo_url, verified, address, city)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data ?? []).map(mapOfferFromDB);
    },
  });

  const filteredOffers = useMemo(() => {
    let results = allOffers ?? [];
    if (selectedCategory) {
      results = results.filter((o: Offer) => o.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (o: Offer) =>
          o.title.toLowerCase().includes(q) ||
          o.venueName.toLowerCase().includes(q) ||
          o.location.city.toLowerCase().includes(q) ||
          o.location.address.toLowerCase().includes(q),
      );
    }
    return results;
  }, [allOffers, searchQuery, selectedCategory]);

  const handleOfferPress = useCallback((offerId: string) => {
    router.push(`/offer/${offerId}`);
  }, [router]);

  const toggleCategory = useCallback((cat: Category) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search offers, venues, cities..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <X size={16} color={Colors.dark.textMuted} />
            </Pressable>
          )}
        </View>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.viewToggleButton, viewMode === "map" && styles.viewToggleActive]} onPress={() => setViewMode("map")}>
            <Map size={18} color={viewMode === "map" ? Colors.dark.accent : Colors.dark.textMuted} />
          </Pressable>
          <Pressable style={[styles.viewToggleButton, viewMode === "list" && styles.viewToggleActive]} onPress={() => setViewMode("list")}>
            <List size={18} color={viewMode === "list" ? Colors.dark.accent : Colors.dark.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Category Chips */}
      <View style={styles.filtersRow}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.categoryChips}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.key;
            const color = CATEGORY_COLORS[item.key];
            return (
              <Pressable
                style={[styles.chip, isActive && { backgroundColor: color + "25", borderColor: color }]}
                onPress={() => toggleCategory(item.key)}
              >
                <Text style={[styles.chipText, isActive && { color }]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Map placeholder */}
      {viewMode === "map" ? (
        <View style={styles.mapPlaceholder}>
          <MapPin size={48} color={Colors.dark.accent} />
          <Text style={styles.mapPlaceholderTitle}>Map View</Text>
          <Text style={styles.mapPlaceholderText}>
            Explore offers near you on an interactive map.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredOffers}
          key={viewMode + "-" + selectedCategory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Search size={48} color={Colors.dark.textMuted} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try adjusting your search or filters.</Text>
            </View>
          }
          renderItem={({ item }) => <OfferGridCard offer={item} onPress={() => handleOfferPress(item.id)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 10, alignItems: "center" },
  searchInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.dark.inputBackground, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: Colors.dark.inputBorder, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.dark.text },
  viewToggle: { flexDirection: "row", backgroundColor: Colors.dark.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  viewToggleButton: { padding: 7, borderRadius: 10 },
  viewToggleActive: { backgroundColor: Colors.dark.accent + "18" },
  filtersRow: { paddingLeft: 16, paddingVertical: 8 },
  categoryChips: { paddingRight: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.dark.textSecondary },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  mapPlaceholderTitle: { fontSize: 18, fontWeight: "700", color: Colors.dark.textSecondary },
  mapPlaceholderText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  gridCard: { backgroundColor: Colors.dark.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.dark.cardBorder },
  gridImageContainer: { position: "relative", height: 120 },
  gridImage: { width: "100%", height: "100%" },
  gridBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gridBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
  gridCardContent: { padding: 10, gap: 4 },
  gridCategory: { fontSize: 11, fontWeight: "600", color: Colors.dark.textMuted, textTransform: "uppercase" },
  gridTitle: { fontSize: 13, fontWeight: "600", color: Colors.dark.text, lineHeight: 17 },
  gridFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  gridValue: { fontSize: 14, fontWeight: "700", color: Colors.dark.accent },
  gridSlots: { fontSize: 11, color: Colors.dark.textMuted },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.dark.textSecondary },
  emptyText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: "center" },
});
