import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppButton,
  BodyText,
  ErrorState,
  FieldLabel,
  InputField,
  LoadingState,
  SectionCard,
} from "../../src/components/ui";
import { DynamicFlowQuestion, OrdinaryFlowStartResponse } from "../../src/api/contracts";
import { useSession } from "../../src/features/auth/session";
import { OrdinaryFlowLiveStage } from "../../src/features/resident/OrdinaryFlowLiveStage";
import { OrdinaryFlowQuestionCard } from "../../src/features/resident/OrdinaryFlowQuestionCard";
import { OrdinaryFlowSummary } from "../../src/features/resident/OrdinaryFlowSummary";
import { OrdinaryFlowThread } from "../../src/features/resident/OrdinaryFlowThread";
import {
  buildLegacyFallbackQuestions,
  buildOrdinaryFlowThreadItems,
  buildPreferredTime,
  buildRequestDescription,
  buildSummaryItems,
  EMPTY_QUESTION_DRAFT,
  IntakeDraft,
  normalizeSession,
  OrdinaryFlowStage,
} from "../../src/features/resident/ordinaryFlowAdapter";
import { getCategoryKey, getCategoryLabel } from "../../src/features/resident/requestPresentation";
import { useRequestThread } from "../../src/features/resident/useRequestThread";
import { tokens } from "../../src/theme/tokens";
import { font } from "../../src/theme/typography";

function isFallbackResponse(response: OrdinaryFlowStartResponse): response is { fallback: true; reason?: string; categoryKey?: string } {
  return typeof response === "object" && response !== null && "fallback" in response && response.fallback === true;
}

function getDraftRequestId(categoryKey: string) {
  return `draft-mobile-ordinary-flow-${String(categoryKey || "general").trim().toLowerCase()}`;
}

export default function ResidentRequestFlowScreen() {
  const params = useLocalSearchParams<{ categoryKey?: string; requestId?: string | string[] }>();
  const requestIdParam = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const queryClient = useQueryClient();
  const { services, user } = useSession();

  const [stage, setStage] = useState<OrdinaryFlowStage>(requestIdParam ? "live" : "intake");
  const [selectedCategory, setSelectedCategory] = useState(params.categoryKey || "");
  const [sessionId, setSessionId] = useState("");
  const [createdRequestId, setCreatedRequestId] = useState(requestIdParam || "");
  const [dynamicFallback, setDynamicFallback] = useState(false);
  const [fallbackAnswers, setFallbackAnswers] = useState<Record<string, unknown>>({});
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [questionDraft, setQuestionDraft] = useState(EMPTY_QUESTION_DRAFT);
  const [intake, setIntake] = useState<IntakeDraft>({
    description: "",
    location: "",
    urgency: "medium",
  });
  const [feedback, setFeedback] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["resident", "categories"],
    queryFn: () => services.resident.categories(),
  });

  const configQuery = useQuery({
    queryKey: ["resident", "request-config"],
    queryFn: () => services.resident.requestConfig(),
  });

  const sessionQuery = useQuery({
    queryKey: ["resident", "ordinary-flow", sessionId],
    queryFn: async () => {
      const payload = await services.resident.getOrdinaryFlow(sessionId);
      return payload.session;
    },
    enabled: Boolean(sessionId),
  });

  const detailQuery = useQuery({
    queryKey: ["resident", "request-detail", createdRequestId],
    queryFn: () => services.resident.requestDetail(String(createdRequestId)),
    enabled: Boolean(createdRequestId),
    refetchInterval: stage === "live" ? 10_000 : false,
  });

  const thread = useRequestThread(createdRequestId);

  useEffect(() => {
    if (params.categoryKey) {
      setSelectedCategory(String(params.categoryKey));
    }
  }, [params.categoryKey]);

  useEffect(() => {
    if (!selectedCategory && categoriesQuery.data?.length) {
      setSelectedCategory(getCategoryKey(categoriesQuery.data[0]));
    }
  }, [categoriesQuery.data, selectedCategory]);

  const fallbackQuestions = useMemo(
    () => buildLegacyFallbackQuestions(configQuery.data?.ordinaryQuestions || []),
    [configQuery.data?.ordinaryQuestions],
  );

  const currentQuestion: DynamicFlowQuestion | null = dynamicFallback
    ? fallbackQuestions[fallbackIndex] || null
    : sessionQuery.data?.currentQuestion || null;

  const selectedCategoryMeta = (categoriesQuery.data || []).find(
    (category) => getCategoryKey(category) === selectedCategory,
  );
  const selectedCategoryLabel = selectedCategoryMeta
    ? getCategoryLabel(selectedCategoryMeta)
    : detailQuery.data?.categoryLabel || detailQuery.data?.category || "Service request";

  const threadItems = useMemo(
    () =>
      buildOrdinaryFlowThreadItems({
        categoryLabel: selectedCategoryLabel,
        stage,
        intake,
        session: sessionQuery.data,
        fallbackQuestions,
        fallbackAnswers,
        currentFallbackIndex: fallbackIndex,
        requestId: createdRequestId,
        feedback,
      }),
    [selectedCategoryLabel, stage, intake, sessionQuery.data, fallbackQuestions, fallbackAnswers, fallbackIndex, createdRequestId, feedback],
  );

  const summaryItems = useMemo(
    () =>
      buildSummaryItems({
        intake,
        session: sessionQuery.data,
        fallbackQuestions,
        fallbackAnswers,
      }),
    [intake, sessionQuery.data, fallbackQuestions, fallbackAnswers],
  );

  useEffect(() => {
    setQuestionDraft(EMPTY_QUESTION_DRAFT);
  }, [currentQuestion?.id, currentQuestion?.questionKey]);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await services.resident.startOrdinaryFlow({
        requestId: getDraftRequestId(selectedCategory),
        categoryKey: selectedCategory,
      });
      return response;
    },
    onSuccess: (response) => {
      if (isFallbackResponse(response)) {
        setDynamicFallback(true);
        setSessionId("");
        setFallbackIndex(0);
        setFeedback("This category is using the legacy ordinary flow configuration.");
        setStage("wizard");
        return;
      }

      const session = normalizeSession(response as any);
      setDynamicFallback(false);
      setSessionId(session.sessionId);
      queryClient.setQueryData(["resident", "ordinary-flow", session.sessionId], session);
      setFeedback("");
      setStage(session.isComplete ? "summary" : "wizard");
    },
    onError: (error: any) => {
      setFeedback(String(error?.message || "Failed to start the ordinary flow session"));
    },
  });

  const answerMutation = useMutation({
    mutationFn: async (payload: { questionKey: string; answer: unknown }) => {
      if (dynamicFallback) return null;
      const result = await services.resident.answerOrdinaryFlow(sessionId, {
        ...payload,
        expectedRevision: Number(sessionQuery.data?.stateRevision || 0),
      });
      return result.session;
    },
    onSuccess: (session) => {
      if (!session) return;
      setFeedback("");
      queryClient.setQueryData(["resident", "ordinary-flow", sessionId], session);
      if (session.isComplete) {
        setStage("summary");
      }
    },
    onError: (error: any) => {
      setFeedback(String(error?.message || "Failed to save answer"));
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || dynamicFallback) return null;
      const result = await services.resident.completeOrdinaryFlow(sessionId);
      return result.session;
    },
    onSuccess: (session) => {
      if (session) {
        queryClient.setQueryData(["resident", "ordinary-flow", sessionId], session);
      }
    },
    onError: (error: any) => {
      setFeedback(String(error?.message || "Failed to complete the ordinary flow"));
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const description = buildRequestDescription({
        categoryLabel: selectedCategoryLabel,
        intake,
        session: sessionQuery.data,
        fallbackQuestions,
        fallbackAnswers,
      });
      const preferredTime = buildPreferredTime({
        session: sessionQuery.data,
        fallbackQuestions,
        fallbackAnswers,
      });

      return services.resident.createRequest({
        category: selectedCategory,
        description,
        urgency: intake.urgency,
        location: intake.location,
        preferredTime,
        ordinaryFlowSessionId: sessionId || undefined,
      });
    },
    onSuccess: (request) => {
      setCreatedRequestId(request.id);
      setStage("live");
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-list"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", request.id] });
    },
    onError: (error: any) => {
      setFeedback(String(error?.message || "Failed to create the request"));
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      services.payments.createSession({
        amount: Number(detailQuery.data?.billedAmount || 0),
        serviceRequestId: String(createdRequestId),
        description: detailQuery.data?.categoryLabel || detailQuery.data?.category || "CityConnect payment",
      }),
    onSuccess: (payload) => {
      setPaymentReference(payload.reference);
      setPaymentFeedback(`Payment session created. Reference ${payload.reference}.`);
    },
    onError: (error: any) => {
      setPaymentFeedback(String(error?.message || "Failed to start payment"));
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: () => services.payments.verify(paymentReference.trim()),
    onSuccess: () => {
      setPaymentFeedback("Verification completed. Request state will refresh from backend.");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", createdRequestId] });
      queryClient.invalidateQueries({ queryKey: ["resident", "request-list"] });
    },
    onError: (error: any) => {
      setPaymentFeedback(String(error?.message || "Verification failed"));
    },
  });

  const declinePaymentMutation = useMutation({
    mutationFn: () => services.requests.declinePayment(String(createdRequestId), "Declined from mobile ordinary flow"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", createdRequestId] });
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: () => services.requests.confirmDelivery(String(createdRequestId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", createdRequestId] });
      queryClient.invalidateQueries({ queryKey: ["resident", "request-list"] });
    },
  });

  const disputeDeliveryMutation = useMutation({
    mutationFn: () => services.requests.disputeDelivery(String(createdRequestId), disputeReason.trim()),
    onSuccess: () => {
      setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", createdRequestId] });
    },
  });

  const cancellationMutation = useMutation({
    mutationFn: () =>
      services.requests.createCancellationCase(String(createdRequestId), {
        reasonCode: "other",
        reasonDetail: cancellationReason.trim(),
        preferredResolution: "refund_if_applicable",
      }),
    onSuccess: () => {
      setCancellationReason("");
      queryClient.invalidateQueries({ queryKey: ["resident", "request-detail", createdRequestId] });
    },
  });

  function handleStartWizard() {
    if (!selectedCategory) {
      setFeedback("Select a category to begin.");
      return;
    }
    if (intake.description.trim().length < 10) {
      setFeedback("Describe the issue in at least 10 characters before continuing.");
      return;
    }
    if (!intake.location.trim()) {
      setFeedback("Add a location before continuing.");
      return;
    }

    if (sessionId || dynamicFallback) {
      setStage("wizard");
      return;
    }

    startSessionMutation.mutate();
  }

  function handleSubmitAnswer(answer: unknown) {
    if (!currentQuestion) return;

    if (dynamicFallback) {
      const nextAnswers = { ...fallbackAnswers, [currentQuestion.questionKey]: answer };
      setFallbackAnswers(nextAnswers);
      const nextIndex = fallbackIndex + 1;
      if (nextIndex >= fallbackQuestions.length) {
        setStage("summary");
      } else {
        setFallbackIndex(nextIndex);
      }
      return;
    }

    answerMutation.mutate({
      questionKey: currentQuestion.questionKey,
      answer,
    });
  }

  async function handleFinalize() {
    if (!dynamicFallback && sessionId && !sessionQuery.data?.isComplete) {
      await completeMutation.mutateAsync();
    }
    createRequestMutation.mutate();
  }

  function handleEditSummary(itemStage: "intake" | "wizard") {
    setStage(itemStage);
  }

  const isBootLoading = categoriesQuery.isLoading || configQuery.isLoading || (stage === "wizard" && startSessionMutation.isPending);
  const isBootError = categoriesQuery.isError || configQuery.isError;

  if (isBootLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="Loading ordinary request flow..." />
      </SafeAreaView>
    );
  }

  if (isBootError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState
          body="The mobile client could not load the resident ordinary flow configuration from the backend."
          action={
            <AppButton
              variant="secondary"
              onPress={() => {
                void categoriesQuery.refetch();
                void configQuery.refetch();
              }}
            >
              Retry
            </AppButton>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={16}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color={tokens.color.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>Ordinary flow</Text>
              <Text style={styles.headerTitle}>{selectedCategoryLabel}</Text>
            </View>
            {createdRequestId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(resident)/request-detail",
                    params: { requestId: createdRequestId },
                  })
                }
                style={styles.detailLink}
              >
                <Text style={styles.detailLinkText}>Open</Text>
              </Pressable>
            ) : (
              <View style={styles.detailLinkPlaceholder} />
            )}
          </View>

          {stage !== "live" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {(categoriesQuery.data || []).map((category) => {
                const key = getCategoryKey(category);
                const selected = key === selectedCategory;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategory(key)}
                    style={[styles.categoryChip, selected ? styles.categoryChipActive : null]}
                  >
                    <Text style={[styles.categoryChipText, selected ? styles.categoryChipTextActive : null]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {stage === "intake" ? (
            <View style={styles.stageStack}>
              <OrdinaryFlowThread items={threadItems} />
              <SectionCard>
                <Text style={styles.sectionTitle}>Start your request</Text>
                <BodyText muted>
                  This captures the same initial context the web ordinary flow needs before the guided automation continues.
                </BodyText>
                <FieldLabel>Issue summary</FieldLabel>
                <InputField
                  multiline
                  placeholder="Describe what needs attention"
                  value={intake.description}
                  onChangeText={(value) => setIntake((current) => ({ ...current, description: value }))}
                />
                <FieldLabel>Location</FieldLabel>
                <InputField
                  placeholder="Estate, street, or landmark"
                  value={intake.location}
                  onChangeText={(value) => setIntake((current) => ({ ...current, location: value }))}
                />
                <FieldLabel>Urgency</FieldLabel>
                <View style={styles.optionRow}>
                  {["low", "medium", "high", "emergency"].map((option) => {
                    const selected = intake.urgency === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setIntake((current) => ({ ...current, urgency: option }))}
                        style={[styles.optionChip, selected ? styles.optionChipActive : null]}
                      >
                        <Text style={[styles.optionChipText, selected ? styles.optionChipTextActive : null]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <AppButton onPress={handleStartWizard} disabled={startSessionMutation.isPending}>
                  {startSessionMutation.isPending ? "Starting flow..." : "Continue to guided flow"}
                </AppButton>
              </SectionCard>
            </View>
          ) : null}

          {stage === "wizard" ? (
            <View style={styles.stageStack}>
              <OrdinaryFlowThread items={threadItems} />
              {currentQuestion ? (
                <OrdinaryFlowQuestionCard
                  question={currentQuestion}
                  draft={questionDraft}
                  onChangeDraft={setQuestionDraft}
                  onSubmitAnswer={handleSubmitAnswer}
                  submitting={answerMutation.isPending}
                />
              ) : (
                <SectionCard>
                  <Text style={styles.sectionTitle}>Review ready</Text>
                  <BodyText muted>
                    The guided questions are complete. Continue to the summary screen to review the full request before creation.
                  </BodyText>
                  <AppButton onPress={() => setStage("summary")}>Continue to summary</AppButton>
                </SectionCard>
              )}
            </View>
          ) : null}

          {stage === "summary" ? (
            <OrdinaryFlowSummary
              items={summaryItems}
              onEditItem={(item) => handleEditSummary(item.stage)}
              onBack={() => setStage("wizard")}
              onFinalize={handleFinalize}
              finalizing={completeMutation.isPending || createRequestMutation.isPending}
            />
          ) : null}

          {stage === "live" ? (
            detailQuery.isLoading ? (
              <LoadingState label="Loading live request thread..." />
            ) : detailQuery.isError || !detailQuery.data ? (
              <ErrorState
                body="The live request could not be loaded from the backend."
                action={
                  <AppButton variant="secondary" onPress={() => void detailQuery.refetch()}>
                    Retry
                  </AppButton>
                }
              />
            ) : (
              <OrdinaryFlowLiveStage
                request={detailQuery.data}
                user={user}
                thread={thread}
                paymentReference={paymentReference}
                onChangePaymentReference={setPaymentReference}
                paymentFeedback={paymentFeedback}
                onStartPayment={() => createPaymentMutation.mutate()}
                startingPayment={createPaymentMutation.isPending}
                onVerifyPayment={() => verifyPaymentMutation.mutate()}
                verifyingPayment={verifyPaymentMutation.isPending}
                onDeclinePayment={() => declinePaymentMutation.mutate()}
                decliningPayment={declinePaymentMutation.isPending}
                disputeReason={disputeReason}
                onChangeDisputeReason={setDisputeReason}
                onConfirmDelivery={() => confirmDeliveryMutation.mutate()}
                confirmingDelivery={confirmDeliveryMutation.isPending}
                onDisputeDelivery={() => disputeDeliveryMutation.mutate()}
                disputingDelivery={disputeDeliveryMutation.isPending}
                cancellationReason={cancellationReason}
                onChangeCancellationReason={setCancellationReason}
                onRequestCancellation={() => cancellationMutation.mutate()}
                requestingCancellation={cancellationMutation.isPending}
              />
            )
          ) : null}

          {feedback && stage !== "live" ? (
            <SectionCard>
              <BodyText muted>{feedback}</BodyText>
            </SectionCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F2F2",
  },
  keyboardArea: {
    flex: 1,
  },
  header: {
    backgroundColor: "#F2F2F2",
    gap: 12,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 12,
    paddingTop: tokens.spacing.sm,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    ...font("400"),
    color: tokens.color.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  headerTitle: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 20,
    lineHeight: 24,
  },
  detailLink: {
    alignItems: "center",
    backgroundColor: tokens.color.primarySoft,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 14,
  },
  detailLinkText: {
    ...font("500"),
    color: tokens.color.primary,
    fontSize: 13,
  },
  detailLinkPlaceholder: {
    width: 56,
  },
  categoryRow: {
    gap: 8,
    paddingRight: 20,
  },
  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: tokens.color.primary,
  },
  categoryChipText: {
    ...font("400"),
    color: tokens.color.text,
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 8,
  },
  stageStack: {
    gap: 12,
  },
  sectionTitle: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 18,
    lineHeight: 23,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: tokens.color.primary,
  },
  optionChipText: {
    ...font("400"),
    color: tokens.color.text,
    fontSize: 14,
    textTransform: "capitalize",
  },
  optionChipTextActive: {
    color: "#FFFFFF",
  },
});
