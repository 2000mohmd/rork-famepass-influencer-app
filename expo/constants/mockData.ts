export type Platform = "instagram" | "tiktok" | "youtube" | "snapchat";

export type Category =
  | "food_drink"
  | "nightlife"
  | "beauty"
  | "fitness"
  | "retail"
  | "entertainment"
  | "travel"
  | "tech";

export type Niche =
  | "food_dining"
  | "travel"
  | "fashion"
  | "beauty"
  | "fitness"
  | "lifestyle"
  | "tech"
  | "gaming"
  | "music"
  | "photography"
  | "family"
  | "business"
  | "sports"
  | "art"
  | "other";

export type PostType = "story" | "reel" | "feed_post";

export interface PostRequirements {
  postType: PostType;
  numberOfPosts: number;
  captionRequirements: string;
}

export interface ConnectedAccount {
  platform: Platform;
  username: string;
  followers: number;
  engagementRate: number;
  connected: boolean;
}

export type OfferStatus = "open" | "full" | "expired";
export type OfferType = "offer" | "event";
export type AttendanceStatus =
  | "confirmed"
  | "pending_approval"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled_by_venue"
  | "cancelled_by_influencer";

export interface OfferLocation {
  address: string;
  city: string;
  lat: number;
  lon: number;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  category: Category;
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
  isFree: boolean;
  slotsTotal: number;
  slotsRemaining: number;
  expiryDate: string;
  bookingWindow: string;
  location: OfferLocation;
  postRequirements: PostRequirements;
  status: OfferStatus;
  type: OfferType;
  eventDate?: string;
  eventTime?: string;
}

export interface AttendanceRecord {
  id: string;
  offerId: string;
  status: AttendanceStatus;
  date: string;
  checkInInfo?: string;
}

export interface Influencer {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  bio: string;
  connectedAccounts: ConnectedAccount[];
  totalFollowers: number;
  avgEngagementRate: number;
  totalOffersAttended: number;
  totalOffersCancelled: number;
  topPlatform: string;
  attendanceHistory: AttendanceRecord[];
}

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "food_drink", label: "Food & Drink", icon: "utensils-crossed" },
  { key: "nightlife", label: "Nightlife", icon: "music" },
  { key: "beauty", label: "Beauty", icon: "sparkles" },
  { key: "fitness", label: "Fitness", icon: "dumbbell" },
  { key: "retail", label: "Retail", icon: "shopping-bag" },
  { key: "entertainment", label: "Entertainment", icon: "ticket" },
  { key: "travel", label: "Travel", icon: "plane" },
  { key: "tech", label: "Tech", icon: "cpu" },
];

export const NICHES: { key: Niche; label: string }[] = [
  { key: "food_dining", label: "Food & Dining" },
  { key: "travel", label: "Travel" },
  { key: "fashion", label: "Fashion" },
  { key: "beauty", label: "Beauty" },
  { key: "fitness", label: "Fitness" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "tech", label: "Tech" },
  { key: "gaming", label: "Gaming" },
  { key: "music", label: "Music" },
  { key: "photography", label: "Photography" },
  { key: "family", label: "Family" },
  { key: "business", label: "Business" },
  { key: "sports", label: "Sports" },
  { key: "art", label: "Art" },
  { key: "other", label: "Other" },
];

export const CATEGORY_COLORS: Record<Category, string> = {
  food_drink: "#F59E0B",
  nightlife: "#B8923A",
  beauty: "#EC4899",
  fitness: "#34D399",
  retail: "#E7C883",
  entertainment: "#F97316",
  travel: "#06B6D4",
  tech: "#8B5CF6",
};

export const CATEGORY_NAMES: Record<Category, string> = {
  food_drink: "Food & Drink",
  nightlife: "Nightlife",
  beauty: "Beauty",
  fitness: "Fitness",
  retail: "Retail",
  entertainment: "Entertainment",
  travel: "Travel",
  tech: "Tech",
};

export const PLATFORM_ICONS: Record<Platform, string> = {
  instagram: "instagram",
  tiktok: "music-2",
  youtube: "youtube",
  snapchat: "ghost",
};

export const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

export function getOfferStatusColor(status: OfferStatus): string {
  switch (status) {
    case "open":
      return "#34D399";
    case "full":
      return "#F59E0B";
    case "expired":
      return "#EF4444";
  }
}

export function getOfferStatusLabel(status: OfferStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "full":
      return "Full";
    case "expired":
      return "Expired";
  }
}

export function checkEligibility(
  offer: Offer,
  influencer: Influencer,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (influencer.totalFollowers < offer.minFollowers) {
    reasons.push(
      `Requires ${offer.minFollowers.toLocaleString()}+ followers (you have ${influencer.totalFollowers.toLocaleString()})`,
    );
  }

  if (influencer.avgEngagementRate < offer.minEngagementRate) {
    reasons.push(
      `Requires ${offer.minEngagementRate}%+ engagement rate (you have ${influencer.avgEngagementRate}%)`,
    );
  }

  const connectedPlatforms = influencer.connectedAccounts
    .filter((a) => a.connected)
    .map((a) => a.platform);
  const missingPlatforms = offer.platforms.filter(
    (p) => !connectedPlatforms.includes(p),
  );
  if (missingPlatforms.length > 0) {
    reasons.push(
      `Requires: ${missingPlatforms.map((p) => PLATFORM_NAMES[p]).join(", ")}`,
    );
  }

  return { eligible: reasons.length === 0, reasons };
}

import { resolveStorageUrl } from "@/lib/storage";

/** Maps the influencer-api edge function response shape to the Offer interface. */
export function mapOfferFromAPI(item: any): Offer {
  // Determine if the offer is free (complimentary) or paid (discount)
  const isFree =
    item.is_free === true ||
    item.offer_type === "free" ||
    item.offer_type === "complimentary" ||
    item.discount_type === "complimentary";

  // Build the offer value string
  let offerValue = "Free";
  if (!isFree) {
    if (item.discount_value) {
      offerValue = String(item.discount_value);
    } else if (item.value_worth && item.value_worth !== "0" && item.value_worth !== 0) {
      offerValue = String(item.value_worth);
    }
  }

  return {
    id: item.id,
    title: item.title ?? "",
    description: item.description ?? "",
    category: ((item.categories?.name ?? item.category ?? "") as Category),
    mediaUrl:
      resolveStorageUrl(item.cover_image_url, "offers") ??
      resolveStorageUrl(item.image_url, "offers") ??
      (item.media_url ||
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop"),
    mediaType: (item.media_type as "image" | "video") ?? "image",
    venueId: item.venues?.id ?? item.venue_id ?? "",
    venueName: item.venues?.name ?? "Venue",
    venueLogoUrl: resolveStorageUrl(item.venues?.logo_url, "venues") ?? item.venues?.logo_url ?? "",
    venueVerified: item.venues?.verified ?? false,
    minFollowers: item.min_followers ?? 0,
    minEngagementRate: item.min_engagement_rate ?? 0,
    platforms: item.platforms ?? [],
    offerValue,
    isFree,
    slotsTotal: item.max_redemptions ?? 0,
    slotsRemaining: Math.max(
      0,
      (item.max_redemptions ?? 0) - (item.current_redemptions ?? 0),
    ),
    expiryDate: item.end_date ?? "",
    bookingWindow: "",
    location: {
      city: item.venues?.city ?? "",
      address: item.venues?.address ?? "",
      lat: item.venues?.latitude ?? 0,
      lon: item.venues?.longitude ?? 0,
    },
    postRequirements: {
      postType: item.post_type ?? "story",
      numberOfPosts: item.number_of_posts ?? 1,
      captionRequirements: item.caption_requirements ?? "",
    },
    status: !item.is_active
      ? "expired"
      : item.max_redemptions &&
          (item.current_redemptions ?? 0) >= (item.max_redemptions ?? 999)
        ? "full"
        : "open",
    type: (item.offer_type === "event" ? "event" : "offer") as "offer" | "event",
    eventDate: item.event_date ?? undefined,
    eventTime: item.event_time ?? undefined,
  };
}
