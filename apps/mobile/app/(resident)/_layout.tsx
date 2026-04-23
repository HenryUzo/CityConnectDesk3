import { RouteGate } from "../../src/navigation/RouteGate";
import { RoleTabs } from "../../src/navigation/roleTabs";

export default function ResidentLayout() {
  return (
    <RouteGate requireRole={["resident", "admin", "super_admin", "estate_admin"]}>
      <RoleTabs
        tabs={[
          { name: "index", title: "Home", icon: "home-outline" },
          { name: "services", title: "Services", icon: "grid-outline" },
          { name: "requests", title: "Activity", icon: "document-text-outline" },
          { name: "profile", title: "Account", icon: "person-circle-outline" },
          { name: "maintenance", title: "Maintenance", icon: "build-outline", hidden: true },
          { name: "notifications", title: "Inbox", icon: "notifications-outline", hidden: true },
          { name: "request-flow", title: "New request", icon: "add-circle-outline", hidden: true },
          { name: "request-detail", title: "Request detail", icon: "document-text-outline", hidden: true },
        ]}
      />
    </RouteGate>
  );
}
