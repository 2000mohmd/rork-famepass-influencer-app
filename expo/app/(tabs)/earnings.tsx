import {
  ArrowDownToLine,
  Clock,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal as RNModal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/app/_layout";
import { supabase } from "@/lib/supabase";

interface Earning {
  id: string;
  influencer_id: string;
  amount: number;
  source: string;
  status: string;
  created_at: string;
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      if (!session?.user?.id) return 0;
      const { data, error } = await supabase.rpc("get_wallet_balance", {
        _user_id: session.user.id,
      });
      if (error) return 0;
      return (data as number) ?? 0;
    },
    enabled: !!session?.user?.id,
  });

  const { data: pendingWithdrawal } = useQuery({
    queryKey: ["pending-withdrawal"],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("influencer_id", session.user.id)
        .eq("status", "pending")
        .single();
      return data ?? null;
    },
    enabled: !!session?.user?.id,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ["earnings"],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data } = await supabase
        .from("earnings")
        .select("*")
        .eq("influencer_id", session.user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Earning[];
    },
    enabled: !!session?.user?.id,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      await supabase.from("withdrawal_requests").insert({
        influencer_id: session?.user?.id,
        amount,
        payment_method: "bank_transfer",
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawError(null);
    },
    onError: () => {
      setWithdrawError("Failed to submit withdrawal. Please try again.");
    },
  });

  const handleWithdraw = useCallback(() => {
    setWithdrawError(null);
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Enter a valid amount greater than 0.");
      return;
    }
    if (balance !== undefined && amount > (balance ?? 0)) {
      setWithdrawError("Amount exceeds your wallet balance.");
      return;
    }
    withdrawMutation.mutate(amount);
  }, [withdrawAmount, balance]);

  const totalEarnings = earnings?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0;
  const safeBalance = balance ?? 0;

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={earnings ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceLabelRow}>
                <Wallet size={18} color={colors.accentLight} />
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
              </View>
              {balanceLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.balanceValue}>
                  AED {safeBalance.toLocaleString()}
                </Text>
              )}
              <View style={styles.balanceActions}>
                <Pressable
                  style={styles.withdrawButton}
                  onPress={() => {
                    setWithdrawError(null);
                    setShowWithdraw(true);
                  }}
                  disabled={safeBalance === 0}
                >
                  <ArrowDownToLine size={16} color={colors.background} />
                  <Text style={styles.withdrawButtonText}>Withdraw</Text>
                </Pressable>
              </View>
            </View>

            {pendingWithdrawal && (
              <View style={styles.pendingBanner}>
                <Clock size={16} color={colors.orange} />
                <Text style={styles.pendingText}>
                  Pending withdrawal: AED {pendingWithdrawal.amount?.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Total Earnings */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalValue}>AED {totalEarnings.toLocaleString()}</Text>
            </View>

            <Text style={styles.sectionTitle}>Earnings History</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          !earningsLoading ? (
            <View style={styles.emptyState}>
              <Wallet size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No earnings yet</Text>
              <Text style={styles.emptyText}>
                Complete offers and attend events to start earning.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.earningCard}>
            <View style={styles.earningLeft}>
              <Text style={styles.earningSource}>{item.source ?? "Offer Payment"}</Text>
              <Text style={styles.earningDate}>
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.earningRight}>
              <Text style={styles.earningAmount}>+ AED {item.amount?.toLocaleString()}</Text>
              {item.status && (
                <View style={[styles.earningStatus, {
                  backgroundColor: item.status === "completed" ? colors.green + "18" : colors.orange + "18",
                }]}>
                  <Text style={[styles.earningStatusText, {
                    color: item.status === "completed" ? colors.green : colors.orange,
                  }]}>
                    {item.status}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* Withdraw Modal */}
      <RNModal
        visible={showWithdraw}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdraw(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowWithdraw(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>
            <Text style={styles.modalSubtitle}>
              Available: AED {safeBalance.toLocaleString()}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Amount (AED)</Text>
              <TextInput
                ref={inputRef}
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                autoFocus
              />
            </View>

            {withdrawError && (
              <Text style={styles.modalError}>{withdrawError}</Text>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setShowWithdraw(false);
                  setWithdrawAmount("");
                  setWithdrawError(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, withdrawMutation.isPending && styles.buttonDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 16, paddingBottom: 100 },
    headerSection: { gap: 14, marginBottom: 8 },
    balanceCard: { backgroundColor: colors.accent + "12", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.accent + "25", gap: 12 },
    balanceLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    balanceLabel: { fontSize: 14, fontWeight: "600", color: colors.accentLight },
    balanceValue: { fontSize: 40, fontWeight: "700", color: colors.text },
    balanceActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    withdrawButton: { flexDirection: "row", alignItems: "center", backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, gap: 6 },
    withdrawButtonText: { fontSize: 15, fontWeight: "700", color: colors.background },
    pendingBanner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.orange + "12", borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.orange + "25" },
    pendingText: { fontSize: 13, fontWeight: "600", color: colors.orange, flex: 1 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    totalLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    totalValue: { fontSize: 18, fontWeight: "700", color: colors.text },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },
    earningCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.cardBorder },
    earningLeft: { gap: 4 },
    earningSource: { fontSize: 15, fontWeight: "600", color: colors.text },
    earningDate: { fontSize: 12, color: colors.textMuted },
    earningRight: { alignItems: "flex-end", gap: 4 },
    earningAmount: { fontSize: 16, fontWeight: "700", color: colors.green },
    earningStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    earningStatusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 32 },
    modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: colors.cardBorder, gap: 14 },
    modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 14, color: colors.textSecondary },
    modalInputGroup: { gap: 6 },
    modalLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 4 },
    modalInput: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: "700", color: colors.text, borderWidth: 1, borderColor: colors.inputBorder },
    modalError: { fontSize: 13, color: colors.red, fontWeight: "500" },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalCancel: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    modalSubmit: { flex: 1, alignItems: "center", backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 14 },
    buttonDisabled: { opacity: 0.5 },
    modalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.background },
  });
}
