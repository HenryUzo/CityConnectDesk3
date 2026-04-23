import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, AppScreen, BodyText, EmptyState, Heading, LoadingState, SectionCard } from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { formatDateTime } from "../../src/lib/format";
import { tokens } from "../../src/theme/tokens";

export default function ProviderNotificationsScreen() {
  const queryClient = useQueryClient();
  const { services } = useSession();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => services.notifications.list(),
    refetchInterval: 15_000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => services.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (notificationsQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading inbox..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Heading>Notifications</Heading>
      <BodyText muted>
        Provider job, task, and chat notifications reuse the existing `/api/notifications` transport.
      </BodyText>
      <AppButton variant="secondary" onPress={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
        {markAllMutation.isPending ? "Marking..." : "Mark all read"}
      </AppButton>

      {!notificationsQuery.data?.length ? (
        <EmptyState title="No notifications" body="Operational updates from jobs and tasks will appear here." />
      ) : null}

      {(notificationsQuery.data || []).map((item) => (
        <SectionCard key={item.id}>
          <View style={styles.header}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.isRead ? (
              <AppButton
                variant="ghost"
                onPress={() => {
                  void services.notifications.markRead(item.id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["notifications"] });
                  });
                }}
              >
                Read
              </AppButton>
            ) : null}
          </View>
          <Text style={styles.body}>{item.message}</Text>
          <Text style={styles.meta}>{formatDateTime(item.createdAt)}</Text>
        </SectionCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: tokens.color.text,
  },
  body: {
    fontSize: 14,
    color: tokens.color.text,
  },
  meta: {
    fontSize: 12,
    color: tokens.color.textMuted,
  },
});
