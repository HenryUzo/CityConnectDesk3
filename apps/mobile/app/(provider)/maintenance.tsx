import { AppScreen, BodyText, Heading, SectionCard, Title } from "../../src/components/ui";

export default function ProviderMaintenancePlaceholderScreen() {
  return (
    <AppScreen>
      <Heading>Maintenance</Heading>
      <SectionCard>
        <Title>Backend gap preserved</Title>
        <BodyText muted>
          Resident maintenance flows are already live under `/api/app/maintenance/*`, but provider-facing maintenance schedule endpoints do not exist yet.
        </BodyText>
        <BodyText muted>
          This placeholder is intentional so the mobile app does not invent a parallel provider maintenance model that conflicts with backend reality.
        </BodyText>
      </SectionCard>
    </AppScreen>
  );
}
