import { Tabs } from "expo-router";
import {
  Compass,
  Home,
  Mail,
  User,
  Wallet,
} from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

const badgeStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFF",
  },
});

function PendingBadge() {
  const { session } = useAuth();
  const { colors } = useTheme();

  const { data: count } = useQuery({
    queryKey: ["pending-invitations-count"],
    queryFn: async () => {
      if (!session?.user?.id) return 0;
      const { count: c } = await supabase
        .from("invitations")
        .select("*", { count: "exact", head: true })
        .eq("influencer_id", session.user.id)
        .eq("status", "pending");
      return c ?? 0;
    },
    enabled: !!session?.user?.id,
    refetchInterval: 30000,
  });

  if (!count || count === 0) return null;

  return (
    <View style={[badgeStyles.badge, { backgroundColor: colors.red }]}>
      <Text style={badgeStyles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600" as const,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Home color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Compass color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="invitations"
        options={{
          title: "Invites",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View>
              <Mail color={color} size={size} strokeWidth={2} />
              <PendingBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Wallet color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <User color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
