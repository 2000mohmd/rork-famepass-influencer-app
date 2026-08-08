import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Heart,
  List,
  Map,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
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
import * as Location from "expo-location";

import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { useBookmarkStore } from "@/store/bookmarkStore";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { apiRequestWithRefresh } from "@/lib/api";
import { resolveStorageUrl } from "@/lib/storage";
import { mapOfferFromAPI } from "@/constants/offerMapper";

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
  distanceKm?: number | null;
  offerType: string;
  createdAt: string;
  venueCountry?: string;
  categoryId: string | null;
  categoryName: string;
}

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface VenuePin {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  lat: number;
  lon: number;
}

/** Mirrors the web Explore filters (InfluencerExplore.tsx). */
type TypeFilter = "all" | "free" | "paid" | "event";
type SortBy = "newest" | "oldest" | "title_asc" | "title_desc" | "slots_desc";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "free", label: "Barter" },
  { key: "paid", label: "Paid" },
  { key: "event", label: "Event" },
];

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "title_asc", label: "Title A–Z" },
  { key: "title_desc", label: "Title Z–A" },
  { key: "slots_desc", label: "Most slots" },
];

/** Same radius the web app uses for its "nearby only" filter. */
const NEAR_ME_RADIUS_KM = 100;

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
    venueLat: mapped.location.lat,
    venueLon: mapped.location.lon,
    offerValue: mapped.offerValue,
    slotsRemaining: mapped.slotsRemaining,
    slotsTotal: mapped.slotsTotal,
    status: mapped.status,
    location: mapped.location,
    // /offers?lat&lng returns distance_km on each offer when location is sent
    distanceKm: typeof item.distance_km === "number" ? item.distance_km : null,
    offerType: item.offer_type ?? "",
    createdAt: item.created_at ?? "",
    venueCountry: item.venues?.country ?? undefined,
    categoryId: item.category_id ?? null,
    categoryName: item.categories?.name ?? item.venues?.category ?? "",
  };
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const { colors } = useTheme();
  const { session } = useAuth();
  const currency = useCurrency();
  const bookmarkStore = useBookmarkStore();

  const [searchQuery, setSearchQuery] = useState(params.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(params.search ?? "");
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category ?? null,
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "on" | "denied">("idle");
  const [nearMeActive, setNearMeActive] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [myCountryOnly, setMyCountryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // True when the near-me query came back empty and we fell back to all offers,
  // so the UI can say so instead of silently showing unfiltered results.
  const [nearMeEmpty, setNearMeEmpty] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocationStatus("on");
    } catch {
      setLocationStatus("denied");
    }
  }, []);

  // The Explore tab stays mounted, so useState(params.*) only runs once. When the
  // user taps "See all" / a category from Home again, sync the new params into state.
  useEffect(() => {
    if (params.category !== undefined) setSelectedCategory(params.category || null);
  }, [params.category]);
  useEffect(() => {
    if (params.search !== undefined) {
      setSearchQuery(params.search || "");
      setDebouncedSearch(params.search || "");
    }
  }, [params.search]);

  // Ask for location once on mount so we can rank & map offers "near me".
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

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

  const { data: categories } = useQuery<CategoryItem[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/categories") as any;
      const cats = Array.isArray(data) ? data : (data?.categories ?? []);
      return (cats as any[]).map((c: any) => ({
        id: c.id,
        name: c.name ?? "",
        color: c.color ?? "#B8923A",
        icon: c.icon ?? null,
      }));
    },
  });

  // Resolve the selected category to its name for API filtering. `selectedCategory`
  // may be a category ID (from the chips / category grid) or a name (from Home's
  // "offers by category" See-all), so match on both.
  // `selectedCategory` may be an ID (chips / category grid) or a name (Home's
  // "See all"), so resolve both forms before matching offers against it.
  const selectedCategoryMatch = useMemo(() => {
    if (!selectedCategory) return { id: null as string | null, name: null as string | null };
    const match = (categories ?? []).find(
      (c: CategoryItem) => c.id === selectedCategory || c.name === selectedCategory,
    );
    return { id: match?.id ?? selectedCategory, name: match?.name ?? selectedCategory };
  }, [selectedCategory, categories]);
  const selectedCategoryName = selectedCategoryMatch.name;
  const selectedCategoryId = selectedCategoryMatch.id;

  // The creator's own country, used by the "My country" filter (web parity).
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-country"],
    enabled: !!session,
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/profile") as any;
      return data?.profile ?? data ?? null;
    },
  });
  const myCountry: string | undefined = myProfile?.country ?? undefined;

  // Approved venues with coordinates — the map plots these, like the web app.
  const { data: venuePins } = useQuery<VenuePin[]>({
    queryKey: ["explore-venues"],
    enabled: !!session,
    queryFn: async () => {
      const data = await apiRequestWithRefresh("/venues") as { venues?: any[] };
      return (data.venues ?? [])
        .filter((v: any) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
        .map((v: any) => ({
          id: v.id,
          name: v.name ?? "Venue",
          city: v.city ?? "",
          logoUrl: resolveStorageUrl(v.logo_url, "venues"),
          lat: v.latitude,
          lon: v.longitude,
        }));
    },
  });

  const { data: allOffers, isLoading } = useQuery({
    queryKey: ["explore-offers", debouncedSearch, userLocation?.lat, userLocation?.lng, nearMeActive],
    enabled: !!session,
    queryFn: async () => {
      // NOTE: we deliberately do NOT send `category` to /offers. That param filters
      // an embedded venues table without an inner join, which PostgREST ignores for
      // parent rows — every category returned the full list. We filter by
      // category_id locally instead, the same way the web Home screen does.
      const baseParams = new URLSearchParams();
      if (debouncedSearch) baseParams.set("search", debouncedSearch);

      // "Near me": the backend filters by distance and drops offers whose venue
      // has no coordinates, so it can legitimately return zero. We still fall back
      // to the unlocated list (an empty screen is worse), but we flag it so the UI
      // can tell the user the filter found nothing rather than pretending it applied.
      if (nearMeActive && userLocation) {
        const nearParams = new URLSearchParams(baseParams);
        nearParams.set("lat", String(userLocation.lat));
        nearParams.set("lng", String(userLocation.lng));
        nearParams.set("radius_km", String(NEAR_ME_RADIUS_KM));
        const near = await apiRequestWithRefresh(`/offers?${nearParams}`) as { offers?: any[] };
        if ((near.offers ?? []).length > 0) {
          setNearMeEmpty(false);
          return (near.offers ?? []).map(mapOfferExplore);
        }
        setNearMeEmpty(true);
      } else {
        setNearMeEmpty(false);
      }

      const data = await apiRequestWithRefresh(`/offers?${baseParams}`) as { offers?: any[] };
      return (data.offers ?? []).map(mapOfferExplore);
    },
  });

  // Search and category are applied server-side. Type, country and sort are
  // applied here — the influencer-api has no params for them yet.
  const filteredOffers = useMemo(() => {
    let list = [...(allOffers ?? [])];

    // Match on category_id first (the reliable link), then fall back to comparing
    // names — offers can carry a category via `categories` or `venues.category`.
    if (selectedCategory) {
      const wantedName = (selectedCategoryName ?? "").trim().toLowerCase();
      list = list.filter((o) => {
        if (o.categoryId && o.categoryId === selectedCategoryId) return true;
        return !!wantedName && o.categoryName.trim().toLowerCase() === wantedName;
      });
    }

    if (typeFilter !== "all") {
      list = list.filter((o) => o.offerType === typeFilter);
    }
    if (myCountryOnly && myCountry) {
      const target = myCountry.trim().toLowerCase();
      list = list.filter((o) => (o.venueCountry ?? "").trim().toLowerCase() === target);
    }

    switch (sortBy) {
      case "oldest":
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "title_asc":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        list.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "slots_desc":
        list.sort((a, b) => b.slotsRemaining - a.slotsRemaining);
        break;
      default:
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [allOffers, selectedCategory, selectedCategoryId, selectedCategoryName, typeFilter, myCountryOnly, myCountry, sortBy]);

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0) +
    (myCountryOnly ? 1 : 0);

  const handleOfferPress = useCallback((offerId: string) => {
    router.push(`/offer/${offerId}`);
  }, [router]);

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategory((prev) => (prev === catId ? null : catId));
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Explore</Text>
          <Text style={styles.subtitle}>
            {locationStatus === "on" ? "Offers near you" : "Discover offers & venues"}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.viewToggleButton, viewMode === "list" && styles.viewToggleActive]} onPress={() => setViewMode("list")}>
            <List size={17} color={viewMode === "list" ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable style={[styles.viewToggleButton, viewMode === "map" && styles.viewToggleActive]} onPress={() => setViewMode("map")}>
            <Map size={17} color={viewMode === "map" ? colors.accent : colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search offers, venues, cities…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); setDebouncedSearch(""); }} hitSlop={8}>
              <X size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Near-me toggle */}
      <View style={styles.nearMeRow}>
        {locationStatus === "on" ? (
          <Pressable
            style={[styles.nearMePill, !nearMeActive && styles.nearMePillOff]}
            onPress={() => setNearMeActive((v) => !v)}
          >
            <Navigation
              size={12}
              color={nearMeActive ? colors.accent : colors.textMuted}
              fill={nearMeActive ? colors.accent : "transparent"}
            />
            <Text style={[styles.nearMeText, !nearMeActive && styles.nearMeTextMuted]}>
              {nearMeActive ? `Near me · ${NEAR_ME_RADIUS_KM} km` : "Near me · off"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.nearMePill, styles.nearMePillMuted]}
            onPress={requestLocation}
          >
            <MapPin size={12} color={colors.textMuted} />
            <Text style={styles.nearMeTextMuted}>
              {locationStatus === "denied" ? "Enable location for offers near you" : "Getting your location…"}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={12} color={activeFilterCount > 0 ? colors.accent : colors.textMuted} />
          <Text style={[styles.nearMeTextMuted, activeFilterCount > 0 && { color: colors.accent, fontWeight: "700" }]}>
            {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"}
          </Text>
        </Pressable>
      </View>

      {/* Near-me returned nothing — say so instead of silently showing everything */}
      {nearMeActive && nearMeEmpty && locationStatus === "on" && (
        <View style={styles.noticeRow}>
          <Text style={styles.noticeText}>
            No offers within {NEAR_ME_RADIUS_KM} km — showing all offers instead.
          </Text>
        </View>
      )}

      {/* Filters: type, sort, country (web parity) */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.filterChipRow}>
            {TYPE_FILTERS.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.filterChip, typeFilter === t.key && styles.filterChipActive]}
                onPress={() => setTypeFilter(t.key)}
              >
                <Text style={[styles.filterChipText, typeFilter === t.key && { color: colors.background }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>Sort by</Text>
          <View style={styles.filterChipRow}>
            {SORT_OPTIONS.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.filterChip, sortBy === s.key && styles.filterChipActive]}
                onPress={() => setSortBy(s.key)}
              >
                <Text style={[styles.filterChipText, sortBy === s.key && { color: colors.background }]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {!!myCountry && (
            <Pressable
              style={[styles.filterChip, styles.countryChip, myCountryOnly && styles.filterChipActive]}
              onPress={() => setMyCountryOnly((v) => !v)}
            >
              <Text style={[styles.filterChipText, myCountryOnly && { color: colors.background }]}>
                Only {myCountry}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Category Chips */}
      <View style={styles.filtersRow}>
        <FlatList
          data={categories ?? []}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryChips}
          ListHeaderComponent={
            <Pressable
              style={[styles.chip, !selectedCategory && styles.chipActiveAll]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.chipText, !selectedCategory && { color: colors.background }]}>All</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.id || selectedCategory === item.name;
            return (
              <Pressable
                style={[styles.chip, isActive && { backgroundColor: item.color, borderColor: item.color }]}
                onPress={() => toggleCategory(item.id)}
              >
                <Text style={[styles.chipText, isActive && { color: "#FFFFFF" }]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Map View */}
      {viewMode === "map" ? (
        <MapExploreView offers={filteredOffers} venues={venuePins ?? []} colors={colors} onOfferPress={handleOfferPress} userLocation={userLocation} />
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
  const currency = useCurrency();
  const isSaved = bookmarkStore.isSaved(offer.id);

  // "Free" (or any non-numeric value) shows as-is; numeric values get the currency prefix.
  const numeric = parseFloat(String(offer.offerValue).replace(/[^0-9.]/g, ""));
  const valueDisplay = isNaN(numeric)
    ? (offer.offerValue || "Free")
    : `${currency} ${numeric.toLocaleString()}`;
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
        {typeof offer.distanceKm === "number" && (
          <View style={gridStyles.distanceBadge}>
            <MapPin size={10} color="#FFF" />
            <Text style={gridStyles.distanceBadgeText}>{offer.distanceKm} km</Text>
          </View>
        )}
      </View>
      <View style={gridStyles.gridCardContent}>
        <Text style={gridStyles.gridCategory} numberOfLines={1}>{offer.category}</Text>
        <Text style={gridStyles.gridTitle} numberOfLines={2}>{offer.title}</Text>
        <View style={gridStyles.gridFooter}>
          <Text style={gridStyles.gridValue}>{valueDisplay}</Text>
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
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
    title: { fontFamily: "serif", fontSize: 28, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    searchContainer: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 10, alignItems: "center" },
    searchInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.inputBorder, gap: 10 },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },
    viewToggle: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.cardBorder },
    viewToggleButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    viewToggleActive: { backgroundColor: colors.accent + "1E" },
    nearMeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 4 },
    filterButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    filterButtonActive: { backgroundColor: colors.accent + "14", borderColor: colors.accent + "30" },
    noticeRow: { paddingHorizontal: 20, paddingBottom: 4 },
    noticeText: { fontSize: 12, color: colors.textMuted },
    filterPanel: { paddingHorizontal: 20, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surfaceElevated },
    filterLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" },
    filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    countryChip: { alignSelf: "flex-start" },
    nearMePill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent + "14", borderWidth: 1, borderColor: colors.accent + "30" },
    nearMePillOff: { backgroundColor: colors.card, borderColor: colors.cardBorder },
    nearMePillMuted: { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder },
    nearMeText: { fontSize: 12, fontWeight: "700", color: colors.accent },
    nearMeTextMuted: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    filtersRow: { paddingLeft: 20, paddingVertical: 8 },
    categoryChips: { paddingRight: 20, gap: 8 },
    chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    chipActiveAll: { backgroundColor: colors.accent, borderColor: colors.accent },
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

function MapExploreView({ offers, venues, colors, onOfferPress, userLocation }: { offers: Offer[]; venues: VenuePin[]; colors: ThemeColors; onOfferPress: (id: string) => void; userLocation: { lat: number; lng: number } | null }) {
  // Use a finite-number check: `0` is a valid coordinate, and a truthy test
  // silently dropped every venue whose lat/lon was missing OR zero.
  const pinsWithCoords = offers.filter(
    (o) => Number.isFinite(o.venueLat) && Number.isFinite(o.venueLon),
  );

  // Nothing at all to draw and nowhere to centre — the map would be blank.
  if (pinsWithCoords.length === 0 && venues.length === 0 && !userLocation) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 }}>
        <MapPin size={48} color={colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textSecondary }}>No offers with locations yet</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>Turn on location or wait for venues to add their coordinates.</Text>
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

  // Venues the offers already cover are drawn as offer pins; show the rest too,
  // so the map still has content when offers lack coordinates (web parity).
  const offerVenueNames = new Set(pinsWithCoords.map((o) => o.venueName));
  const extraVenues = venues.filter((v) => !offerVenueNames.has(v.name));
  const venuesJson = JSON.stringify(extraVenues.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    lat: v.lat,
    lon: v.lon,
  })));

  const isDark = colors.background === "#0F0F0F";
  const accentHex = colors.accent;

  // Centre on the user, else the first offer pin, else the first venue.
  const center = userLocation
    ? { lat: userLocation.lat, lon: userLocation.lng }
    : pinsWithCoords.length > 0
      ? { lat: pinsWithCoords[0].venueLat as number, lon: pinsWithCoords[0].venueLon as number }
      : { lat: extraVenues[0].lat, lon: extraVenues[0].lon };
  const userJson = userLocation ? JSON.stringify({ lat: userLocation.lat, lon: userLocation.lng }) : "null";

  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body{margin:0;padding:0}#map{width:100vw;height:100vh}.leaflet-popup-content{font-family:-apple-system,sans-serif;font-size:14px}</style>
</head><body><div id="map"></div>
<script>
const pins = ${pinsJson};
const venues = ${venuesJson};
const me = ${userJson};
const map = L.map('map').setView([${center.lat}, ${center.lon}], 12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
}).addTo(map);
const greenIcon = L.icon({iconUrl:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="14" r="10" fill="${accentHex}" stroke="white" stroke-width="2"/><polygon points="16,28 10,22 22,22" fill="${accentHex}"/></svg>',iconSize:[32,32],popupAnchor:[0,-16]});
if (me) {
  L.circleMarker([me.lat, me.lon], {radius:9, color:'#FFFFFF', weight:3, fillColor:'#2E7DF5', fillOpacity:1}).addTo(map).bindPopup('You are here');
}
pins.forEach(p=>{
  const marker=L.marker([p.lat,p.lon],{icon:greenIcon}).addTo(map);
  marker.bindPopup('<b>'+p.title+'</b><br/>'+p.venue+'<br/>'+p.value);
  marker.on('click',()=>{window.ReactNativeWebView?.postMessage(JSON.stringify({offerId:p.id}));});
});
// Venues without a matching offer pin — shown so the map isn't empty.
venues.forEach(v=>{
  L.circleMarker([v.lat,v.lon],{radius:7,color:'#FFFFFF',weight:2,fillColor:'${accentHex}',fillOpacity:0.85})
    .addTo(map).bindPopup('<b>'+v.name+'</b>'+(v.city?'<br/>'+v.city:''));
});
// Fit to everything we drew so pins are never off-screen.
const allPts = pins.map(p=>[p.lat,p.lon]).concat(venues.map(v=>[v.lat,v.lon]));
if (me) allPts.push([me.lat, me.lon]);
if (allPts.length > 1) { try { map.fitBounds(allPts, {padding:[40,40], maxZoom:14}); } catch(e){} }
</script></body></html>`;

  const nothingToPlot = pinsWithCoords.length === 0 && extraVenues.length === 0;

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
      {/* We have the user's location but no venue coordinates to draw, so the map
          would otherwise look broken rather than empty-by-data. */}
      {nothingToPlot && (
        <View style={{ position: "absolute", left: 16, right: 16, top: 16, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>No venue locations to show</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            These venues haven&apos;t added map coordinates yet.
          </Text>
        </View>
      )}
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
    distanceBadge: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)" },
    distanceBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
    gridCardContent: { padding: 10, gap: 4 },
    gridCategory: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
    gridTitle: { fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 17 },
    gridFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.cardBorder },
    gridValue: { fontSize: 14, fontWeight: "700", color: colors.accent },
    gridSlots: { fontSize: 11, color: colors.textMuted },
  });
}
