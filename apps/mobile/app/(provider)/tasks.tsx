import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, AppScreen, BodyText, Heading, InputField, LoadingState, SectionCard, Title } from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { formatDateTime } from "../../src/lib/format";
import { tokens } from "../../src/theme/tokens";

export default function ProviderTasksScreen() {
  const queryClient = useQueryClient();
  const { services } = useSession();
  const [noteTaskId, setNoteTaskId] = useState("");
  const [noteText, setNoteText] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["provider", "tasks"],
    queryFn: () => services.provider.tasks(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      services.provider.updateTaskStatus(taskId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider", "tasks"] }),
  });

  const noteMutation = useMutation({
    mutationFn: () => services.provider.addTaskUpdate(noteTaskId, { message: noteText.trim() }),
    onSuccess: () => {
      setNoteText("");
      setNoteTaskId("");
      queryClient.invalidateQueries({ queryKey: ["provider", "tasks"] });
    },
  });

  if (tasksQuery.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading provider tasks..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Heading>Company tasks</Heading>
      <BodyText muted>
        These tasks come from `/api/provider/tasks` and stay distinct from the core service request workflow.
      </BodyText>

      {(tasksQuery.data || []).map((task) => (
        <SectionCard key={task.id}>
          <Title>{task.title || "Task"}</Title>
          <Text style={styles.body}>{task.description || "No description."}</Text>
          <Text style={styles.meta}>Status: {task.status || "open"}</Text>
          <Text style={styles.meta}>Created: {formatDateTime(task.createdAt)}</Text>
          <View style={styles.inline}>
            <AppButton variant="secondary" onPress={() => statusMutation.mutate({ taskId: task.id, status: "in_progress" })}>
              In progress
            </AppButton>
            <AppButton variant="secondary" onPress={() => statusMutation.mutate({ taskId: task.id, status: "completed" })}>
              Complete
            </AppButton>
          </View>
          <AppButton variant={noteTaskId === task.id ? "primary" : "ghost"} onPress={() => setNoteTaskId(task.id)}>
            Add note here
          </AppButton>
          {(task.updates || []).map((update) => (
            <View key={update.id} style={styles.update}>
              <Text style={styles.body}>{update.message || "Update"}</Text>
              <Text style={styles.meta}>{formatDateTime(update.createdAt)}</Text>
            </View>
          ))}
        </SectionCard>
      ))}

      {noteTaskId ? (
        <SectionCard>
          <Title>Task update</Title>
          <InputField multiline placeholder="Progress note" value={noteText} onChangeText={setNoteText} />
          <AppButton onPress={() => noteMutation.mutate()} disabled={noteMutation.isPending || !noteText.trim()}>
            {noteMutation.isPending ? "Saving..." : "Save update"}
          </AppButton>
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  body: {
    fontSize: 14,
    color: tokens.color.text,
  },
  meta: {
    fontSize: 12,
    color: tokens.color.textMuted,
  },
  update: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    gap: 4,
    backgroundColor: tokens.color.surfaceMuted,
  },
});
