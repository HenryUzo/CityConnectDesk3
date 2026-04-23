import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import {
  AppButton,
  AppScreen,
  BodyText,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
  SectionCard,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { ProviderJobCard } from "../../src/features/provider/ProviderJobCard";
import {
  filterProviderJobs,
  ProviderJobFilter,
} from "../../src/features/provider/providerPresentation";
import { tokens } from "../../src/theme/tokens";

export default function ProviderJobsScreen() {
  const queryClient = useQueryClient();
  const { services } = useSession();
  const [filter, setFilter] = useState<ProviderJobFilter>("all");
  const [acceptingId, setAcceptingId] = useState("");

  const assignedJobsQuery = useQuery({
    queryKey: ["provider", "assigned-jobs"],
    queryFn: () => services.requests.list(),
  });

  const availableJobsQuery = useQuery({
    queryKey: ["provider", "available-jobs"],
    queryFn: () => services.requests.list("available"),
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      setAcceptingId(requestId);
      return services.requests.accept(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", "assigned-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["provider", "available-jobs"] });
    },
    onSettled: () => setAcceptingId(""),
  });

  const assignedJobs = assignedJobsQuery.data || [];
  const availableJobs = availableJobsQuery.data || [];
  const filteredAssignedJobs = filterProviderJobs(assignedJobs, filter);

  if (assignedJobsQuery.isLoading || availableJobsQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading jobs..." />
      </AppScreen>
    );
  }

  if (assignedJobsQuery.isError || availableJobsQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="The provider jobs board could not be loaded from the backend."
          action={
            <AppButton
              variant="secondary"
              onPress={() => {
                void assignedJobsQuery.refetch();
                void availableJobsQuery.refetch();
              }}
            >
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Heading>Jobs</Heading>
      <BodyText muted>
        Available jobs come from `/api/service-requests?status=available`; assigned jobs and status changes use the provider view of the same core request model.
      </BodyText>

      <SectionCard>
        <Title>Filter assigned jobs</Title>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs }}>
          {(["all", "assigned", "in_progress", "review"] as ProviderJobFilter[]).map((item) => (
            <AppButton
              key={item}
              variant={filter === item ? "primary" : "ghost"}
              onPress={() => setFilter(item)}
            >
              {item.replace(/_/g, " ")}
            </AppButton>
          ))}
        </View>
      </SectionCard>

      <SectionCard>
        <Title>Available jobs</Title>
        {availableJobs.map((request) => (
          <ProviderJobCard
            key={request.id}
            request={request}
            action={{
              label: acceptingId === request.id ? "Accepting..." : "Accept job",
              onPress: () => acceptMutation.mutate(request.id),
              disabled: acceptMutation.isPending,
            }}
            onPress={() =>
              router.push({
                pathname: "/(provider)/job-detail",
                params: { requestId: request.id },
              })
            }
          />
        ))}
        {!availableJobs.length ? (
          <EmptyState
            title="No open jobs"
            body="When new work is available for providers, it will appear here."
          />
        ) : null}
      </SectionCard>

      <SectionCard>
        <Title>Assigned jobs</Title>
        {filteredAssignedJobs.map((request) => (
          <ProviderJobCard
            key={request.id}
            request={request}
            onPress={() =>
              router.push({
                pathname: "/(provider)/job-detail",
                params: { requestId: request.id },
              })
            }
          />
        ))}
        {!filteredAssignedJobs.length ? (
          <EmptyState
            title="No assigned jobs"
            body="No provider jobs match the current filter."
          />
        ) : null}
      </SectionCard>
    </AppScreen>
  );
}
