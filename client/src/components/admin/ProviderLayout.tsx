import type { ReactNode } from "react";
import { ProviderShell } from "@/components/provider/ProviderShell";

type ProviderLayoutProps = {
  children: ReactNode;
  title: string;
};

export function ProviderLayout({ children, title }: ProviderLayoutProps) {
  return <ProviderShell title={title}>{children}</ProviderShell>;
}
