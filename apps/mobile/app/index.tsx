import { Redirect } from "expo-router";
import { AppScreen, LoadingState } from "../src/components/ui";
import { useSession } from "../src/features/auth/session";

export default function IndexRoute() {
  const { status, user } = useSession();

  if (status === "loading") {
    return (
      <AppScreen>
        <LoadingState label="Bootstrapping CityConnect mobile..." />
      </AppScreen>
    );
  }

  if (status !== "authenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (String(user?.role || "") === "provider") {
    if (user?.isApproved === false) {
      return <Redirect href="/(auth)/provider-pending" />;
    }
    return <Redirect href="/(provider)" />;
  }

  return <Redirect href="/(resident)" />;
}
