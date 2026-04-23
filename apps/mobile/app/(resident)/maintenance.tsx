import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import {
  AppButton,
  AppScreen,
  BodyText,
  Heading,
  InputField,
  LoadingState,
  SectionCard,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { formatDateTime } from "../../src/lib/format";
import { tokens } from "../../src/theme/tokens";

export default function ResidentMaintenanceScreen() {
  const queryClient = useQueryClient();
  const { services } = useSession();

  const [categoryId, setCategoryId] = useState("");
  const [maintenanceItemId, setMaintenanceItemId] = useState("");
  const [customName, setCustomName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [subscriptionStartDate, setSubscriptionStartDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [feedback, setFeedback] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["resident", "maintenance-categories"],
    queryFn: () => services.maintenance.catalogCategories(),
  });

  const itemsQuery = useQuery({
    queryKey: ["resident", "maintenance-items", categoryId],
    queryFn: () => services.maintenance.catalogItems(categoryId || undefined),
  });

  const assetsQuery = useQuery({
    queryKey: ["resident", "maintenance-assets"],
    queryFn: () => services.maintenance.assets(),
  });

  const plansQuery = useQuery({
    queryKey: ["resident", "maintenance-plans", selectedAssetId],
    queryFn: () => services.maintenance.assetPlans(selectedAssetId),
    enabled: Boolean(selectedAssetId),
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["resident", "maintenance-subscriptions"],
    queryFn: () => services.maintenance.subscriptions(),
  });

  const schedulesQuery = useQuery({
    queryKey: ["resident", "maintenance-schedules"],
    queryFn: () => services.maintenance.schedules(),
  });

  useEffect(() => {
    if (selectedAssetId) return;
    const firstAssetId = String((assetsQuery.data?.[0] as any)?.id || "");
    if (firstAssetId) {
      setSelectedAssetId(firstAssetId);
    }
  }, [assetsQuery.data, selectedAssetId]);

  const createAssetMutation = useMutation({
    mutationFn: () =>
      services.maintenance.createAsset({
        maintenanceItemId,
        customName: customName.trim() || undefined,
        locationLabel: locationLabel.trim() || undefined,
      }),
    onSuccess: () => {
      setCustomName("");
      setLocationLabel("");
      setFeedback("Asset created from admin-managed maintenance catalog.");
      queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-assets"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Failed to create asset")),
  });

  const initiateSubscriptionMutation = useMutation({
    mutationFn: () =>
      services.maintenance.initiateSubscription({
        residentAssetId: selectedAssetId,
        maintenancePlanId: selectedPlanId,
        startDate: subscriptionStartDate || undefined,
      }),
    onSuccess: (result) => {
      setPaymentReference(String(result.reference || ""));
      setFeedback(
        result.reference
          ? `Subscription initiated. Verify Paystack reference ${result.reference} after payment.`
          : "Subscription activated without pending payment.",
      );
      queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-subscriptions"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Failed to initiate subscription")),
  });

  const verifySubscriptionMutation = useMutation({
    mutationFn: () => services.maintenance.verifySubscription(paymentReference.trim()),
    onSuccess: () => {
      setFeedback("Subscription payment verified.");
      queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-schedules"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Verification failed")),
  });

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      services.maintenance.reschedule(scheduleId, {
        scheduledDate: new Date(rescheduleDate).toISOString(),
      }),
    onSuccess: () => {
      setFeedback("Maintenance visit rescheduled.");
      queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-schedules"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Reschedule failed")),
  });

  if (
    categoriesQuery.isLoading ||
    itemsQuery.isLoading ||
    assetsQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    schedulesQuery.isLoading
  ) {
    return (
      <AppScreen>
        <LoadingState label="Loading maintenance data..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Heading>Maintenance</Heading>
      <BodyText muted>
        This surface uses resident maintenance endpoints that already exist today. Provider maintenance scheduling stays out of scope until backend support lands.
      </BodyText>

      <SectionCard>
        <Title>Catalog</Title>
        <View style={styles.inline}>
          {(categoriesQuery.data || []).map((category) => (
            <AppButton
              key={category.id}
              variant={categoryId === category.id ? "primary" : "secondary"}
              onPress={() => setCategoryId(category.id)}
            >
              {category.name}
            </AppButton>
          ))}
        </View>
        {(itemsQuery.data || []).map((item: any) => (
          <AppButton
            key={String(item.id)}
            variant={maintenanceItemId === String(item.id) ? "primary" : "ghost"}
            onPress={() => setMaintenanceItemId(String(item.id))}
          >
            {String(item.name || item.itemType?.name || "Maintenance item")}
          </AppButton>
        ))}
      </SectionCard>

      <SectionCard>
        <Title>Add resident asset</Title>
        <InputField placeholder="Asset name" value={customName} onChangeText={setCustomName} />
        <InputField placeholder="Location label" value={locationLabel} onChangeText={setLocationLabel} />
        <AppButton
          onPress={() => createAssetMutation.mutate()}
          disabled={createAssetMutation.isPending || !maintenanceItemId}
        >
          {createAssetMutation.isPending ? "Saving asset..." : "Create asset"}
        </AppButton>
      </SectionCard>

      <SectionCard>
        <Title>Your assets</Title>
        {(assetsQuery.data || []).map((asset: any) => (
          <AppButton
            key={String(asset.id)}
            variant={selectedAssetId === String(asset.id) ? "primary" : "ghost"}
            onPress={() => setSelectedAssetId(String(asset.id))}
          >
            {String(asset.customName || asset.label || asset.itemType?.name || "Asset")}
          </AppButton>
        ))}
      </SectionCard>

      {selectedAssetId ? (
        <SectionCard>
          <Title>Plans for selected asset</Title>
          {(plansQuery.data || []).map((plan) => (
            <AppButton
              key={plan.id}
              variant={selectedPlanId === plan.id ? "primary" : "secondary"}
              onPress={() => setSelectedPlanId(plan.id)}
            >
              {plan.name}
            </AppButton>
          ))}
          <InputField
            placeholder="Subscription start date (YYYY-MM-DD)"
            value={subscriptionStartDate}
            onChangeText={setSubscriptionStartDate}
          />
          <AppButton
            onPress={() => initiateSubscriptionMutation.mutate()}
            disabled={initiateSubscriptionMutation.isPending || !selectedPlanId}
          >
            {initiateSubscriptionMutation.isPending ? "Initiating..." : "Start subscription"}
          </AppButton>
          <InputField
            placeholder="Payment reference for verification"
            value={paymentReference}
            onChangeText={setPaymentReference}
          />
          <AppButton
            variant="secondary"
            onPress={() => verifySubscriptionMutation.mutate()}
            disabled={verifySubscriptionMutation.isPending || !paymentReference.trim()}
          >
            {verifySubscriptionMutation.isPending ? "Verifying..." : "Verify subscription payment"}
          </AppButton>
        </SectionCard>
      ) : null}

      <SectionCard>
        <Title>Subscriptions</Title>
        {(subscriptionsQuery.data || []).map((subscription) => (
          <View key={subscription.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{subscription.plan?.name || "Subscription"}</Text>
            <Text style={styles.itemBody}>Status: {subscription.status || "unknown"}</Text>
            <Text style={styles.itemBody}>Next visit: {formatDateTime(subscription.nextScheduleAt)}</Text>
            <View style={styles.inline}>
              <AppButton
                variant="secondary"
                onPress={() => {
                  void services.maintenance.pauseSubscription(subscription.id).then(() => {
                    setFeedback("Subscription paused.");
                    queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-subscriptions"] });
                  });
                }}
              >
                Pause
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() => {
                  void services.maintenance.resumeSubscription(subscription.id).then(() => {
                    setFeedback("Subscription resumed.");
                    queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-subscriptions"] });
                  });
                }}
              >
                Resume
              </AppButton>
              <AppButton
                variant="danger"
                onPress={() => {
                  void services.maintenance.cancelSubscription(subscription.id).then(() => {
                    setFeedback("Subscription cancelled.");
                    queryClient.invalidateQueries({ queryKey: ["resident", "maintenance-subscriptions"] });
                  });
                }}
              >
                Cancel
              </AppButton>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard>
        <Title>Schedules</Title>
        {(schedulesQuery.data || []).map((schedule) => (
          <AppButton
            key={schedule.id}
            variant={scheduleId === schedule.id ? "primary" : "ghost"}
            onPress={() => setScheduleId(schedule.id)}
          >
            {formatDateTime(schedule.scheduledDate)} · {schedule.status || "scheduled"}
          </AppButton>
        ))}
        <InputField
          placeholder="Reschedule date (YYYY-MM-DD)"
          value={rescheduleDate}
          onChangeText={setRescheduleDate}
        />
        <AppButton
          onPress={() => rescheduleMutation.mutate()}
          disabled={rescheduleMutation.isPending || !scheduleId || !rescheduleDate}
        >
          {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule visit"}
        </AppButton>
      </SectionCard>

      {feedback ? (
        <SectionCard>
          <BodyText muted>{feedback}</BodyText>
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  itemCard: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    gap: 6,
    backgroundColor: tokens.color.surfaceMuted,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: tokens.color.text,
  },
  itemBody: {
    fontSize: 13,
    color: tokens.color.textMuted,
  },
});
