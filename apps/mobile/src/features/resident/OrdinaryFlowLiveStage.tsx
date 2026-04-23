import { StyleSheet, Text, View } from "react-native";
import { AppUser, ServiceRequest } from "../../api/contracts";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { tokens } from "../../theme/tokens";
import {
  AppButton,
  BodyText,
  InputField,
  KeyValueRow,
  SectionCard,
  StatusPill,
  Title,
} from "../../components/ui";
import { RequestThreadCard } from "./RequestThreadCard";

type Props = {
  request: ServiceRequest;
  user: AppUser | null;
  thread: {
    messagesQuery: { data?: any[]; isLoading: boolean; isError: boolean };
    typingQuery: { data?: Record<string, unknown> | null };
    messageDraft: string;
    setMessageDraft: (value: string) => void;
    sendMessageMutation: { mutate: () => void; isPending: boolean };
  };
  paymentReference: string;
  onChangePaymentReference: (value: string) => void;
  paymentFeedback: string;
  onStartPayment: () => void;
  startingPayment: boolean;
  onVerifyPayment: () => void;
  verifyingPayment: boolean;
  onDeclinePayment: () => void;
  decliningPayment: boolean;
  disputeReason: string;
  onChangeDisputeReason: (value: string) => void;
  onConfirmDelivery: () => void;
  confirmingDelivery: boolean;
  onDisputeDelivery: () => void;
  disputingDelivery: boolean;
  cancellationReason: string;
  onChangeCancellationReason: (value: string) => void;
  onRequestCancellation: () => void;
  requestingCancellation: boolean;
};

export function OrdinaryFlowLiveStage({
  request,
  user,
  thread,
  paymentReference,
  onChangePaymentReference,
  paymentFeedback,
  onStartPayment,
  startingPayment,
  onVerifyPayment,
  verifyingPayment,
  onDeclinePayment,
  decliningPayment,
  disputeReason,
  onChangeDisputeReason,
  onConfirmDelivery,
  confirmingDelivery,
  onDisputeDelivery,
  disputingDelivery,
  cancellationReason,
  onChangeCancellationReason,
  onRequestCancellation,
  requestingCancellation,
}: Props) {
  const awaitingPayment = Boolean(request.paymentRequestedAt) && request.paymentStatus !== "paid";
  const awaitingConfirmation = request.status === "work_completed_pending_resident";

  return (
    <View style={styles.stack}>
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
            This request has a payment request waiting. Mobile uses the same Paystack-backed backend session and verification handlers as web.
          </BodyText>
          <KeyValueRow label="Amount" value={formatCurrency(request.billedAmount)} />
          <AppButton onPress={onStartPayment} disabled={startingPayment}>
            {startingPayment ? "Starting payment..." : "Start payment session"}
          </AppButton>
          <InputField placeholder="Payment reference" value={paymentReference} onChangeText={onChangePaymentReference} />
          <AppButton variant="secondary" onPress={onVerifyPayment} disabled={verifyingPayment || !paymentReference.trim()}>
            {verifyingPayment ? "Verifying..." : "Verify payment"}
          </AppButton>
          <AppButton variant="danger" onPress={onDeclinePayment} disabled={decliningPayment}>
            {decliningPayment ? "Declining..." : "Decline payment"}
          </AppButton>
          {paymentFeedback ? <BodyText muted>{paymentFeedback}</BodyText> : null}
        </SectionCard>
      ) : null}

      {awaitingConfirmation ? (
        <SectionCard>
          <Title>Delivery confirmation</Title>
          <BodyText muted>
            Work has been marked complete. Confirm delivery if satisfied or raise a dispute for admin review.
          </BodyText>
          <AppButton onPress={onConfirmDelivery} disabled={confirmingDelivery}>
            {confirmingDelivery ? "Confirming..." : "Confirm delivery"}
          </AppButton>
          <InputField multiline placeholder="Reason for dispute" value={disputeReason} onChangeText={onChangeDisputeReason} />
          <AppButton variant="danger" onPress={onDisputeDelivery} disabled={disputingDelivery || disputeReason.trim().length < 5}>
            {disputingDelivery ? "Submitting..." : "Raise dispute"}
          </AppButton>
        </SectionCard>
      ) : null}

      {["assigned", "assigned_for_job", "in_progress"].includes(String(request.status || "")) ? (
        <SectionCard>
          <Title>Cancellation review</Title>
          <BodyText muted>
            Active jobs route through the same admin cancellation-case workflow used by the web application.
          </BodyText>
          <InputField multiline placeholder="Reason for cancellation" value={cancellationReason} onChangeText={onChangeCancellationReason} />
          <AppButton variant="danger" onPress={onRequestCancellation} disabled={requestingCancellation || cancellationReason.trim().length < 5}>
            {requestingCancellation ? "Submitting..." : "Request cancellation review"}
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
        title="Live request chat"
        intro="This request now uses the same live `/api/service-requests/:id/messages` and typing endpoints as the resident web flow."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metaChip: {
    backgroundColor: tokens.color.accentSoft,
    borderRadius: tokens.radius.pill,
    color: tokens.color.accent,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
});
