import { useLocalSearchParams, useRouter } from "expo-router";
import {
  List,
  Map,
  MapPin,
  Search,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  food_drink: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
  nightlife: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=500&fit=crop",
  beauty: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=500&fit=crop",
  fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop",
  retail: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=500&fit=crop",
  travel: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=500&fit=crop",
  default: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
};

interface Offer {
  id: string;
  title: string;
  category: string;
  mediaUrl: string;
  venueName: string;
  offerValue: string;
  slotsRemaining: number;
  slotsTotal: number;
  status: "open" | "full" | "expired";
  location: { address: string; city: string };
}

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

function mapOfferFromDB(item: any): Offer {
  return {
    id: item.id,
    title: item.title ?? "",
    category: item.category ?? "food_drink",
    mediaUrl: item.media_url ||
      CATEGORY_FALLBACK_IMAGES[item.category] ||
      CATEGORY_FALLBACK_IMAGES.default,
    venueName: item.venues?.name ?? "Venue",
    offerValue: item.value_worth ?? "$0",
    slotsRemaining: (item.max_redemptions ?? 0) - (item.current_redemptions ?? 0),
    slotsTotal: item.max_redemptions ?? 0,
    status: item.is_active ? (((item.current_redemptions ?? 0) >= (item.max_redemptions ?? 999)) ? "full" : "open") : "expired",
    location: { address: item.venues?.address ?? "", city: item.venues?.city ?? "" },
  };
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category ?? null,
  );
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const { data: allOffers, isLoading } = useQuery({
    queryKey: ["explore-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("offers")
        .select(`
          id, title, category, media_url, value_worth,
          max_redemptions, current_redemptions, is_active,
          venues!inner(id, name, address, city)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data ?? []).map(mapOfferFromDB);
    },
  });

  const { data: categories } = useQuery<CategoryItem[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, color, icon")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as CategoryItem[];
    },
  });

  const filteredOffers = useMemo(() => {
    let results = allOffers ?? [];
    if (selectedCategory) {
      results = results.filter((o: Offer) => o.category === selectedCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      results = results.filter(
        (o: Offer) =>
          o.title.toLowerCase().includes(q) ||
          o.venueName.toLowerCase().includes(q) ||
          o.location.city.toLowerCase().includes(q) ||
          o.location.address.toLowerCase().includes(q),
      );
    }
    return results;
  }, [allOffers, debouncedSearch, selectedCategory]);

  const handleOfferPress = useCallback((offerId: string) => {
    router.push(`/offer/${offerId}`);
  }, [router]);

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategory((prev) => (prev === catId ? null : catId));
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search offers, venues, cities..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); setDebouncedSearch(""); }}>
              <X size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.viewToggleButton, viewMode === "map" && styles.viewToggleActive]} onPress={() => setViewMode("map")}>
            <Map size={18} color={viewMode === "map" ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable style={[styles.viewToggleButton, viewMode === "list" && styles.viewToggleActive]} onPress={() => setViewMode("list")}>
            <List size={18} color={viewMode === "list" ? colors.accent : colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Category Chips */}
      <View style={styles.filtersRow}>
        <FlatList
          data={categories ?? []}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryChips}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.id;
            return (
              <Pressable
                style={[styles.chip, isActive && { backgroundColor: item.color + "25", borderColor: item.color }]}
                onPress={() => toggleCategory(item.id)}
              >
                <Text style={[styles.chipText, isActive && { color: item.color }]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Map placeholder */}
      {viewMode === "map" ? (
        <View style={styles.mapPlaceholder}>
          <MapPin size={48} color={colors.accent} />
          <Text style={styles.mapPlaceholderTitle}>Map View</Text>
          <Text style={styles.mapPlaceholderText}>
            Explore offers near you on an interactive map.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
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
              <Search size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try adjusting your search or filters.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <OfferGridCard offer={item} colors={colors} onPress={() => handleOfferPress(item.id)} />
          )}
        />
      )}
    </View>
  );
}

function OfferGridCard({ offer, colors, onPress }: { offer: Offer; colors: ThemeColors; onPress: () => void }) {
  const statusColor =
    offer.status === "open" ? colors.statusOpen
    : offer.status === "full" ? colors.statusFull
    : colors.statusExpired;
  const statusLabel =
    offer.status === "open" ? "OPEN"
    : offer.status === "full" ? "FULL"
    : "EXPIRED";
  const gridStyles = useMemo(() => createGridStyles(colors), [colors]);

  return (
    <Pressable style={[gridStyles.gridCard, { width: GRID_CARD_WIDTH }]} onPress={onPress}>
      <View style={gridStyles.gridImageContainer}>
        <Image source={{ uri: offer.mediaUrl }} style={gridStyles.gridImage} resizeMode="cover" />
        <View style={[gridStyles.gridBadge, { backgroundColor: statusColor }]}>
          <Text style={gridStyles.gridBadgeText}>{statusLabel}</Text>
        </View>
      </View>
      <View style={gridStyles.gridCardContent}>
        <Text style={gridStyles.gridCategory} numberOfLines={1}>{offer.category}</Text>
        <Text style={gridStyles.gridTitle} numberOfLines={2}>{offer.title}</Text>
        <View style={gridStyles.gridFooter}>
          <Text style={gridStyles.gridValue}>{offer.offerValue}</Text>
          <Text style={gridStyles.gridSlots}>{offer.slotsRemaining} left</Text>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    searchContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 10, alignItems: "center" },
    searchInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: colors.inputBorder, gap: 10 },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },
    viewToggle: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.cardBorder },
    viewToggleButton: { padding: 7, borderRadius: 10 },
    viewToggleActive: { backgroundColor: colors.accent + "18" },
    filtersRow: { paddingLeft: 16, paddingVertical: 8 },
    categoryChips: { paddingRight: 16, gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
    mapPlaceholderTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
    mapPlaceholderText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
    listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
    gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  });
}

function createGridStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gridCard: { backgroundColor: colors.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.cardBorder },
    gridImageContainer: { position: "relative", height: 120 },
    gridImage: { width: "100%", height: "100%" },
    gridBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    gridBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
    gridCardContent: { padding: 10, gap: 4 },
    gridCategory: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
    gridTitle: { fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 17 },
    gridFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    gridValue: { fontSize: 14, fontWeight: "700", color: colors.accent },
    gridSlots: { fontSize: 11, color: colors.textMuted },
  });
}
