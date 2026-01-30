import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Paperclip,
  Send,
  Calendar,
  Trash2,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

export default function ProviderTasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const providerId = user?.id;
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Load tasks from localStorage
  useEffect(() => {
    console.log("Provider Tasks loaded - Provider ID:", providerId);
    const savedTasks = localStorage.getItem("company-tasks");
    if (savedTasks) {
      try {
        const tasks = JSON.parse(savedTasks);
        console.log("All tasks from localStorage:", tasks);
        setAllTasks(tasks);
        // Filter tasks assigned to this provider
        if (providerId) {
          const myTasks = tasks.filter((t: Task) => t.assigneeId === providerId);
          console.log("Tasks assigned to this provider:", myTasks);
          setAssignedTasks(myTasks);
        } else {
          console.warn("Provider ID not found - cannot filter tasks");
        }
      } catch (e) {
        console.error("Failed to load tasks:", e);
      }
    } else {
      console.warn("No tasks found in localStorage");
    }
  }, [providerId]);

  const handleUpdateTask = (taskId: string, newStatus: string) => {
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus as any } : t
      )
    );
    const updated = assignedTasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus as any } : t
    );
    setAssignedTasks(updated);
    localStorage.setItem("company-tasks", JSON.stringify(allTasks));
  };

  const handleAddUpdate = () => {
    if (!selectedTask || !updateMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter an update message",
        variant: "destructive",
      });
      return;
    }

    const newUpdate: TaskUpdate = {
      id: crypto.randomUUID(),
      taskId: selectedTask.id,
      userId: providerId || "",
      message: updateMessage,
      attachments: attachmentFile ? [attachmentFile.name] : [],
      createdAt: new Date().toISOString(),
    };

    const updatedTask: Task = {
      ...selectedTask,
      updates: [...(selectedTask.updates || []), newUpdate],
    };

    setAllTasks((prev) =>
      prev.map((t) => (t.id === selectedTask.id ? updatedTask : t))
    );
    setAssignedTasks((prev) =>
      prev.map((t) => (t.id === selectedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);

    localStorage.setItem("company-tasks", JSON.stringify(allTasks));

    setUpdateMessage("");
    setAttachmentFile(null);

    toast({
      title: "Success",
      description: "Update sent successfully",
    });
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

    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: status as any } : t
      )
    );

    const updated = assignedTasks.map((t) =>
      t.id === taskId ? { ...t, status: status as any } : t
    );
    setAssignedTasks(updated);
    localStorage.setItem("company-tasks", JSON.stringify(allTasks));
  };

  const openTasks = assignedTasks.filter((t) => t.status === "open");
  const inProgressTasks = assignedTasks.filter((t) => t.status === "in_progress");
  const completedTasks = assignedTasks.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/provider">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">My Tasks</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </nav>

      <main className="h-[calc(100vh-64px)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">My Task Board</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your assigned tasks and update their progress
          </p>
        </div>

        {/* Kanban Board */}
        {assignedTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No tasks assigned
              </h3>
              <p className="text-slate-600">
                You don't have any tasks assigned yet. Check back later!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-6">
            <div className="flex gap-6 min-w-max">
              {/* TO DO Column */}
              <ProviderKanbanColumn
                title="TO DO"
                count={openTasks.length}
                color="from-slate-100 to-slate-50"
                badgeColor="bg-slate-100 text-slate-700"
                tasks={openTasks}
                getPriorityColor={getPriorityColor}
                onTaskSelect={(task) => {
                  setSelectedTask(task);
                  setShowDialog(true);
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />

              {/* IN PROGRESS Column */}
              <ProviderKanbanColumn
                title="IN PROGRESS"
                count={inProgressTasks.length}
                color="from-blue-100 to-blue-50"
                badgeColor="bg-blue-100 text-blue-700"
                tasks={inProgressTasks}
                getPriorityColor={getPriorityColor}
                onTaskSelect={(task) => {
                  setSelectedTask(task);
                  setShowDialog(true);
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />

              {/* COMPLETE Column */}
              <ProviderKanbanColumn
                title="COMPLETE"
                count={completedTasks.length}
                color="from-green-100 to-green-50"
                badgeColor="bg-green-100 text-green-700"
                tasks={completedTasks}
                getPriorityColor={getPriorityColor}
                onTaskSelect={(task) => {
                  setSelectedTask(task);
                  setShowDialog(true);
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            </div>
          </div>
        )}
      </main>

      {/* Task Details Dialog */}
      {selectedTask && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTask.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Task Details */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Task Details</h3>
                {selectedTask.description && (
                  <p className="text-slate-700 mb-4">{selectedTask.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={getPriorityColor(selectedTask.priority)}>
                    {selectedTask.priority.charAt(0).toUpperCase() +
                      selectedTask.priority.slice(1)}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(selectedTask.status)}>
                    {selectedTask.status.replace("_", " ").charAt(0).toUpperCase() +
                      selectedTask.status.slice(1).replace("_", " ")}
                  </Badge>
                  {selectedTask.dueDate && (
                    <Badge variant="outline">
                      Due: {new Date(selectedTask.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>

                {selectedTask.status !== "completed" && (
                  <div className="flex gap-2">
                    {selectedTask.status === "open" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateTask(selectedTask.id, "in_progress")}
                      >
                        Start Task
                      </Button>
                    )}
                    {selectedTask.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateTask(selectedTask.id, "completed")}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Updates Timeline */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Updates & Messages ({selectedTask.updates?.length || 0})
                </h3>

                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                  {selectedTask.updates && selectedTask.updates.length > 0 ? (
                    selectedTask.updates.map((update) => (
                      <div key={update.id} className="bg-slate-50 rounded-lg p-4">
                        <p className="text-slate-900">{update.message}</p>
                        {update.attachments && update.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {update.attachments.map((file, idx) => (
                              <Badge key={idx} variant="secondary">
                                <Paperclip className="h-3 w-3 mr-1" />
                                {file}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(update.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No updates yet</p>
                  )}
                </div>

                {selectedTask.status !== "completed" && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add an update..."
                      value={updateMessage}
                      onChange={(e) => setUpdateMessage(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Paperclip className="h-4 w-4 text-slate-600" />
                        <span className="text-sm text-slate-600">
                          {attachmentFile ? attachmentFile.name : "Add attachment"}
                        </span>
                        <Input
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            setAttachmentFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                      <Button
                        size="sm"
                        onClick={handleAddUpdate}
                        disabled={!updateMessage.trim()}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Update
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TaskCardProvider({
  task,
  onSelect,
  onStatusChange,
  getPriorityColor,
  getStatusBadgeVariant,
}: {
  task: Task;
  onSelect: () => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  getPriorityColor: (priority: string) => string;
  getStatusBadgeVariant: (status: string) => string;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onSelect}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
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
              {task.updates && task.updates.length > 0 && (
                <Badge variant="secondary">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {task.updates.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {task.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, "in_progress");
                }}
              >
                Start
              </Button>
            )}
            {task.status === "in_progress" && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, "completed");
                }}
              >
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderKanbanColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  getPriorityColor,
  onTaskSelect,
  onDragOver,
  onDrop,
}: {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  tasks: Task[];
  getPriorityColor: (priority: string) => string;
  onTaskSelect: (task: Task) => void;
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
            <ProviderKanbanCard
              key={task.id}
              task={task}
              onSelect={onTaskSelect}
              getPriorityColor={getPriorityColor}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProviderKanbanCard({
  task,
  onSelect,
  getPriorityColor,
}: {
  task: Task;
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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.setData("taskData", JSON.stringify(task));
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(task)}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-move group active:opacity-50 select-none"
    >
      {/* Card Header */}
      <h3 className="font-semibold text-slate-900 text-sm flex-1 line-clamp-2 mb-2 pointer-events-none">
        {task.title}
      </h3>

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

      {/* Footer with Date, Updates, and Open Button */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-1">
          {/* Due Date */}
          {task.dueDate ? (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          ) : (
            <span className="text-xs text-slate-400">No due date</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Update Count */}
          {task.updates && task.updates.length > 0 && (
            <p className="text-xs text-blue-600 font-medium">
              {task.updates.length} {task.updates.length === 1 ? "update" : "updates"}
            </p>
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
    </div>
  );
}
