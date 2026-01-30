import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Plus, Trash2, CheckCircle, Clock, AlertCircle, Calendar, User } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type CompanyStaff = {
  id: string;
  name?: string;
  email?: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed";
  dueDate?: string;
  createdAt: string;
  updates?: TaskUpdate[];
};

type TaskUpdate = {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  attachments?: string[];
  createdAt: string;
};

const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Assignee is required"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

export default function CompanyTasks() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const { data: staff = [] } = useQuery<CompanyStaff[]>({
    queryKey: ["/api/company/staff"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/staff");
      if (!res.ok) {
        console.error("Failed to fetch company staff:", res.status);
        return [];
      }
      const data = await res.json();
      console.log("Company staff loaded:", data);
      return data;
    },
  });

  // Load tasks from localStorage
  useEffect(() => {
    const savedTasks = localStorage.getItem("company-tasks");
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error("Failed to load tasks:", e);
      }
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem("company-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const getAssigneeName = (id: string) => {
    const person = staff.find((s) => s.id === id);
    return person?.name || person?.email || "Unknown";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "open":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "open":
        return "outline";
      default:
        return "outline";
    }
  };

  const onSubmit = (data: TaskFormData) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      priority: data.priority,
      status: "open",
      dueDate: data.dueDate,
      createdAt: new Date().toISOString(),
      updates: [],
    };
    setTasks((prev) => [newTask, ...prev]);
    taskForm.reset();
    setShowDialog(false);
    toast({
      title: "Success",
      description: "Task assigned successfully",
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm("Delete this task?")) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({
        title: "Success",
        description: "Task deleted",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData("taskId");
    
    if (!taskId) {
      console.warn("No taskId in drop event");
      return;
    }

    // Map column title to status
    const statusMap: { [key: string]: string } = {
      "to_do": "open",
      "in_progress": "in_progress",
      "complete": "completed",
    };

    const status = statusMap[newStatus] || newStatus;
    console.log("Dropping task", taskId, "to status", status, "from column", newStatus);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: status as any } : t
      )
    );
  };

  const openTasks = tasks.filter((t) => t.status === "open");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/company-dashboard">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">Tasks & Assignments</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </nav>

      <main className="h-[calc(100vh-64px)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
            <p className="text-sm text-slate-500 mt-1">
              Drag tasks between columns or click to manage
            </p>
          </div>
          <Button onClick={() => setShowDialog(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-5 h-5 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-6 min-w-max">
            {/* TO DO Column */}
            <KanbanColumn
              title="TO DO"
              count={openTasks.length}
              color="from-slate-100 to-slate-50"
              badgeColor="bg-slate-100 text-slate-700"
              tasks={openTasks}
              getAssigneeName={getAssigneeName}
              getPriorityColor={getPriorityColor}
              onDelete={handleDeleteTask}
              onSelect={setSelectedTask}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />

            {/* IN PROGRESS Column */}
            <KanbanColumn
              title="IN PROGRESS"
              count={inProgressTasks.length}
              color="from-blue-100 to-blue-50"
              badgeColor="bg-blue-100 text-blue-700"
              tasks={inProgressTasks}
              getAssigneeName={getAssigneeName}
              getPriorityColor={getPriorityColor}
              onDelete={handleDeleteTask}
              onSelect={setSelectedTask}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />

            {/* COMPLETE Column */}
            <KanbanColumn
              title="COMPLETE"
              count={completedTasks.length}
              color="from-green-100 to-green-50"
              badgeColor="bg-green-100 text-green-700"
              tasks={completedTasks}
              getAssigneeName={getAssigneeName}
              getPriorityColor={getPriorityColor}
              onDelete={handleDeleteTask}
              onSelect={setSelectedTask}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </main>

      {/* Create Task Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
                    <FormLabel>Task Title</FormLabel>
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
              <FormField
                control={taskForm.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name || person.email || person.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Assign Task</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  getAssigneeName,
  getPriorityColor,
  onDelete,
  onSelect,
  onDragOver,
  onDrop,
}: {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  tasks: Task[];
  getAssigneeName: (id: string) => string;
  getPriorityColor: (priority: string) => string;
  onDelete: (id: string) => void;
  onSelect: (task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    onDragOver(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDrop(e, title.toLowerCase().replace(/ /g, "_"));
  };

  return (
    <div className="flex-shrink-0 w-96">
      {/* Column Header */}
      <div className={`bg-gradient-to-br ${color} rounded-lg p-4 mb-4 border border-slate-200`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <span className={`${badgeColor} px-3 py-1 rounded-full text-sm font-semibold`}>
            {count}
          </span>
        </div>
      </div>

      {/* Tasks Container */}
      <div 
        className={`space-y-3 min-h-96 pb-4 rounded-lg transition-colors ${
          isDragOver ? "bg-blue-50 border-2 border-blue-300" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center min-h-96 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No tasks - Drag here to move tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              assigneeName={getAssigneeName(task.assigneeId)}
              onDelete={onDelete}
              onSelect={onSelect}
              getPriorityColor={getPriorityColor}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  assigneeName,
  onDelete,
  onSelect,
  getPriorityColor,
}: {
  task: Task;
  assigneeName: string;
  onDelete: (id: string) => void;
  onSelect: (task: Task) => void;
  getPriorityColor: (priority: string) => string;
}) {
  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.setData("taskData", JSON.stringify(task));
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-move group active:opacity-50 select-none"
    >
      {/* Card Header with Delete */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900 text-sm flex-1 pr-2 line-clamp-2 pointer-events-none">
          {task.title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(task.id)}
          className="text-slate-400 hover:text-red-500 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-slate-600 mb-3 line-clamp-2 pointer-events-none">{task.description}</p>
      )}

      {/* Priority Badge */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityBg(task.priority)}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Footer with Assignee and Due Date */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        {/* Assignee Avatar */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {getInitials(assigneeName)}
          </div>
          <span className="text-xs text-slate-600 truncate max-w-[120px]">{assigneeName}</span>
        </div>

        {/* Due Date and Open Button */}
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          )}
          
          {/* Open Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
            className="ml-2 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            Open →
          </button>
        </div>
      </div>

      {/* Update Count */}
      {task.updates && task.updates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-blue-600 font-medium">
            {task.updates.length} {task.updates.length === 1 ? "update" : "updates"}
          </p>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  assigneeName,
  onDelete,
  getPriorityColor,
  getStatusBadgeVariant,
}: {
  task: Task;
  assigneeName: string;
  onDelete: (id: string) => void;
  getPriorityColor: (priority: string) => string;
  getStatusBadgeVariant: (status: string) => string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-slate-600 mt-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge variant="outline">{assigneeName}</Badge>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Badge>
              <Badge variant={getStatusBadgeVariant(task.status)}>
                {task.status.replace("_", " ").charAt(0).toUpperCase() +
                  task.status.slice(1).replace("_", " ")}
              </Badge>
              {task.dueDate && (
                <Badge variant="outline">
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
            {task.updates && task.updates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Updates ({task.updates.length})
                </p>
                <div className="space-y-2">
                  {task.updates.slice(0, 2).map((update) => (
                    <div key={update.id} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      <p>{update.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(update.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {task.updates.length > 2 && (
                    <p className="text-xs text-slate-500 italic">
                      +{task.updates.length - 2} more updates
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(task.id)}
            className="text-rose-500 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
