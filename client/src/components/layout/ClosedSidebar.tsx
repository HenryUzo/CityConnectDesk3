import Nav, { type LayoutNavProps } from "./Nav";

type ClosedSidebarProps = Omit<LayoutNavProps, "defaultExpanded" | "forceCollapsed">;

export default function ClosedSidebar(props: ClosedSidebarProps) {
  return <Nav {...props} defaultExpanded={false} forceCollapsed />;
}
