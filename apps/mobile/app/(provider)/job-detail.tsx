import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
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
import {
  canMarkProviderJobComplete,
  canMoveProviderJobToInProgress,
  hasConsultancyReport,
} from "../../src/features/provider/providerPresentation";
import { useProviderThread } from "../../src/features/provider/useProviderThread";
import { formatCurrency, formatDateTime } from "../../src/lib/format";

export default function ProviderJobDetailScreen() {
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const queryClient = useQueryClient();
  const { services, user } = useSession();

  const [inspectionDate, setInspectionDate] = useState("");
  const [completionDeadline, setCompletionDeadline] = useState("");
  const [actualIssue, setActualIssue] = useState("");
  const [causeOfIssue, setCauseOfIssue] = useState("");
  const [materialCost, setMaterialCost] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [preventiveRecommendation, setPreventiveRecommendation] = useState("");
  const [feedback, setFeedback] = useState("");

  const detailQuery = useQuery({
    queryKey: ["provider", "job-detail", requestId],
    queryFn: () => services.requests.detail(String(requestId)),
    enabled: Boolean(requestId),
    refetchInterval: 10_000,
  });

  const thread = useProviderThread(requestId);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => services.requests.update(String(requestId), { status }),
    onSuccess: () => {
      setFeedback("Job status updated.");
      queryClient.invalidateQueries({ queryKey: ["provider", "job-detail", requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider", "assigned-jobs"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Failed to update status")),
  });

  const completeMutation = useMutation({
    mutationFn: () => services.requests.markWorkCompleted(String(requestId)),
    onSuccess: () => {
      setFeedback("Work marked as completed. Resident confirmation is now required.");
      queryClient.invalidateQueries({ queryKey: ["provider", "job-detail", requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider", "assigned-jobs"] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Failed to mark work completed")),
  });

  const consultancyMutation = useMutation({
    mutationFn: () =>
      services.requests.submitConsultancyReport(String(requestId), {
        inspectionDate,
        completionDeadline,
        actualIssue,
        causeOfIssue,
        materialCost: Number(materialCost || 0),
        serviceCost: Number(serviceCost || 0),
        preventiveRecommendation,
        evidence: [],
      }),
    onSuccess: () => {
      setFeedback("Consultancy report submitted.");
      queryClient.invalidateQueries({ queryKey: ["provider", "job-detail", requestId] });
    },
    onError: (error: any) => setFeedback(String(error?.message || "Failed to submit report")),
  });

  if (!requestId) {
    return (
      <AppScreen>
        <EmptyState title="Missing request id" body="Open this screen from the jobs list." />
      </AppScreen>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading job detail..." />
      </AppScreen>
    );
  }

  if (detailQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="The backend did not return a matching provider job."
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
        <EmptyState title="Job not found" body="The backend did not return a matching provider job." />
      </AppScreen>
    );
  }

  const report = request.consultancyReport as Record<string, unknown> | null | undefined;

  return (
    <AppScreen>
      <SectionCard>
        <StatusPill status={request.status} />
        <Title>{request.categoryLabel || request.category || "Job"}</Title>
        <BodyText muted>{request.description || "No description provided."}</BodyText>
        <KeyValueRow label="Location" value={request.location || "Not specified"} />
        <KeyValueRow label="Urgency" value={request.urgency || "Not specified"} />
        <KeyValueRow label="Assigned" value={formatDateTime(request.assignedAt || request.createdAt)} />
        <KeyValueRow label="Last update" value={formatDateTime(request.updatedAt || request.createdAt)} />
      </SectionCard>

      <SectionCard>
        <Title>Status actions</Title>
        <BodyText muted>
          Providers can only move jobs to `in_progress` and then to resident confirmation. Assignment for job and payment-gated transitions stay admin-controlled.
        </BodyText>
        <AppButton
          variant="secondary"
          onPress={() => updateStatusMutation.mutate("in_progress")}
          disabled={updateStatusMutation.isPending || !canMoveProviderJobToInProgress(request.status)}
        >
          {updateStatusMutation.isPending ? "Updating..." : "Move to in progress"}
        </AppButton>
        <AppButton
          onPress={() => completeMutation.mutate()}
          disabled={completeMutation.isPending || !canMarkProviderJobComplete(request.status)}
        >
          {completeMutation.isPending ? "Updating..." : "Mark work completed"}
        </AppButton>
        {feedback ? <BodyText muted>{feedback}</BodyText> : null}
      </SectionCard>

      {hasConsultancyReport(request) ? (
        <SectionCard>
          <Title>Submitted consultancy report</Title>
          <KeyValueRow label="Inspection date" value={String(report?.inspectionDate || "Not provided")} />
          <KeyValueRow label="Completion deadline" value={String(report?.completionDeadline || "Not provided")} />
          <KeyValueRow label="Actual issue" value={String(report?.actualIssue || "Not provided")} />
          <KeyValueRow label="Cause" value={String(report?.causeOfIssue || "Not provided")} />
          <KeyValueRow label="Material cost" value={formatCurrency(report?.materialCost)} />
          <KeyValueRow label="Service cost" value={formatCurrency(report?.serviceCost)} />
          <KeyValueRow
            label="Preventive recommendation"
            value={String(report?.preventiveRecommendation || "Not provided")}
          />
        </SectionCard>
      ) : null}

      <SectionCard>
        <Title>Consultancy report</Title>
        <BodyText muted>
          This submits to `/api/provider/service-requests/:id/consultancy-report` and preserves the current admin review and payment-request workflow.
        </BodyText>
        <InputField placeholder="Inspection date (ISO)" value={inspectionDate} onChangeText={setInspectionDate} />
        <InputField
          placeholder="Completion deadline (ISO)"
          value={completionDeadline}
          onChangeText={setCompletionDeadline}
        />
        <InputField multiline placeholder="Actual issue" value={actualIssue} onChangeText={setActualIssue} />
        <InputField multiline placeholder="Cause of issue" value={causeOfIssue} onChangeText={setCauseOfIssue} />
        <InputField
          keyboardType="numeric"
          placeholder="Material cost"
          value={materialCost}
          onChangeText={setMaterialCost}
        />
        <InputField
          keyboardType="numeric"
          placeholder="Service cost"
          value={serviceCost}
          onChangeText={setServiceCost}
        />
        <InputField
          multiline
          placeholder="Preventive recommendation"
          value={preventiveRecommendation}
          onChangeText={setPreventiveRecommendation}
        />
        <AppButton
          onPress={() => consultancyMutation.mutate()}
          disabled={
            consultancyMutation.isPending ||
            !inspectionDate ||
            !completionDeadline ||
            actualIssue.trim().length < 3 ||
            causeOfIssue.trim().length < 3 ||
            preventiveRecommendation.trim().length < 3
          }
        >
          {consultancyMutation.isPending ? "Submitting..." : "Submit report"}
        </AppButton>
      </SectionCard>

      <RequestThreadCard
        user={user}
        viewerRole="provider"
        title="Resident thread"
        intro="This thread uses the same request message and typing endpoints as the provider web workflow."
        emptyTitle="No thread activity yet"
        emptyBody="When the resident or support team replies, the conversation will appear here."
        composerPlaceholder="Send update to resident"
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
