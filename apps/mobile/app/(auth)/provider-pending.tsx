import { useEffect, useMemo, useState } from "react";
import { Link, Redirect, router, useLocalSearchParams } from "expo-router";
import { AppButton, AppScreen, BodyText, Heading, LoadingState, SectionCard, Title } from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";

export default function ProviderPendingScreen() {
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const { status, user, refreshSession, logout } = useSession();
  const [checkingApproval, setCheckingApproval] = useState(false);

  const isAuthenticatedProvider = status === "authenticated" && String(user?.role || "") === "provider";
  const isApproved = isAuthenticatedProvider && user?.isApproved !== false;
  const email = useMemo(() => String(params.email || user?.email || "").trim(), [params.email, user?.email]);

  useEffect(() => {
    if (!isAuthenticatedProvider || user?.isApproved !== false) {
      return;
    }

    const interval = setInterval(() => {
      void refreshSession().catch(() => undefined);
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticatedProvider, refreshSession, user?.isApproved]);

  async function handleCheckApproval() {
    setCheckingApproval(true);
    try {
      await refreshSession();
    } finally {
      setCheckingApproval(false);
    }
  }

  if (isApproved) {
    return <Redirect href="/(provider)" />;
  }

  if (status === "authenticated" && String(user?.role || "") !== "provider") {
    return <Redirect href="/" />;
  }

  return (
    <AppScreen>
      <SectionCard>
        <BodyText muted>Provider onboarding stays aligned to the current approval workflow</BodyText>
        <Heading>Approval pending</Heading>
        <BodyText muted>
          {isAuthenticatedProvider
            ? "Your provider account exists, but CityConnect admin approval is still pending. We will keep checking for approval."
            : "Your provider request was submitted successfully. Sign in with the credentials you just created after approval is granted."}
        </BodyText>
      </SectionCard>

      <SectionCard>
        <Title>What happens next</Title>
        <BodyText muted>1. Admin reviews your provider request and company linkage.</BodyText>
        <BodyText muted>2. Once approved, provider access opens automatically.</BodyText>
        {email ? <BodyText muted>Provider email: {email}</BodyText> : null}
      </SectionCard>

      {isAuthenticatedProvider ? (
        <SectionCard>
          {checkingApproval ? <LoadingState label="Checking approval..." /> : null}
          <AppButton onPress={handleCheckApproval} disabled={checkingApproval}>
            {checkingApproval ? "Checking..." : "Check approval now"}
          </AppButton>
          <AppButton
            variant="ghost"
            onPress={() => {
              void logout().then(() => router.replace("/(auth)/login"));
            }}
          >
            Sign out
          </AppButton>
        </SectionCard>
      ) : (
        <SectionCard>
          <AppButton onPress={() => router.replace("/(auth)/login")}>Go to sign in</AppButton>
          <BodyText muted>
            Need to edit your application? <Link href="/(auth)/register">Submit another provider request</Link>
          </BodyText>
        </SectionCard>
      )}
    </AppScreen>
  );
}
