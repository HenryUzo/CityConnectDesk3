# Kanban Board Developer Guide

## Overview for Developers

This guide provides technical details for developers working with the Kanban board implementation.

## Component Architecture

### File Structure
```
client/src/pages/
├── provider-tasks.tsx        # Provider/Artisan task board
├── company-tasks.tsx         # Company admin task board
└── ... (other pages)

server/
├── routes.ts                 # API endpoints for tasks
└── ... (other server files)
```

## Provider Tasks Component (`provider-tasks.tsx`)

### Main Component
```typescript
export default function ProviderTasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  // Get assigned tasks
  const { data: assignedTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/provider/tasks"],
    queryFn: async () => apiRequest("GET", "/api/provider/tasks"),
  });
  
  // Organize by status
  const openTasks = assignedTasks.filter(t => t.status === "open");
  const inProgressTasks = assignedTasks.filter(t => t.status === "in_progress");
  const completedTasks = assignedTasks.filter(t => t.status === "completed");
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation, Header, Kanban Board, Dialog... */}
    </div>
  );
}
```

### Sub-Component: ProviderKanbanColumn
```typescript
function ProviderKanbanColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  getPriorityColor,
  onTaskSelect,
}: {
  title: string;                          // "TO DO", "IN PROGRESS", etc.
  count: number;                          // Number of tasks in column
  color: string;                          // Gradient background color
  badgeColor: string;                     // Badge background color
  tasks: Task[];                          // Array of tasks to display
  getPriorityColor: (priority: string) => string;  // Function to get priority colors
  onTaskSelect: (task: Task) => void;     // Callback when task selected
}) {
  return (
    <div className="flex-shrink-0 w-96">
      {/* Column header with title and count */}
      <div className={`bg-gradient-to-br ${color} rounded-lg p-4 mb-4 border border-slate-200`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <span className={`${badgeColor} px-3 py-1 rounded-full text-sm font-semibold`}>
            {count}
          </span>
        </div>
      </div>

      {/* Task cards or empty state */}
      <div className="space-y-3 min-h-96 pb-4">
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center min-h-96 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No tasks</p>
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
```

### Sub-Component: ProviderKanbanCard
```typescript
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
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return colors[priority] || "bg-gray-100 text-gray-700";
  };

  return (
    <div
      onClick={() => onSelect(task)}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-pointer group"
    >
      {/* Title */}
      <h3 className="font-semibold text-slate-900 text-sm flex-1 line-clamp-2 mb-2">
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Priority Badge */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityBg(task.priority)}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        {task.dueDate ? (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No due date</span>
        )}

        {task.updates && task.updates.length > 0 && (
          <p className="text-xs text-blue-600 font-medium">
            {task.updates.length} {task.updates.length === 1 ? "update" : "updates"}
          </p>
        )}
      </div>
    </div>
  );
}
```

## Company Tasks Component (`company-tasks.tsx`)

### Main Component Structure
```typescript
export default function CompanyTasks() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Form handling with React Hook Form + Zod
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

  // Get staff for assignee dropdown
  const { data: staff = [] } = useQuery<CompanyStaff[]>({
    queryKey: ["/api/company/staff"],
    queryFn: async () => apiRequest("GET", "/api/company/staff"),
  });

  // Get company tasks
  const { data: fetchedTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/company/tasks"],
    queryFn: async () => apiRequest("GET", "/api/company/tasks"),
  });

  // Task submission handler
  const onSubmit = async (data: TaskFormData) => {
    try {
      await apiRequest("POST", "/api/tasks", data);
      toast({ title: "Task created successfully" });
      taskForm.reset();
      setShowDialog(false);
      // Refetch tasks
      queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
    } catch (error) {
      toast({ title: "Error creating task", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation */}
      <nav>{/* ... */}</nav>

      {/* Header with Add Task button */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
          <p className="text-sm text-slate-500 mt-1">Drag tasks between columns or click to manage</p>
        </div>
        <Button onClick={() => setShowDialog(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board with three columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 min-w-max">
          <KanbanColumn
            title="TO DO"
            count={openTasks.length}
            color="from-slate-100 to-slate-50"
            badgeColor="bg-slate-100 text-slate-700"
            tasks={openTasks}
            getAssigneeName={getAssigneeName}
            getPriorityColor={getPriorityColor}
            onDelete={handleDeleteTask}
          />
          {/* More columns... */}
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        {/* Form content... */}
      </Dialog>
    </div>
  );
}
```

### Sub-Component: KanbanColumn
```typescript
function KanbanColumn({
  title,
  count,
  color,
  badgeColor,
  tasks,
  getAssigneeName,
  getPriorityColor,
  onDelete,
}: {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  tasks: Task[];
  getAssigneeName: (id: string) => string;
  getPriorityColor: (priority: string) => string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-shrink-0 w-96">
      <div className={`bg-gradient-to-br ${color} rounded-lg p-4 mb-4 border border-slate-200`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <span className={`${badgeColor} px-3 py-1 rounded-full text-sm font-semibold`}>
            {count}
          </span>
        </div>
      </div>

      <div className="space-y-3 min-h-96 pb-4">
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center min-h-96 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              assigneeName={getAssigneeName(task.assigneeId)}
              onDelete={onDelete}
              getPriorityColor={getPriorityColor}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

### Sub-Component: KanbanCard
```typescript
function KanbanCard({
  task,
  assigneeName,
  onDelete,
  getPriorityColor,
}: {
  task: Task;
  assigneeName: string;
  onDelete: (id: string) => void;
  getPriorityColor: (priority: string) => string;
}) {
  const getPriorityBg = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-100 text-red-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return colors[priority] || "bg-gray-100 text-gray-700";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-move group">
      {/* Header with Delete Button */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900 text-sm flex-1 pr-2 line-clamp-2">
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
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Priority */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityBg(task.priority)}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Assignee and Due Date */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {getInitials(assigneeName)}
          </div>
          <span className="text-xs text-slate-600 truncate max-w-[120px]">{assigneeName}</span>
        </div>

        {task.dueDate && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        )}
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
```

## Type Definitions

### Task Type
```typescript
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

type CompanyStaff = {
  id: string;
  name?: string;
  email?: string;
};
```

### Form Schema (Company Tasks)
```typescript
const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Assignee is required"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;
```

## API Integration

### Fetch Functions

#### Get Provider Tasks
```typescript
const { data: assignedTasks = [] } = useQuery<Task[]>({
  queryKey: ["/api/provider/tasks"],
  queryFn: async () => {
    const response = await fetch("/api/provider/tasks");
    if (!response.ok) throw new Error("Failed to fetch tasks");
    return response.json();
  },
});
```

#### Get Company Tasks
```typescript
const { data: tasks = [] } = useQuery<Task[]>({
  queryKey: ["/api/company/tasks"],
  queryFn: async () => apiRequest("GET", "/api/company/tasks"),
});
```

#### Get Company Staff
```typescript
const { data: staff = [] } = useQuery<CompanyStaff[]>({
  queryKey: ["/api/company/staff"],
  queryFn: async () => apiRequest("GET", "/api/company/staff"),
});
```

#### Create Task
```typescript
const response = await apiRequest("POST", "/api/tasks", {
  title: "Task Title",
  description: "Description",
  assigneeId: "user-id",
  priority: "medium",
  dueDate: "2024-01-25",
});
```

#### Update Task Status
```typescript
const response = await apiRequest("PUT", `/api/tasks/${taskId}`, {
  status: "in_progress", // or "completed"
});
```

#### Delete Task
```typescript
const response = await apiRequest("DELETE", `/api/tasks/${taskId}`);
```

#### Add Task Update
```typescript
const response = await apiRequest("POST", `/api/tasks/${taskId}/updates`, {
  message: "Update message",
  attachments: [], // optional
});
```

## Hooks Used

### React Hooks
- `useState`: Managing component state
- `useEffect`: Side effects and initialization
- `useCallback`: Memoizing callback functions

### Custom Hooks
- `useToast()`: Display toast notifications
- `useAuth()`: Get current user information
- `useForm()`: Form state management (React Hook Form)

### Query Hooks
- `useQuery()`: Fetch data (React Query/TanStack Query)

## Error Handling

### Try-Catch Pattern
```typescript
try {
  const response = await apiRequest("POST", "/api/tasks", data);
  toast({ title: "Success!" });
  // Invalidate and refetch
  queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
} catch (error) {
  const message = error instanceof Error ? error.message : "An error occurred";
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}
```

### Validation Errors
```typescript
const taskForm = useForm<TaskFormData>({
  resolver: zodResolver(taskFormSchema), // Schema validation
});

// Access form errors
{form.formState.errors.title && (
  <FormMessage>{form.formState.errors.title.message}</FormMessage>
)}
```

## State Management

### Local Component State
```typescript
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
const [showDialog, setShowDialog] = useState(false);
const [tasks, setTasks] = useState<Task[]>([]);
```

### Derived State
```typescript
// Calculate filtered tasks based on status
const openTasks = tasks.filter((t) => t.status === "open");
const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
const completedTasks = tasks.filter((t) => t.status === "completed");
```

## Styling with Tailwind CSS

### Color Classes Used
```typescript
// Background colors
"bg-white", "bg-slate-50", "bg-blue-100", "bg-green-100", "bg-red-100"

// Gradient backgrounds
"bg-gradient-to-br from-slate-100 to-slate-50"
"bg-gradient-to-br from-blue-400 to-blue-600"

// Text colors
"text-slate-900", "text-slate-600", "text-blue-600", "text-red-700"

// Border colors
"border-slate-200", "border-blue-300", "border-red-400"

// Hover states
"hover:shadow-lg", "hover:text-red-500", "hover:bg-blue-700"
```

### Layout Classes
```typescript
// Grid and Flexbox
"flex", "flex-col", "gap-6", "space-y-3"

// Width and Height
"w-96", "min-h-96", "h-6", "w-full"

// Padding and Margins
"p-4", "p-6", "mb-2", "mb-4", "pt-3"

// Border and Border-radius
"border", "border-2", "border-dashed", "rounded-lg", "rounded-full"

// Display
"min-h-screen", "overflow-x-auto", "overflow-hidden"
```

## Performance Considerations

### Query Optimization
```typescript
// Refetch data after mutation
queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });

// Only fetch when needed
const { data, isLoading } = useQuery({
  queryKey: ["/api/tasks", userId],
  enabled: !!userId, // Don't fetch until userId is available
});
```

### Component Memoization
```typescript
// For expensive components, consider:
const MemoizedKanbanCard = React.memo(KanbanCard);
```

### Conditional Rendering
```typescript
// Render empty state only when no tasks
{tasks.length === 0 ? <EmptyState /> : <TaskList />}
```

## Browser DevTools Tips

### React DevTools
1. Install React DevTools extension
2. Inspect component state and props
3. Check re-renders with "Highlight updates when components render"

### Network Tab
1. Check API requests are being made
2. Verify response status codes (200, 201, 400, etc.)
3. View response bodies for debugging

### Console
1. Check for JavaScript errors
2. Log component state changes
3. Test API calls manually

## Development Workflow

### Adding a New Feature

1. **Update Types** (if needed)
   ```typescript
   type Task = {
     // Add new field
     newField?: string;
   };
   ```

2. **Update API** (if needed)
   ```typescript
   const response = await apiRequest("POST", "/api/tasks", {
     // Include new field
     newField: "value",
   });
   ```

3. **Update Component**
   ```typescript
   <div>
     {task.newField && <p>{task.newField}</p>}
   </div>
   ```

4. **Test**
   - Test in browser
   - Check console for errors
   - Verify API calls in Network tab

### Debugging Steps

1. Check browser console for errors
2. Verify API endpoints are correct
3. Check network requests with DevTools
4. Log component state with console.log
5. Use React DevTools to inspect component tree
6. Check database directly if available

## Best Practices

1. **Keep Components Pure**: Avoid side effects in render
2. **Use React Query**: For server state management
3. **Validate Input**: Use Zod for schema validation
4. **Error Handling**: Always wrap async operations in try-catch
5. **Accessibility**: Use semantic HTML and ARIA labels
6. **Performance**: Memoize expensive computations
7. **Testing**: Write unit tests for components
8. **Documentation**: Add comments for complex logic

## Code Examples

### Complete Task Creation Flow
```typescript
// 1. User fills form
const onSubmit = async (data: TaskFormData) => {
  try {
    // 2. Send to API
    await apiRequest("POST", "/api/tasks", {
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      priority: data.priority,
      dueDate: data.dueDate,
    });

    // 3. Show success message
    toast({ title: "Task created successfully" });

    // 4. Reset form
    taskForm.reset();

    // 5. Close dialog
    setShowDialog(false);

    // 6. Refetch tasks to show new task
    queryClient.invalidateQueries({ queryKey: ["/api/company/tasks"] });
  } catch (error) {
    // 7. Handle error
    toast({
      title: "Error creating task",
      variant: "destructive",
    });
  }
};
```

### Complete Task Status Update Flow
```typescript
// 1. User clicks status button
const handleStatusChange = async (taskId: string, newStatus: string) => {
  try {
    // 2. Send update to API
    await apiRequest("PUT", `/api/tasks/${taskId}`, {
      status: newStatus,
    });

    // 3. Show success
    toast({ title: "Task updated successfully" });

    // 4. Refetch to show new status
    queryClient.invalidateQueries({ queryKey: ["/api/provider/tasks"] });

    // 5. Close dialog
    setShowDialog(false);
  } catch (error) {
    // 6. Handle error
    toast({
      title: "Error updating task",
      variant: "destructive",
    });
  }
};
```

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
