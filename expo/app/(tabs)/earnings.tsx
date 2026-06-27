import {
  ArrowDownToLine,
  Clock,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
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

import Colors from "@/constants/colors";
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
    if (balance !== undefined && amount > balance) {
      setWithdrawError("Amount exceeds your wallet balance.");
      return;
    }
    withdrawMutation.mutate(amount);
  }, [withdrawAmount, balance]);

  const totalEarnings = earnings?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0;

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
                <Wallet size={18} color={Colors.dark.accentLight} />
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
              </View>
              {balanceLoading ? (
                <ActivityIndicator size="small" color={Colors.dark.accent} />
              ) : (
                <Text style={styles.balanceValue}>
                  AED {balance?.toLocaleString() ?? "0"}
                </Text>
              )}
              <View style={styles.balanceActions}>
                <Pressable
                  style={styles.withdrawButton}
                  onPress={() => {
                    setWithdrawError(null);
                    setShowWithdraw(true);
                  }}
                  disabled={!balance || balance === 0}
                >
                  <ArrowDownToLine size={16} color={Colors.dark.background} />
                  <Text style={styles.withdrawButtonText}>Withdraw</Text>
                </Pressable>
              </View>
            </View>

            {pendingWithdrawal && (
              <View style={styles.pendingBanner}>
                <Clock size={16} color={Colors.dark.orange} />
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
              <Wallet size={48} color={Colors.dark.textMuted} />
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
                  backgroundColor: item.status === "completed" ? Colors.dark.green + "18" : Colors.dark.orange + "18",
                }]}>
                  <Text style={[styles.earningStatusText, {
                    color: item.status === "completed" ? Colors.dark.green : Colors.dark.orange,
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
              Available: AED {balance?.toLocaleString() ?? "0"}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Amount (AED)</Text>
              <TextInput
                ref={inputRef}
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={Colors.dark.textMuted}
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
                  <ActivityIndicator size="small" color={Colors.dark.background} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerSection: {
    gap: 14,
    marginBottom: 8,
  },
  balanceCard: {
    backgroundColor: Colors.dark.accent + "12",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.dark.accent + "25",
    gap: 12,
  },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.accentLight,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  withdrawButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.background,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.orange + "12",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.orange + "25",
  },
  pendingText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.orange,
    flex: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    marginTop: 4,
  },
  earningCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  earningLeft: {
    gap: 4,
  },
  earningSource: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  earningDate: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  earningRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.green,
  },
  earningStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  earningStatusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalContent: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  modalError: {
    fontSize: 13,
    color: Colors.dark.red,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  modalSubmit: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.dark.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.background,
  },
});
