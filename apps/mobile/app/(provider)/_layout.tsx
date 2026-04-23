import { RouteGate } from "../../src/navigation/RouteGate";
import { RoleTabs } from "../../src/navigation/roleTabs";

export default function ProviderLayout() {
  return (
    <RouteGate requireRole="provider" requireApprovedProvider>
      <RoleTabs
        tabs={[
          { name: "index", title: "Home", icon: "speedometer-outline" },
          { name: "jobs", title: "Jobs", icon: "briefcase-outline" },
          { name: "tasks", title: "Tasks", icon: "checkmark-done-outline" },
          { name: "maintenance", title: "Maintenance", icon: "build-outline" },
          { name: "notifications", title: "Inbox", icon: "notifications-outline" },
          { name: "profile", title: "Profile", icon: "person-outline" },
          { name: "job-detail", title: "Job detail", icon: "document-text-outline", hidden: true },
        ]}
      />
    </RouteGate>
  );
}
