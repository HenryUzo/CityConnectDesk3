import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  AppButton,
  AppScreen,
  BodyText,
  ErrorState,
  Heading,
  LoadingState,
  SectionCard,
  Title,
} from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { ProviderJobCard } from "../../src/features/provider/ProviderJobCard";
import { useProviderDashboard } from "../../src/features/provider/useProviderDashboard";
import { tokens } from "../../src/theme/tokens";

export default function ProviderHomeScreen() {
  const { user } = useSession();
  const { assignedJobsQuery, availableJobsQuery, tasksQuery, companyQuery } = useProviderDashboard();

  if (
    assignedJobsQuery.isLoading ||
    availableJobsQuery.isLoading ||
    tasksQuery.isLoading ||
    companyQuery.isLoading
  ) {
    return (
      <AppScreen>
        <LoadingState label="Loading provider operations..." />
      </AppScreen>
    );
  }

  if (
    assignedJobsQuery.isError ||
    availableJobsQuery.isError ||
    tasksQuery.isError ||
    companyQuery.isError
  ) {
    return (
      <AppScreen>
        <ErrorState
          body="Provider operations could not be loaded from the current backend endpoints."
          action={
            <AppButton
              variant="secondary"
              onPress={() => {
                void assignedJobsQuery.refetch();
                void availableJobsQuery.refetch();
                void tasksQuery.refetch();
                void companyQuery.refetch();
              }}
            >
              Retry
            </AppButton>
          }
        />
      </AppScreen>
    );
  }

  const assignedJobs = assignedJobsQuery.data || [];
  const availableJobs = availableJobsQuery.data || [];
  const tasks = tasksQuery.data || [];
  const company = companyQuery.data;

  return (
    <AppScreen>
      <SectionCard style={styles.hero}>
        <BodyText muted>Provider workspace</BodyText>
        <Heading>{user?.name || "Provider"} operations</Heading>
        <BodyText muted>
          Jobs, consultancy reporting, chat, and task updates stay on the existing provider and core service-request APIs.
        </BodyText>
        <View style={styles.heroActions}>
          <AppButton onPress={() => router.push("/(provider)/jobs")}>Open jobs board</AppButton>
          <AppButton variant="secondary" onPress={() => router.push("/(provider)/tasks")}>
            View tasks
          </AppButton>
        </View>
      </SectionCard>

      <View style={styles.metricRow}>
        <SectionCard style={styles.metricCard}>
          <Text style={styles.metricValue}>{assignedJobs.length}</Text>
          <Text style={styles.metricLabel}>Assigned jobs</Text>
        </SectionCard>
        <SectionCard style={styles.metricCard}>
          <Text style={styles.metricValue}>{availableJobs.length}</Text>
          <Text style={styles.metricLabel}>Available jobs</Text>
        </SectionCard>
        <SectionCard style={styles.metricCard}>
          <Text style={styles.metricValue}>{tasks.length}</Text>
          <Text style={styles.metricLabel}>Tasks</Text>
        </SectionCard>
      </View>

      <SectionCard>
        <Title>Company context</Title>
        {company ? (
          <View style={styles.companyInfo}>
            <BodyText muted>Name: {company.name || "Not provided"}</BodyText>
            <BodyText muted>Location: {company.location || "Not provided"}</BodyText>
            <BodyText muted>Approval: {company.approvalStatus || "Unknown"}</BodyText>
          </View>
        ) : (
          <BodyText muted>
            No provider company profile is currently linked. The operational job flow still works, but company context is limited until `/api/provider/company` returns a record.
          </BodyText>
        )}
      </SectionCard>

      <SectionCard>
        <Title>Operational tasks</Title>
        {tasks.slice(0, 3).map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <View style={styles.taskCopy}>
              <Text style={styles.taskTitle}>{task.title || "Task"}</Text>
              <Text style={styles.taskMeta}>{task.description || "No description provided."}</Text>
            </View>
            <Text style={styles.taskStatus}>{task.status || "open"}</Text>
          </View>
        ))}
        {!tasks.length ? (
          <BodyText muted>No provider tasks are currently assigned.</BodyText>
        ) : null}
      </SectionCard>

      <SectionCard>
        <Title>Needs attention</Title>
        {assignedJobs.slice(0, 2).map((job) => (
          <ProviderJobCard
            key={job.id}
            request={job}
            onPress={() =>
              router.push({
                pathname: "/(provider)/job-detail",
                params: { requestId: job.id },
              })
            }
          />
        ))}
        {!assignedJobs.length ? (
          <BodyText muted>No assigned jobs yet. Available work will appear in the jobs board.</BodyText>
        ) : null}
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: tokens.color.primarySoft,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "500",
    color: tokens.color.providerShell,
  },
  metricLabel: {
    fontSize: 13,
    color: tokens.color.textMuted,
  },
  companyInfo: {
    gap: 6,
  },
  taskRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.color.surfaceMuted,
  },
  taskCopy: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: tokens.color.text,
  },
  taskMeta: {
    fontSize: 12,
    color: tokens.color.textMuted,
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: "500",
    color: tokens.color.providerShell,
    textTransform: "capitalize",
  },
});
