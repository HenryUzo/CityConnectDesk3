import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  User,
  MessageSquare,
} from "lucide-react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";

type CompanyStaff = {
  id: string;
  name?: string | null;
  email?: string | null;
};

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
  serviceRequestId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignee?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  creator?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  updates?: TaskUpdate[];
};

const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const statusColumns: Array<{ key: Task["status"]; label: string; color: string; badgeColor: string }> = [
  { key: "open", label: "TO DO", color: "from-slate-100 to-slate-50", badgeColor: "bg-slate-100 text-slate-700" },
  { key: "in_progress", label: "IN PROGRESS", color: "from-blue-100 to-blue-50", badgeColor: "bg-blue-100 text-blue-700" },
  { key: "completed", label: "COMPLETE", color: "from-green-100 to-green-50", badgeColor: "bg-green-100 text-green-700" },
  { key: "cancelled", label: "CANCELLED", color: "from-rose-100 to-rose-50", badgeColor: "bg-rose-100 text-rose-700" },
];

export default function CompanyTasks() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [note, setNote] = useState("");

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      priority: "medium",
      dueDate: "",
    },
  });

  const {
    data: staff = [],
    isLoading: isLoadingStaff,
  } = useQuery<CompanyStaff[]>({
    queryKey: ["/api/company/staff"],
  });

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery<Task[]>({
    queryKey: ["/api/company/tasks"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: TaskFormData) => {
      const res = await apiRequest("POST", "/api/company/tasks", {
        title: payload.title,
        description: payload.description || null,
        assigneeId: payload.assigneeId || null,
        priority: payload.priority,
        dueDate: payload.dueDate || null,
      });
      return (await res.json()) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
      taskForm.reset();
      setShowCreateDialog(false);
      toast({ title: "Task assigned", description: "The task has been saved to the server." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to assign task", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: Task["status"] }) => {
      const res = await apiRequest("PATCH", `/api/company/tasks/${taskId}`, { status });
      return (await res.json()) as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/company/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
      toast({ title: "Task deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async ({ taskId, message }: { taskId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/company/tasks/${taskId}/updates`, { message });
      return await res.json();
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
      toast({ title: "Update posted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to post update", description: error.message, variant: "destructive" });
    },
  });

  const groupedTasks = useMemo(() => {
    return statusColumns.reduce<Record<Task["status"], Task[]>>((acc, column) => {
      acc[column.key] = tasks.filter((task) => task.status === column.key);
      return acc;
    }, { open: [], in_progress: [], completed: [], cancelled: [] });
  }, [tasks]);

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleDrop = (taskId: string, status: Task["status"]) => {
    updateTaskMutation.mutate({ taskId, status });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/company-dashboard">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-lg font-semibold">Tasks & Assignments</span>
          <div className="w-10" />
        </div>
      </nav>

      <main className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
            <p className="mt-1 text-sm text-slate-500">Server-backed workflow for company-assigned provider tasks.</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-5 w-5" />
            Add Task
          </Button>
        </div>

        {tasksError ? (
          <div className="p-6">
            <InlineErrorState
              title="Unable to load tasks"
              description={tasksError instanceof Error ? tasksError.message : "Something went wrong loading tasks."}
            />
          </div>
        ) : isLoadingTasks ? (
          <div className="p-6">
            <PageSkeleton withHeader={false} rows={3} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tasks yet"
              description="Create your first task to assign work to a provider in your company."
              action={<Button onClick={() => setShowCreateDialog(true)}>Create task</Button>}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-6">
            <div className="flex min-w-max gap-6">
              {statusColumns.map((column) => (
                <KanbanColumn
                  key={column.key}
                  title={column.label}
                  count={groupedTasks[column.key].length}
                  color={column.color}
                  badgeColor={column.badgeColor}
                  tasks={groupedTasks[column.key]}
                  onDelete={(task) => setTaskToDelete(task)}
                  onSelect={setSelectedTask}
                  onDropStatus={handleDrop}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign New Task</DialogTitle>
          </DialogHeader>
          <Form {...taskForm}>
            <form className="space-y-4" onSubmit={taskForm.handleSubmit(onSubmit)}>
              <FormField
                control={taskForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task title</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Task details" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={taskForm.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to provider</FormLabel>
                      <Select
                        value={field.value || "unassigned"}
                        onValueChange={(value) => field.onChange(value === "unassigned" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingStaff ? "Loading..." : "Select provider"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {staff.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name || person.email || person.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Due date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? "Saving..." : "Assign task"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                {selectedTask.assignee ? (
                  <Badge variant="outline">Assigned: {selectedTask.assignee.name || selectedTask.assignee.email}</Badge>
                ) : (
                  <Badge variant="outline">Unassigned</Badge>
                )}
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium">Updates</p>
                {selectedTask.updates && selectedTask.updates.length > 0 ? (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
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
                  <Textarea
                    placeholder="Post an internal update"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!note.trim() || addUpdateMutation.isPending}
                      onClick={() => addUpdateMutation.mutate({ taskId: selectedTask.id, message: note.trim() })}
                    >
                      {addUpdateMutation.isPending ? "Posting..." : "Post update"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(taskToDelete)} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task and all updates for it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (taskToDelete) {
                  deleteTaskMutation.mutate(taskToDelete.id);
                }
                setTaskToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  onDelete,
  onSelect,
  onDropStatus,
}: {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  tasks: Task[];
  onDelete: (task: Task) => void;
  onSelect: (task: Task) => void;
  onDropStatus: (taskId: string, status: Task["status"]) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const targetStatus = title === "TO DO"
    ? "open"
    : title === "IN PROGRESS"
      ? "in_progress"
      : title === "COMPLETE"
        ? "completed"
        : "cancelled";

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
          if (taskId) onDropStatus(taskId, targetStatus);
        }}
      >
        {tasks.length === 0 ? (
          <div className="flex min-h-96 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-400">No tasks yet</p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onDelete={onDelete} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  onDelete,
  onSelect,
}: {
  task: Task;
  onDelete: (task: Task) => void;
  onSelect: (task: Task) => void;
}) {
  const priorityClasses =
    task.priority === "high"
      ? "bg-red-100 text-red-700"
      : task.priority === "medium"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-green-100 text-green-700";

  const assigneeLabel = task.assignee?.name || task.assignee?.email || "Unassigned";

  return (
    <Card
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("taskId", task.id);
      }}
      className="group cursor-move border border-slate-200 bg-white transition-shadow hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold text-slate-900">{task.title}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {task.description ? (
          <p className="mb-3 line-clamp-2 text-xs text-slate-600">{task.description}</p>
        ) : null}

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
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{assigneeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {task.dueDate ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : null}
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSelect(task);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              Open
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
