import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppButton, AppScreen, BodyText, EmptyState, Heading, LoadingState } from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { ResidentRequestCard } from "../../src/features/resident/ResidentRequestCard";

export default function ResidentRequestsScreen() {
  const { services } = useSession();
  const requestsQuery = useQuery({
    queryKey: ["resident", "request-list"],
    queryFn: () => services.resident.requestList(),
  });

  if (requestsQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading your requests..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Heading>Your requests</Heading>
      <BodyText muted>
        Resident tracking stays on `/api/app/service-requests/*` so mobile follows the same request history and status progression as the web app.
      </BodyText>

      {!requestsQuery.data?.length ? (
        <EmptyState
          title="No requests found"
          body="Create a new request to start the guided resident flow."
          action={<AppButton onPress={() => router.push("/(resident)/request-flow")}>New request</AppButton>}
        />
      ) : null}

      {(requestsQuery.data || []).map((request) => (
        <ResidentRequestCard
          key={request.id}
          request={request}
          onPress={() =>
            router.push({
              pathname: "/(resident)/request-detail",
              params: { requestId: request.id },
            })
          }
        />
      ))}
    </AppScreen>
  );
}
