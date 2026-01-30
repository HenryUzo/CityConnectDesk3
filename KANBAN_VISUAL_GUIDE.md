# Kanban Board Visual Guide

## Provider Tasks Board

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← My Tasks                                                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ My Task Board                                                                        │
│ Track your assigned tasks and update their progress                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │  TO DO          [2] │  │ IN PROGRESS     [0] │  │ COMPLETE        [1] │         │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤         │
│  │ ┌─────────────────┐ │  │                     │  │ ┌─────────────────┐ │         │
│  │ │ Setup Database  │ │  │  (no tasks)         │  │ │ Create Account  │ │         │
│  │ │ Create a new... │ │  │                     │  │ │ Set up user...  │ │         │
│  │ │ [HIGH]          │ │  │                     │  │ │ [LOW]           │ │         │
│  │ │ 📅 Jan 15       │ │  │                     │  │ │ 📅 Jan 10       │ │         │
│  │ │ 2 updates       │ │  │                     │  │ │ 3 updates       │ │         │
│  │ └─────────────────┘ │  │                     │  │ └─────────────────┘ │         │
│  │                     │  │                     │  │                     │         │
│  │ ┌─────────────────┐ │  │                     │  │                     │         │
│  │ │ Design UI       │ │  │                     │  │                     │         │
│  │ │ Create mockups..│ │  │                     │  │                     │         │
│  │ │ [MEDIUM]        │ │  │                     │  │                     │         │
│  │ │ 📅 Jan 20       │ │  │                     │  │                     │         │
│  │ │ 1 update        │ │  │                     │  │                     │         │
│  │ └─────────────────┘ │  │                     │  │                     │         │
│  │                     │  │                     │  │                     │         │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘         │
│                                                                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Company Tasks Board

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Tasks & Assignments                                  [+ Add Task]                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Task Board                                                                           │
│ Drag tasks between columns or click to manage                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │  TO DO         [3]  │  │ IN PROGRESS    [1]  │  │ COMPLETE       [2]  │         │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤         │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │         │
│  │ │ Client Onboard  │ │  │ │ Fix Bug Report  │ │  │ │ Review Website  │ │         │
│  │ │ Onboard new...  │ │  │ │ Security fix..  │ │  │ │ QA website...   │ │         │
│  │ │ [HIGH]          │ │  │ │ [MEDIUM]        │ │  │ │ [LOW]           │ │         │
│  │ │ [JS] John Smith │ │  │ │ [MJ] Maria Jane │ │  │ │ [AS] Anna Smith │ │         │
│  │ │ 📅 Jan 25       │ │  │ │ 📅 Jan 22       │ │  │ │ 📅 Jan 18       │ │         │
│  │ │ 1 update        │ │  │ │ 2 updates       │ │  │ │ 4 updates       │ │         │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │         │
│  │                     │  │                     │  │                     │         │
│  │ ┌─────────────────┐ │  │                     │  │ ┌─────────────────┐ │         │
│  │ │ Update Pricing  │ │  │                     │  │ │ Deploy API v2   │ │         │
│  │ │ Adjust pricing..│ │  │                     │  │ │ Deploy new...   │ │         │
│  │ │ [MEDIUM]        │ │  │                     │  │ │ [HIGH]          │ │         │
│  │ │ [TS] Tom Smith  │ │  │                     │  │ │ [DK] Dave King  │ │         │
│  │ │ 📅 Jan 28       │ │  │                     │  │ │ 📅 Jan 15       │ │         │
│  │ │ 0 updates       │ │  │                     │  │ │ 5 updates       │ │         │
│  │ └─────────────────┘ │  │                     │  │ └─────────────────┘ │         │
│  │                     │  │                     │  │                     │         │
│  │ ┌─────────────────┐ │  │                     │  │                     │         │
│  │ │ Analytics Setup │ │  │                     │  │                     │         │
│  │ │ Integrate GA..  │ │  │                     │  │                     │         │
│  │ │ [LOW]           │ │  │                     │  │                     │         │
│  │ │ [RJ] Ray Johnson│ │  │                     │  │                     │         │
│  │ │ 📅 Feb 5        │ │  │                     │  │                     │         │
│  │ │ 0 updates       │ │  │                     │  │                     │         │
│  │ └─────────────────┘ │  │                     │  │                     │         │
│  │                     │  │                     │  │                     │         │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘         │
│                                                                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Task Card Details

### Provider Task Card (Basic)
```
┌────────────────────────────┐
│ Setup Database             │  ← Task Title (line clamp 2)
│ Create a new database...   │  ← Description (line clamp 2)
│                            │
│ [HIGH]                     │  ← Priority Badge (color-coded)
│                            │
├────────────────────────────┤
│ 📅 Jan 15     2 updates    │  ← Due Date + Update Count
└────────────────────────────┘
```

### Company Task Card (With Assignee)
```
┌────────────────────────────┐
│ Setup Database        ✕    │  ← Title + Delete Button (hover)
│ Create a new database...   │  ← Description
│                            │
│ [HIGH]                     │  ← Priority Badge
│                            │
├────────────────────────────┤
│ [JS] John Smith    📅 Jan15 │  ← Assignee Avatar + Name + Date
│                            │
│ 2 updates                  │  ← Update Count
└────────────────────────────┘
```

## Color Scheme

### Column Headers
- **TO DO**: Gray gradient (`from-slate-100 to-slate-50`)
- **IN PROGRESS**: Blue gradient (`from-blue-100 to-blue-50`)
- **COMPLETE**: Green gradient (`from-green-100 to-green-50`)

### Priority Badges
- **HIGH**: 🔴 Red background (`bg-red-100 text-red-700`)
- **MEDIUM**: 🟡 Yellow background (`bg-yellow-100 text-yellow-700`)
- **LOW**: 🟢 Green background (`bg-green-100 text-green-700`)

### Card States
- **Default**: White background with subtle border
- **Hover**: Shadow effect with slight lift animation
- **Selected**: Dialog overlay with full details

## Interactive Elements

### Provider Tasks
1. **Click Card** → Opens task details dialog
2. **In Dialog**:
   - View task description
   - See all updates with timestamps
   - Change status (Open → In Progress → Complete)
   - Add new updates/comments
   - Upload attachments

### Company Tasks
1. **Click Card** → Opens task details dialog
2. **Hover Card** → Shows delete button
3. **Click Delete** → Removes task
4. **Click Add Task Button** → Opens create form
5. **In Form**:
   - Enter task title & description
   - Select assignee from dropdown
   - Set priority level
   - Pick due date
   - Submit to create task

## Responsive Behavior

### Desktop (1920px+)
- All three columns visible
- Fixed width columns (384px / w-96)
- Horizontal scroll if space limited

### Tablet (768px - 1920px)
- All three columns visible with adjusted padding
- Horizontal scroll enabled
- Card sizes responsive

### Mobile (< 768px)
- Single column visible
- Horizontal scroll to navigate
- Touch-friendly tap targets
- Full-width cards with margins

## Column Heights

- **Minimum**: `min-h-96` (24rem / 384px)
- **Dynamic**: Expands with content
- **Scroll**: Parent container has `overflow-x-auto`

## Spacing & Layout

- **Column Gap**: `gap-6` (1.5rem)
- **Card Gap**: `space-y-3` (0.75rem)
- **Card Padding**: `p-4` (1rem)
- **Column Padding**: `p-6` (1.5rem container)
- **Card Margin**: Flex layout with gap

## Typography

- **Column Title**: `font-bold text-lg` (18px, bold)
- **Card Title**: `font-semibold text-sm` (14px, semi-bold)
- **Description**: `text-xs text-slate-600` (12px, gray)
- **Badge**: `text-xs font-medium` (12px, medium)
- **Timestamp**: `text-xs text-slate-500` (12px, light gray)

## Accessibility Features

1. **ARIA Labels**: On interactive elements
2. **Keyboard Navigation**: Tab through elements
3. **Focus States**: Clear visual focus indicators
4. **Color Contrast**: WCAG AA compliant
5. **Semantic HTML**: Proper heading and button elements
6. **Icon + Text**: Icons paired with text labels
7. **Empty States**: Clear messaging when no tasks

## Performance Considerations

1. **Lazy Loading**: Tasks load on demand
2. **Virtual Scrolling**: Consider for 100+ tasks
3. **Debouncing**: Update operations debounced
4. **Caching**: Query results cached with React Query
5. **Optimization**: Card components are memoized
6. **CSS**: Tailwind classes pre-purged
7. **Images**: Avatar initials instead of images

## Error Handling

- Network error messages in toast notifications
- Validation errors in form dialogs
- Loading states on async operations
- Fallback content for missing data

## Future UI Enhancements

1. Drag and drop animations
2. Task filtering sidebar
3. Quick action buttons on hover
4. Inline task editing
5. Advanced search bar
6. Date range picker
7. Team member avatars
8. Task templates
9. Recurring tasks
10. Progress bars for task completion
