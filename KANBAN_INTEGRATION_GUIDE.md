# Kanban Board Integration Guide

## Quick Start

The task management system now includes a fully functional Kanban board for both providers and companies.

## Accessing the Kanban Boards

### For Providers
1. Log in as a provider/artisan
2. Navigate to your dashboard
3. Click on "My Tasks" or "Tasks" section
4. You'll see your assigned tasks in a Kanban board layout

**URL**: `/provider-tasks`

### For Companies
1. Log in as a company admin
2. Navigate to your dashboard
3. Click on "Tasks & Assignments" or "Tasks" section
4. You'll see all tasks assigned to your staff in a Kanban board layout

**URL**: `/company-tasks`

## Board Layout

Both boards have three columns:

| Column | Meaning | Color |
|--------|---------|-------|
| TO DO | Tasks that haven't been started | Gray |
| IN PROGRESS | Tasks currently being worked on | Blue |
| COMPLETE | Finished tasks | Green |

## Features by User Type

### Provider Features (Read/Update Only)
- ✅ View assigned tasks in Kanban columns
- ✅ Click task cards to see details
- ✅ Change task status (TO DO → IN PROGRESS → COMPLETE)
- ✅ Add updates/comments to tasks
- ✅ See task priority and due dates
- ✅ View task update history
- ✅ Track number of updates per task

### Company Features (Full CRUD)
- ✅ Create new tasks with the "+ Add Task" button
- ✅ Assign tasks to staff members
- ✅ View all tasks in Kanban columns
- ✅ Set task priority (High, Medium, Low)
- ✅ Set due dates for tasks
- ✅ Delete tasks (hover to reveal delete button)
- ✅ Click task cards to see details
- ✅ Track task assignments and updates

## Task Properties

Each task displays:

| Property | Icon | Description |
|----------|------|-------------|
| Title | - | Task name/title |
| Description | - | Short task description (optional) |
| Priority | Color Badge | High (Red), Medium (Yellow), Low (Green) |
| Assignee | Avatar (Company only) | Who the task is assigned to |
| Due Date | 📅 Calendar | Expected completion date |
| Updates | Text | Count of task updates/comments |

## Creating a Task (Companies Only)

1. Click the blue **"+ Add Task"** button in the top-right
2. Fill in the form:
   - **Task Title**: Required, clear and specific
   - **Description**: Optional, provide context
   - **Assign To**: Select a staff member from dropdown
   - **Priority**: Choose Low, Medium, or High
   - **Due Date**: Optional, pick a date
3. Click **"Assign Task"** to create

## Updating Task Status

### As a Provider:
1. Click on any task card to open details
2. In the dialog, click one of:
   - **Start Work** (TO DO → IN PROGRESS)
   - **Mark In Progress** (stays IN PROGRESS)
   - **Complete** (IN PROGRESS → COMPLETE)
3. The task card will move to the appropriate column

### As a Company:
- Companies can view task status but status changes are controlled by providers
- Click task to see current status and any updates

## Adding Task Updates

### As a Provider:
1. Open task details (click card)
2. Scroll to "Updates" section
3. Type your update in the text field
4. Optionally add attachments
5. Click **"Send Update"** or press Enter
6. Your update appears in the list with timestamp

### As a Company:
- View updates added by assigned providers
- Cannot add updates (only view)
- See timestamps and update counts on cards

## Deleting Tasks (Companies Only)

1. Hover over a task card to reveal the **X** (delete) button
2. Click the delete button
3. Task is immediately removed
4. (Optional: Add confirmation dialog in future)

## Task Priority Colors

```
🔴 HIGH    - Red background    - Urgent, important tasks
🟡 MEDIUM  - Yellow background - Standard priority
🟢 LOW     - Green background  - Lower priority, can wait
```

## Column Status Meanings

### TO DO
- Task is assigned but not started
- Provider hasn't begun work
- Task awaits action

### IN PROGRESS
- Provider is actively working on task
- Task is under development
- Expected completion date approaching

### COMPLETE
- Task is finished
- All work done
- Ready for review (if applicable)

## Keyboard Shortcuts (Future Enhancement)

The following shortcuts are planned but not yet implemented:

| Shortcut | Action |
|----------|--------|
| `N` | New task (companies) |
| `⌘/Ctrl + K` | Search tasks |
| `⌘/Ctrl + F` | Filter tasks |
| `Arrow Keys` | Navigate between cards |
| `Space` | Open selected task |
| `Delete` | Delete selected task |

## API Endpoints

The Kanban board uses these API endpoints:

```
GET    /api/provider/tasks          - Get provider's assigned tasks
GET    /api/company/tasks           - Get company's assigned tasks
POST   /api/tasks                   - Create new task
PUT    /api/tasks/:id              - Update task
DELETE /api/tasks/:id              - Delete task
POST   /api/tasks/:id/updates      - Add task update
GET    /api/tasks/:id/updates      - Get task updates
```

## Data Flow

### Task Creation (Companies)
```
Form Input → POST /api/tasks → Backend Stores → Task Added to Board
```

### Task Status Update (Providers)
```
Click Status Button → PUT /api/tasks/:id → Backend Updates → Card Moves to Column
```

### Adding Update
```
Type Message → POST /api/tasks/:id/updates → Backend Stores → Update Shows in History
```

## Component Structure

```typescript
// Provider Tasks
export default function ProviderTasks() {
  // Main component with state management
  return (
    <>
      <Navigation />
      <KanbanBoard>
        <ProviderKanbanColumn title="TO DO">
          <ProviderKanbanCard /> // Task card for provider view
        </ProviderKanbanColumn>
      </KanbanBoard>
      <TaskDetailsDialog /> // Shows full task details
    </>
  )
}

// Company Tasks
export default function CompanyTasks() {
  // Main component with CRUD operations
  return (
    <>
      <Navigation />
      <CreateTaskDialog /> // Modal for new tasks
      <KanbanBoard>
        <KanbanColumn title="TO DO">
          <KanbanCard /> // Task card for company view
        </KanbanColumn>
      </KanbanBoard>
    </>
  )
}
```

## State Management

Both components use:
- **React State** (`useState`): For UI state (dialogs, forms)
- **React Query** (`useQuery`): For server state (tasks, staff)
- **React Hook Form** (`useForm`): For form validation
- **Zod**: For schema validation

## Error Handling

The system handles:
- ✅ Network errors (displayed in toast)
- ✅ Validation errors (shown on form fields)
- ✅ Empty states (helpful messaging)
- ✅ Loading states (spinners/skeleton)
- ✅ Missing data (fallback values)

## Performance Tips

1. **For Many Tasks**: 
   - Implement pagination
   - Use virtual scrolling
   - Add filtering/search

2. **For Real-time Updates**:
   - Add WebSocket support
   - Implement polling with React Query
   - Use optimistic updates

3. **For Mobile Users**:
   - Horizontal scroll works well
   - Touch-friendly card sizes
   - Full-width layout on small screens

## Troubleshooting

### Tasks not showing?
- Verify API endpoints are working
- Check database has task records
- Ensure user is logged in
- Check browser console for errors

### Can't create task?
- Verify assignee dropdown populated
- Check form validation (required fields)
- Ensure user has company admin role
- Check database write permissions

### Can't update status?
- Verify user is provider (not company)
- Check task exists in database
- Ensure API endpoint is working
- Check websocket connection if using real-time

### Dialog not opening?
- Verify state management is working
- Check event handlers attached
- Ensure no CSS z-index conflicts
- Test in different browser

## Styling Customization

To customize colors, edit the column color props:

```typescript
// In component JSX:
<ProviderKanbanColumn
  title="TO DO"
  color="from-slate-100 to-slate-50"        // Change here
  badgeColor="bg-slate-100 text-slate-700"  // Change here
/>
```

Available Tailwind colors: slate, blue, green, red, yellow, purple, indigo, pink, cyan, etc.

## Mobile Responsive Breakpoints

```css
/* Full screen view - All columns visible */
@media (min-width: 1280px) {
  /* 3 columns × 384px + gaps + padding */
}

/* Tablet - All columns with scroll */
@media (min-width: 768px) and (max-width: 1279px) {
  /* Horizontal scroll enabled */
}

/* Mobile - Single column + scroll */
@media (max-width: 767px) {
  /* Horizontal scroll for column navigation */
}
```

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements Roadmap

### Phase 1 (Current)
- ✅ Basic Kanban board layout
- ✅ Task creation (companies)
- ✅ Task viewing (both)
- ✅ Task status updates (providers)
- ✅ Task deletion (companies)

### Phase 2 (Planned)
- [ ] Drag and drop between columns
- [ ] Task filtering and search
- [ ] Advanced task assignment
- [ ] Recurring tasks
- [ ] Task templates

### Phase 3 (Future)
- [ ] Gantt chart view
- [ ] Calendar view
- [ ] Team collaboration features
- [ ] Real-time notifications
- [ ] Mobile native app

## Support & Feedback

For issues or feedback about the Kanban board:
1. Check the KANBAN_BOARD_IMPLEMENTATION.md for detailed documentation
2. Review the KANBAN_VISUAL_GUIDE.md for UI reference
3. Check browser console for error messages
4. Test in incognito mode to exclude extensions
5. Clear cache and reload if behavior unexpected

## Related Files

- **Provider Tasks Page**: `client/src/pages/provider-tasks.tsx`
- **Company Tasks Page**: `client/src/pages/company-tasks.tsx`
- **API Routes**: `server/routes.ts` (tasks endpoints)
- **Database Schema**: Check migrations for task tables

## Database Schema Reference

```typescript
// Task Table
{
  id: string,              // UUID primary key
  title: string,           // Task title (required)
  description: string,     // Task description (optional)
  status: enum,            // 'open' | 'in_progress' | 'completed'
  priority: enum,          // 'low' | 'medium' | 'high'
  assigneeId: string,      // Foreign key to User
  companyId: string,       // Foreign key to Company
  dueDate: datetime,       // Optional due date
  createdAt: datetime,     // Timestamp
  updatedAt: datetime      // Timestamp
}

// TaskUpdate Table
{
  id: string,              // UUID primary key
  taskId: string,          // Foreign key to Task
  userId: string,          // User who added update
  message: string,         // Update content
  attachments: string[],   // File attachments (optional)
  createdAt: datetime      // Timestamp
}
```

## Success Indicators

The Kanban board is working well when:
- ✅ Tasks appear in correct columns based on status
- ✅ Can create new tasks (companies)
- ✅ Can update task status (providers)
- ✅ Can see task updates with timestamps
- ✅ Can delete tasks (companies)
- ✅ No console errors
- ✅ Fast load times (< 2 seconds)
- ✅ Responsive on mobile devices

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
**Status**: ✅ Production Ready
