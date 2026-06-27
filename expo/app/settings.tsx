import { useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Eye,
  LogOut,
  Moon,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

interface InfluencerSettings {
  notification_invitations: boolean;
  notification_messages: boolean;
  notification_earnings: boolean;
  notification_promotions: boolean;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, profile, session } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["influencer-settings"],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("influencer_settings")
        .select("*")
        .eq("influencer_id", session.user.id)
        .single();
      return (data as InfluencerSettings) ?? null;
    },
    enabled: !!session?.user?.id,
  });

  const updateNotifMutation = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: keyof InfluencerSettings;
      value: boolean;
    }) => {
      if (!session?.user?.id) return;
      await supabase.from("influencer_settings").upsert({
        influencer_id: session.user.id,
        [key]: value,
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPwSuccess(true);
      setNewPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    },
    onError: (e: any) => {
      setPwError(e?.message ?? "Failed to update password.");
    },
  });

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [signOut, router]);

  const toggleNotification = useCallback(
    (key: keyof InfluencerSettings) => {
      const current = settings?.[key] ?? true;
      updateNotifMutation.mutate({ key, value: !current });
    },
    [settings],
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Display name</Text>
            <Text style={styles.rowValue}>{profile?.full_name ?? "—"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{session?.user?.email ?? "—"}</Text>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.subtitle}>Change Password</Text>
          <View style={styles.pwRow}>
            <TextInput
              style={styles.pwInput}
              placeholder="New password"
              placeholderTextColor={Colors.dark.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                setPwError(null);
              }}
            />
            <Pressable
              style={[styles.pwButton, changePasswordMutation.isPending && { opacity: 0.5 }]}
              onPress={() => changePasswordMutation.mutate()}
              disabled={!newPassword || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.dark.background} />
              ) : (
                <Text style={styles.pwButtonText}>Update</Text>
              )}
            </Pressable>
          </View>
          {pwSuccess && (
            <Text style={styles.successText}>Password updated!</Text>
          )}
          {pwError && <Text style={styles.errorText}>{pwError}</Text>}
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <NotifToggle
            label="Invitations"
            value={settings?.notification_invitations ?? true}
            onToggle={() => toggleNotification("notification_invitations")}
          />
          <View style={styles.divider} />
          <NotifToggle
            label="Messages"
            value={settings?.notification_messages ?? true}
            onToggle={() => toggleNotification("notification_messages")}
          />
          <View style={styles.divider} />
          <NotifToggle
            label="Earnings"
            value={settings?.notification_earnings ?? true}
            onToggle={() => toggleNotification("notification_earnings")}
          />
          <View style={styles.divider} />
          <NotifToggle
            label="Promotions"
            value={settings?.notification_promotions ?? false}
            onToggle={() => toggleNotification("notification_promotions")}
          />
        </View>
      </View>

      {/* App */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <Pressable style={styles.row}>
            <View style={styles.rowIconRow}>
              <Moon size={18} color={Colors.dark.textSecondary} />
              <Text style={styles.rowLabel}>Dark mode</Text>
            </View>
            <Text style={styles.rowHint}>Always on</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <View style={styles.rowIconRow}>
              <ShieldCheck size={18} color={Colors.dark.textSecondary} />
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <ChevronRight size={16} color={Colors.dark.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <View style={styles.rowIconRow}>
              <Smartphone size={18} color={Colors.dark.textSecondary} />
              <Text style={styles.rowLabel}>Terms of Service</Text>
            </View>
            <ChevronRight size={16} color={Colors.dark.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: Colors.dark.red }]}>
          Danger Zone
        </Text>
        <Pressable style={styles.logoutCard} onPress={handleLogout}>
          <View style={styles.rowIconRow}>
            <LogOut size={18} color={Colors.dark.red} />
            <Text style={[styles.rowLabel, { color: Colors.dark.red }]}>
              Sign Out
            </Text>
          </View>
          <ChevronRight size={16} color={Colors.dark.red} />
        </Pressable>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function NotifToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconRow}>
        <Bell size={16} color={Colors.dark.textSecondary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: Colors.dark.cardBorder,
          true: Colors.dark.accent + "60",
        }}
        thumbColor={value ? Colors.dark.accent : Colors.dark.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 80,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    maxWidth: "50%",
    textAlign: "right",
  },
  rowHint: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.cardBorder,
    marginLeft: 44,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  pwRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    alignItems: "center",
  },
  pwInput: {
    flex: 1,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.dark.text,
  },
  pwButton: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  pwButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.background,
  },
  successText: {
    fontSize: 13,
    color: Colors.dark.green,
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 13,
    color: Colors.dark.red,
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontWeight: "600",
  },
  logoutCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.red + "08",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.red + "20",
  },
});
