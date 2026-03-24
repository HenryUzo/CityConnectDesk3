import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MessageSquare, AlertCircle } from "lucide-react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";

type TaskUpdate = {
  id: string;
  taskId: string;
  authorId: string;
  message: string;
  attachments?: string[];
  createdAt?: string;
  author?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  createdBy: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed" | "cancelled";
  dueDate?: string | null;
  createdAt?: string;
  updates?: TaskUpdate[];
  creator?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

const columns: Array<{ key: Task["status"]; label: string; color: string; badgeColor: string }> = [
  { key: "open", label: "TO DO", color: "from-slate-100 to-slate-50", badgeColor: "bg-slate-100 text-slate-700" },
  { key: "in_progress", label: "IN PROGRESS", color: "from-blue-100 to-blue-50", badgeColor: "bg-blue-100 text-blue-700" },
  { key: "completed", label: "COMPLETE", color: "from-green-100 to-green-50", badgeColor: "bg-green-100 text-green-700" },
  { key: "cancelled", label: "CANCELLED", color: "from-rose-100 to-rose-50", badgeColor: "bg-rose-100 text-rose-700" },
];

export default function ProviderTasks() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [note, setNote] = useState("");

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<Task[]>({
    queryKey: ["/api/provider/tasks"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: Task["status"] }) => {
      const res = await apiRequest("PATCH", `/api/provider/tasks/${taskId}`, { status });
      return (await res.json()) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/tasks"] });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Failed to update task", description: mutationError.message, variant: "destructive" });
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/provider/tasks/${taskId}/updates`, { message });
      return await res.json();
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/provider/tasks"] });
      toast({ title: "Update sent" });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Failed to send update", description: mutationError.message, variant: "destructive" });
    },
  });

  const grouped = useMemo(() => {
    return columns.reduce<Record<Task["status"], Task[]>>((acc, column) => {
      acc[column.key] = tasks.filter((task) => task.status === column.key);
      return acc;
    }, { open: [], in_progress: [], completed: [], cancelled: [] });
  }, [tasks]);

  return (
    <ProviderShell
      title="My Tasks"
      subtitle="Track and manage your assigned tasks."
      contentClassName="overflow-hidden"
    >
      <div className="flex h-[calc(100vh-12rem)] min-h-[620px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
        {error ? (
          <div className="p-6">
            <InlineErrorState
              title="Unable to load tasks"
              description={error instanceof Error ? error.message : "Something went wrong loading tasks."}
            />
          </div>
        ) : isLoading ? (
          <div className="p-6">
            <PageSkeleton withHeader={false} rows={3} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="No tasks assigned"
              description="You do not have any assigned tasks right now."
              icon={AlertCircle}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-6">
            <div className="flex min-w-max gap-6">
              {columns.map((column) => (
                <ProviderColumn
                  key={column.key}
                  title={column.label}
                  count={grouped[column.key].length}
                  color={column.color}
                  badgeColor={column.badgeColor}
                  tasks={grouped[column.key]}
                  onDrop={(taskId) => updateStatusMutation.mutate({ taskId, status: column.key })}
                  onSelect={setSelectedTask}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{selectedTask.description || "No description provided."}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedTask.priority}</Badge>
                <Badge variant="secondary">{selectedTask.status.replace("_", " ")}</Badge>
                {selectedTask.creator ? (
                  <Badge variant="outline">Created by: {selectedTask.creator.name || selectedTask.creator.email}</Badge>
                ) : null}
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium">Updates</p>
                {selectedTask.updates && selectedTask.updates.length > 0 ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-2">
                    {selectedTask.updates.map((update) => (
                      <div key={update.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                        <p>{update.message}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {(update.author?.name || update.author?.email || "Team member")} - {update.createdAt ? new Date(update.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No updates yet.</p>
                )}
                <div className="space-y-2">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Share progress update" />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!note.trim() || addUpdateMutation.isPending}
                      onClick={() => addUpdateMutation.mutate({ taskId: selectedTask.id, message: note.trim() })}
                    >
                      {addUpdateMutation.isPending ? "Sending..." : "Send update"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ProviderShell>
  );
}

function ProviderColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  onDrop,
  onSelect,
}: {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  tasks: Task[];
  onDrop: (taskId: string) => void;
  onSelect: (task: Task) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="w-96 flex-shrink-0">
      <div className={`mb-4 rounded-lg border border-slate-200 bg-gradient-to-br ${color} p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <span className={`${badgeColor} rounded-full px-3 py-1 text-sm font-semibold`}>{count}</span>
        </div>
      </div>

      <div
        className={`min-h-96 space-y-3 rounded-lg pb-4 transition-colors ${isDragOver ? "border-2 border-blue-300 bg-blue-50" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          const taskId = event.dataTransfer.getData("taskId");
          if (taskId) onDrop(taskId);
        }}
      >
        {tasks.length === 0 ? (
          <div className="flex min-h-96 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-400">No tasks in this stage</p>
          </div>
        ) : (
          tasks.map((task) => <ProviderTaskCard key={task.id} task={task} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function ProviderTaskCard({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const priorityClasses =
    task.priority === "high"
      ? "bg-red-100 text-red-700"
      : task.priority === "medium"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-green-100 text-green-700";

  return (
    <Card
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("taskId", task.id);
      }}
      className="cursor-move border border-slate-200 bg-white transition-shadow hover:shadow-lg"
      onClick={() => onSelect(task)}
    >
      <CardContent className="p-4">
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900">{task.title}</h3>
        {task.description ? <p className="mb-3 line-clamp-2 text-xs text-slate-600">{task.description}</p> : null}
        <div className="mb-3 flex items-center gap-2">
          <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${priorityClasses}`}>{task.priority}</span>
          {task.updates && task.updates.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              <MessageSquare className="h-3 w-3" />
              {task.updates.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          ) : (
            <span className="text-xs text-slate-400">No due date</span>
          )}
          <button
            className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(task);
            }}
          >
            Open
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
