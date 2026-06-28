import createContextHook from "@nkzw/create-context-hook";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { apiRequestWithRefresh } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ThemeColors } from "@/constants/colors";

const queryClient = new QueryClient();

type UserProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  followers_count: number;
  engagement_rate: number;
};

type AuthState = {
  session: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInfluencer: boolean;
};

/** Resolve a Supabase Storage path to a public URL, or return the raw URL. */
function getPublicUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInfluencer, setIsInfluencer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fetch app settings (currency) on mount
    (async () => {
      try {
        const { data: settingsData } = await supabase
          .from("app_settings")
          .select("key, value");
        if (settingsData) {
          const map: Record<string, string> = {};
          (settingsData as any[]).forEach((s) => { map[s.key] = s.value; });
          useCurrencyStore.getState().setSettings(map);
        }
      } catch {}
    })();

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        checkRole(s.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s) {
          checkRole(s.user.id);
        } else {
          setProfile(null);
          setIsInfluencer(false);
          setIsLoading(false);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkRole = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleData?.role === "influencer") {
        setIsInfluencer(true);
        await fetchProfile(userId);
      } else {
        setIsInfluencer(false);
        setIsLoading(false);
      }
    } catch {
      setIsInfluencer(false);
      setIsLoading(false);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      // Use the influencer-api edge function for profile data
      const data = await apiRequestWithRefresh("/profile") as { profile?: UserProfile };

      if (data?.profile) {
        setProfile({
          ...(data.profile as UserProfile),
          avatar_url: getPublicUrl(data.profile.avatar_url),
        });
      } else {
        // Fallback: try direct Supabase query
        const { data: dbData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (dbData) {
          setProfile({
            ...(dbData as UserProfile),
            avatar_url: getPublicUrl(dbData.avatar_url),
          });
        }
      }
    } catch {
      // Profile might not exist yet
    }
    setIsLoading(false);
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setIsInfluencer(false);
    router.replace("/");
  }, [router]);

  return {
    session,
    profile,
    isLoading,
    isInfluencer,
    signOut,
    refreshProfile: () => session && fetchProfile(session.user.id),
  };
});

/** Guard that redirects unauthenticated users away from protected routes */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isInfluencer } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    const inTabsGroup = segments[0] === "(tabs)";

    if (!session || !isInfluencer) {
      if (inTabsGroup) {
        router.replace("/");
      }
    }
  }, [session, isLoading, isInfluencer, segments]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { isDark, colors } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="login"
                options={{
                  headerShown: true,
                  headerTitle: "",
                  headerTransparent: true,
                  headerTintColor: colors.text,
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="forgot-password"
                options={{
                  headerShown: true,
                  headerTitle: "",
                  headerTransparent: true,
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="signup"
                options={{
                  headerShown: true,
                  headerTitle: "",
                  headerTransparent: true,
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: true,
                  headerTitle: "Settings",
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="edit-profile"
                options={{
                  headerShown: true,
                  headerTitle: "Edit Profile",
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="offer/[id]"
                options={{
                  headerShown: true,
                  headerTitle: "",
                  headerTransparent: true,
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="booking/[id]"
                options={{
                  headerShown: true,
                  headerTitle: "Booking Details",
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="connect-social"
                options={{
                  headerShown: true,
                  headerTitle: "Connect Account",
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="modal"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  headerTitle: "",
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  animation: "slide_from_bottom",
                }}
              />
            </Stack>
          </View>
        </AuthGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
