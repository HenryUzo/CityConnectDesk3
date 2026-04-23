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
import { formatDateTime } from "../../src/lib/format";

export default function ResidentProfileScreen() {
  const { user, logout, services } = useSession();

  const profileQuery = useQuery({
    queryKey: ["resident", "profile"],
    queryFn: () => services.resident.profile(),
  });

  if (profileQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading resident profile..." />
      </AppScreen>
    );
  }

  if (profileQuery.isError) {
    return (
      <AppScreen>
        <ErrorState
          body="Resident profile data could not be loaded from `/api/app/profile`."
          action={
            <AppButton variant="secondary" onPress={() => void profileQuery.refetch()}>
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  const profile = profileQuery.data;

  return (
    <AppScreen>
      <Heading>Profile</Heading>
      <SectionCard>
        <Title>Account</Title>
        <KeyValueRow label="Name" value={profile?.name || user?.name || "Not provided"} />
        <KeyValueRow label="First name" value={profile?.firstName || "Not provided"} />
        <KeyValueRow label="Last name" value={profile?.lastName || "Not provided"} />
        <KeyValueRow label="Email" value={profile?.email || user?.email || "Not provided"} />
        <KeyValueRow label="Username" value={profile?.username || user?.username || "Not provided"} />
        <KeyValueRow label="Phone" value={profile?.phone || user?.phone || "Not provided"} />
        <KeyValueRow label="Location" value={profile?.location || user?.location || "Not provided"} />
        <KeyValueRow label="Timezone" value={profile?.timezone || "Not provided"} />
        <KeyValueRow label="Website" value={profile?.website || "Not provided"} />
        <KeyValueRow label="Bio" value={profile?.bio || "Not provided"} />
        <KeyValueRow label="Role" value={profile?.role || user?.role || "resident"} />
        <KeyValueRow label="Last updated" value={formatDateTime(profile?.lastUpdatedAt)} />
      </SectionCard>

      <SectionCard>
        <Title>Resident settings</Title>
        <BodyText muted>
          This screen now loads `/api/app/profile` so resident identity stays aligned with the existing backend profile model. Notification preferences, privacy, and security remain available next through `/api/app/settings*`.
        </BodyText>
      </SectionCard>

      <AppButton variant="danger" onPress={() => logout()}>
        Sign out
      </AppButton>
    </AppScreen>
  );
}
