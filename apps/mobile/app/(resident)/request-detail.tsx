import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  AppButton,
  AppScreen,
  BodyText,
  EmptyState,
  ErrorState,
  InputField,
  KeyValueRow,
  LoadingState,
  SectionCard,
  StatusPill,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { RequestThreadCard } from "../../src/features/resident/RequestThreadCard";
import { useRequestThread } from "../../src/features/resident/useRequestThread";
import { formatCurrency, formatDateTime } from "../../src/lib/format";
import { tokens } from "../../src/theme/tokens";

export default function ResidentRequestDetailScreen() {
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const queryClient = useQueryClient();
  const { services, user } = useSession();

  const [paymentReference, setPaymentReference] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["resident", "request-detail", requestId],
    queryFn: () => services.resident.requestDetail(String(requestId)),
    enabled: Boolean(requestId),
    refetchInterval: 10_000,
  });

  const thread = useRequestThread(requestId);

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      services.payments.createSession({
        amount: Number(detailQuery.data?.billedAmount || 0),
        serviceRequestId: String(requestId),
        description: detailQuery.data?.categoryLabel || detailQuery.data?.category || "CityConnect payment",
      }),
    onSuccess: (payload) => {
      setPaymentReference(payload.reference);
      setPaymentFeedback(
        `Payment session created. Reference ${payload.reference}. The current mobile MVP uses the same backend reference and verification pattern as web.`,
      );
    },
    onError: (error: any) => {
      setPaymentFeedback(String(error?.message || "Failed to start payment"));
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: () => services.payments.verify(paymentReference.trim()),
    onSuccess: () => {
      setPaymentFeedback("Verification completed. Request state will refresh from backend.");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", requestId] });
      queryClient.invalidateQueries({ queryKey: ["resident", "request-list"] });
    },
    onError: (error: any) => {
      setPaymentFeedback(String(error?.message || "Verification failed"));
    },
  });

  const declinePaymentMutation = useMutation({
    mutationFn: () => services.requests.declinePayment(String(requestId), "Declined from mobile"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", requestId] });
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: () => services.requests.confirmDelivery(String(requestId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", requestId] });
      queryClient.invalidateQueries({ queryKey: ["resident", "request-list"] });
    },
  });

  const disputeDeliveryMutation = useMutation({
    mutationFn: () => services.requests.disputeDelivery(String(requestId), disputeReason.trim()),
    onSuccess: () => {
      setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", requestId] });
    },
  });

  const cancellationMutation = useMutation({
    mutationFn: () =>
      services.requests.createCancellationCase(String(requestId), {
        reasonCode: "other",
        reasonDetail: cancellationReason.trim(),
        preferredResolution: "refund_if_applicable",
      }),
    onSuccess: () => {
      setCancellationReason("");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", requestId] });
    },
  });

  if (!requestId) {
    return (
      <AppScreen>
        <EmptyState title="Missing request id" body="Open this screen from the resident request list." />
      </AppScreen>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading request detail..." />
      </AppScreen>
    );
  }

  if (detailQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="The backend did not return request detail for this resident request."
          action={
            <AppButton variant="secondary" onPress={() => void detailQuery.refetch()}>
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  const request = detailQuery.data;
  if (!request) {
    return (
      <AppScreen>
        <EmptyState title="Request not found" body="The backend did not return a matching service request." />
      </AppScreen>
    );
  }

  const awaitingPayment = Boolean(request.paymentRequestedAt) && request.paymentStatus !== "paid";
  const awaitingConfirmation = request.status === "work_completed_pending_resident";

  return (
    <AppScreen>
      <SectionCard>
        <View style={styles.header}>
          <StatusPill status={request.status} />
          {request.paymentStatus ? <Text style={styles.metaChip}>Payment: {request.paymentStatus}</Text> : null}
        </View>
        <Title>{request.categoryLabel || request.category || "Request"}</Title>
        <BodyText muted>{request.description || "No description provided."}</BodyText>
        <KeyValueRow label="Location" value={request.location || "Not specified"} />
        <KeyValueRow label="Urgency" value={request.urgency || "Not specified"} />
        <KeyValueRow label="Created" value={formatDateTime(request.createdAt)} />
        <KeyValueRow label="Updated" value={formatDateTime(request.updatedAt || request.createdAt)} />
      </SectionCard>

      {request.provider ? (
        <SectionCard>
          <Title>Assigned provider</Title>
          <KeyValueRow label="Name" value={request.provider.name || "Pending assignment"} />
          <KeyValueRow label="Company" value={request.provider.company || "Not provided"} />
          <KeyValueRow label="Service" value={request.provider.serviceCategory || "Not provided"} />
        </SectionCard>
      ) : null}

      {request.maintenance ? (
        <SectionCard>
          <Title>Maintenance context</Title>
          <KeyValueRow label="Source" value={String(request.maintenance.source || "resident_maintenance")} />
          <KeyValueRow label="Next step" value={String(request.maintenance.nextStep || "Continue request workflow")} />
          <KeyValueRow
            label="Asset"
            value={String(request.maintenance.asset?.customName || request.maintenance.asset?.label || "Linked asset")}
          />
          <KeyValueRow label="Plan" value={String(request.maintenance.plan?.name || "Not linked")} />
        </SectionCard>
      ) : null}

      {awaitingPayment ? (
        <SectionCard>
          <Title>Payment action</Title>
          <BodyText muted>
            Admin or provider requested payment on this request. The mobile client starts and verifies payment against the same Paystack-backed backend handlers used elsewhere in CityConnect.
          </BodyText>
          <KeyValueRow label="Amount" value={formatCurrency(request.billedAmount)} />
          <AppButton onPress={() => createPaymentMutation.mutate()} disabled={createPaymentMutation.isPending}>
            {createPaymentMutation.isPending ? "Starting payment..." : "Start payment session"}
          </AppButton>
          <InputField placeholder="Payment reference" value={paymentReference} onChangeText={setPaymentReference} />
          <AppButton
            variant="secondary"
            onPress={() => verifyPaymentMutation.mutate()}
            disabled={verifyPaymentMutation.isPending || !paymentReference.trim()}
          >
            {verifyPaymentMutation.isPending ? "Verifying..." : "Verify payment"}
          </AppButton>
          <AppButton
            variant="danger"
            onPress={() => declinePaymentMutation.mutate()}
            disabled={declinePaymentMutation.isPending}
          >
            {declinePaymentMutation.isPending ? "Declining..." : "Decline payment"}
          </AppButton>
          {paymentFeedback ? <BodyText muted>{paymentFeedback}</BodyText> : null}
        </SectionCard>
      ) : null}

      {awaitingConfirmation ? (
        <SectionCard>
          <Title>Delivery confirmation</Title>
          <BodyText muted>
            Once work is marked complete, the same backend request flow expects the resident to confirm or dispute delivery.
          </BodyText>
          <AppButton onPress={() => confirmDeliveryMutation.mutate()} disabled={confirmDeliveryMutation.isPending}>
            {confirmDeliveryMutation.isPending ? "Confirming..." : "Confirm delivery"}
          </AppButton>
          <InputField multiline placeholder="Reason for dispute" value={disputeReason} onChangeText={setDisputeReason} />
          <AppButton
            variant="danger"
            onPress={() => disputeDeliveryMutation.mutate()}
            disabled={disputeDeliveryMutation.isPending || disputeReason.trim().length < 5}
          >
            {disputeDeliveryMutation.isPending ? "Submitting..." : "Raise dispute"}
          </AppButton>
        </SectionCard>
      ) : null}

      {["assigned", "assigned_for_job", "in_progress"].includes(String(request.status || "")) ? (
        <SectionCard>
          <Title>Cancellation review</Title>
          <BodyText muted>
            Active jobs route through the same admin cancellation-case workflow used by the web application.
          </BodyText>
          <InputField
            multiline
            placeholder="Reason for cancellation"
            value={cancellationReason}
            onChangeText={setCancellationReason}
          />
          <AppButton
            variant="danger"
            onPress={() => cancellationMutation.mutate()}
            disabled={cancellationMutation.isPending || cancellationReason.trim().length < 5}
          >
            {cancellationMutation.isPending ? "Submitting..." : "Request cancellation review"}
          </AppButton>
        </SectionCard>
      ) : null}

      <RequestThreadCard
        user={user}
        messages={thread.messagesQuery.data || []}
        typingState={thread.typingQuery.data}
        draft={thread.messageDraft}
        onChangeDraft={thread.setMessageDraft}
        onSend={() => thread.sendMessageMutation.mutate()}
        sending={thread.sendMessageMutation.isPending}
        loading={thread.messagesQuery.isLoading}
        error={thread.messagesQuery.isError ? "Chat could not be loaded from the backend." : null}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    alignItems: "center",
  },
  metaChip: {
    fontSize: 12,
    color: tokens.color.accent,
    backgroundColor: tokens.color.accentSoft,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    overflow: "hidden",
  },
});
