import { useQuery } from "@tanstack/react-query";
import {
  AppButton,
  AppScreen,
  BodyText,
  ErrorState,
  Heading,
  KeyValueRow,
  LoadingState,
  SectionCard,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";

export default function ProviderProfileScreen() {
  const { user, logout, services } = useSession();

  const companyQuery = useQuery({
    queryKey: ["provider", "company"],
    queryFn: () => services.provider.company(),
  });

  if (companyQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading provider profile..." />
      </AppScreen>
    );
  }

  if (companyQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="Provider company context could not be loaded from `/api/provider/company`."
          action={
            <AppButton variant="secondary" onPress={() => void companyQuery.refetch()}>
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  const company = companyQuery.data;

  return (
    <AppScreen>
      <Heading>Profile</Heading>
      <SectionCard>
        <Title>Account</Title>
        <KeyValueRow label="Name" value={user?.name || "Not provided"} />
        <KeyValueRow label="Email" value={user?.email || "Not provided"} />
        <KeyValueRow label="Username" value={user?.username || "Not provided"} />
        <KeyValueRow label="Phone" value={user?.phone || "Not provided"} />
        <KeyValueRow label="Role" value={user?.role || "provider"} />
        <KeyValueRow label="Category" value={user?.serviceCategory || "Not provided"} />
      </SectionCard>

      <SectionCard>
        <Title>Company</Title>
        <KeyValueRow label="Name" value={company?.name || user?.company || "Not linked"} />
        <KeyValueRow label="Description" value={company?.description || "Not provided"} />
        <KeyValueRow label="Location" value={company?.location || "Not provided"} />
        <KeyValueRow label="Phone" value={company?.phone || "Not provided"} />
        <KeyValueRow label="Email" value={company?.email || "Not provided"} />
        <KeyValueRow label="Approval" value={company?.approvalStatus || "Unknown"} />
      </SectionCard>

      <SectionCard>
        <Title>Implementation note</Title>
        <BodyText muted>
          Provider mobile v1 stays focused on operational jobs, chat, and company tasks. Marketplace, inventory, and company-admin surfaces remain intentionally excluded even though backend routes exist.
        </BodyText>
      </SectionCard>

      <AppButton variant="danger" onPress={() => logout()}>
        Sign out
      </AppButton>
    </AppScreen>
  );
}
