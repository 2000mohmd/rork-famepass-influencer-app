import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Heart,
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
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useBookmarkStore } from "@/store/bookmarkStore";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { apiRequestWithRefresh } from "@/lib/api";
import { mapOfferFromAPI } from "@/constants/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

interface Offer {
  id: string;
  title: string;
  category: string;
  mediaUrl: string;
  venueName: string;
  venueLogoUrl?: string;
  venueAddress?: string;
  venueLat?: number | null;
  venueLon?: number | null;
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

function mapOfferExplore(item: any): Offer {
  const mapped = mapOfferFromAPI(item);
  return {
    id: mapped.id,
    title: mapped.title,
    category: mapped.category ?? "",
    mediaUrl: mapped.mediaUrl,
    venueName: mapped.venueName,
    venueLogoUrl: mapped.venueLogoUrl,
    venueAddress: mapped.location.address,
    venueLat: mapped.location.lat || null,
    venueLon: mapped.location.lon || null,
    offerValue: mapped.offerValue,
    slotsRemaining: mapped.slotsRemaining,
    slotsTotal: mapped.slotsTotal,
    status: mapped.status,
    location: mapped.location,
  };
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();
  const currency = useCurrency();
  const bookmarkStore = useBookmarkStore();

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
    queryKey: ["explore-offers", debouncedSearch, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCategory) params.set("category", selectedCategory);
      const data = await apiRequestWithRefresh(`/offers?${params}`) as { offers?: any[] };
      return (data.offers ?? []).map(mapOfferExplore);
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

  // Server handles filtering now — just use allOffers directly
  const filteredOffers = allOffers ?? [];

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

      {/* Map View */}
      {viewMode === "map" ? (
        <MapExploreView offers={filteredOffers as any} colors={colors} onOfferPress={handleOfferPress} />
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
  const bookmarkStore = useBookmarkStore();
  const isSaved = bookmarkStore.isSaved(offer.id);
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
        <Pressable
          style={gridStyles.gridHeart}
          onPress={(e) => { e.stopPropagation(); bookmarkStore.toggle(offer.id); }}
          hitSlop={8}
        >
          <Heart size={14} color={isSaved ? colors.red : "#FFF"} fill={isSaved ? colors.red : "transparent"} />
        </Pressable>
        <View style={[gridStyles.gridBadge, { backgroundColor: statusColor }]}>
          <Text style={gridStyles.gridBadgeText}>{statusLabel}</Text>
        </View>
      </View>
      <View style={gridStyles.gridCardContent}>
        <Text style={gridStyles.gridCategory} numberOfLines={1}>{offer.category}</Text>
        <Text style={gridStyles.gridTitle} numberOfLines={2}>{offer.title}</Text>
        <View style={gridStyles.gridFooter}>
          <Text style={gridStyles.gridValue}>{parseFloat(offer.offerValue.replace(/^[^0-9]*/, ""))?.toLocaleString() || offer.offerValue}</Text>
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
    mapContainer: { flex: 1 },
    mapWebView: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
    gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  });
}

function MapExploreView({ offers, colors, onOfferPress }: { offers: Offer[]; colors: ThemeColors; onOfferPress: (id: string) => void }) {
  const pinsWithCoords = offers.filter((o: any) => o.venueLat && o.venueLon);
  
  if (pinsWithCoords.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 }}>
        <MapPin size={48} color={colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textSecondary }}>No offers with locations yet</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>Venues need to add their coordinates for the map view.</Text>
      </View>
    );
  }

  const pinsJson = JSON.stringify(pinsWithCoords.map((o: any) => ({
    id: o.id,
    title: o.title,
    venue: o.venueName,
    value: o.offerValue,
    lat: o.venueLat,
    lon: o.venueLon,
    status: o.status,
  })));

  const center = pinsWithCoords[0] as any;
  const isDark = colors.background === "#0F0F0F";
  const accentHex = colors.accent;
  const bgHex = isDark ? "#1A1A1A" : "#FFFFFF";
  const textHex = isDark ? "#FFFFFF" : "#1A1A1A";

  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body{margin:0;padding:0}#map{width:100vw;height:100vh}.leaflet-popup-content{font-family:-apple-system,sans-serif;font-size:14px}</style>
</head><body><div id="map"></div>
<script>
const pins = ${pinsJson};
const map = L.map('map').setView([${center.venueLat}, ${center.venueLon}], 12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
}).addTo(map);
const greenIcon = L.icon({iconUrl:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="14" r="10" fill="${accentHex}" stroke="white" stroke-width="2"/><polygon points="16,28 10,22 22,22" fill="${accentHex}"/></svg>',iconSize:[32,32],popupAnchor:[0,-16]});
pins.forEach(p=>{
  const marker=L.marker([p.lat,p.lon],{icon:greenIcon}).addTo(map);
  marker.bindPopup('<b>'+p.title+'</b><br/>'+p.venue+'<br/>'+p.value);
  marker.on('click',()=>{window.ReactNativeWebView?.postMessage(JSON.stringify({offerId:p.id}));});
});
</script></body></html>`;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.offerId) onOfferPress(msg.offerId);
          } catch {}
        }}
      />
    </View>
  );
}

function createGridStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gridCard: { backgroundColor: colors.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.cardBorder },
    gridImageContainer: { position: "relative", height: 120 },
    gridImage: { width: "100%", height: "100%" },
    gridHeart: { position: "absolute", top: 8, left: 8, zIndex: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
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
