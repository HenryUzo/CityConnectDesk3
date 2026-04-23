import { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "../features/auth/session";
import { queryClient } from "../query/client";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
