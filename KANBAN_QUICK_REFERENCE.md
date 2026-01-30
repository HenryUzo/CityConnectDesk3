# Kanban Board - Quick Reference Guide

## 🚀 Quick Navigation

### Provider/Artisan Users
- **Page**: `/provider-tasks`
- **Purpose**: View and manage your assigned tasks
- **Key Action**: Click task → Change status → View updates

### Company/Admin Users
- **Page**: `/company-tasks`
- **Purpose**: Create and manage tasks for your team
- **Key Action**: Add Task → Assign → Track

---

## 📋 Column Guide

| Column | Who Can See | What It Means | Color |
|--------|------------|--------------|-------|
| **TO DO** | Both | Task not started | Gray |
| **IN PROGRESS** | Both | Being worked on | Blue |
| **COMPLETE** | Both | Finished | Green |

---

## 🎯 Task Card Quick Reference

### Information Displayed
```
┌─────────────────────────────┐
│ Task Title              [✕] │ ← Can delete (company only)
├─────────────────────────────┤
│ Task description (optional) │
├─────────────────────────────┤
│ [PRIORITY]                  │ ← HIGH/MEDIUM/LOW color-coded
│                             │
│ [AVATAR] Assignee  📅 Date  │ ← Avatar + Name + Due Date
│          # updates          │ ← Number of comments/updates
└─────────────────────────────┘
```

---

## 🎨 Priority Colors

- 🔴 **HIGH** (Red) - Urgent, do first
- 🟡 **MEDIUM** (Yellow) - Standard priority
- 🟢 **LOW** (Green) - Can wait

---

## ⚡ Common Actions

### For Providers

**View a Task:**
1. Click the task card
2. Dialog opens with full details
3. Scroll to see updates/comments

**Update Task Status:**
1. Click the task card
2. Find status buttons in dialog
3. Click: Start Work → In Progress → Complete
4. Status updates immediately

**Add an Update:**
1. Open task details
2. Scroll to "Updates" section
3. Type your message
4. Click Send or press Enter

**Return to Board:**
- Click ✕ or press Escape
- Board refreshes automatically

### For Companies

**Create a New Task:**
1. Click blue "+ Add Task" button (top-right)
2. Fill in form:
   - Task title (required)
   - Description (optional)
   - Select assignee from dropdown
   - Choose priority
   - Pick due date (optional)
3. Click "Assign Task"
4. Task appears in TO DO column

**Delete a Task:**
1. Hover over task card
2. Click ✕ button (appears on hover)
3. Task is deleted

**View Task Details:**
1. Click the task card
2. See full information and updates
3. Close with ✕ or Escape

---

## 📱 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close dialog/popup |
| `Tab` | Navigate between elements |
| `Enter` | Submit form or add update |
| `Space` | Activate buttons |

---

## 🔧 Troubleshooting Quick Tips

### Task not showing?
- Refresh the page
- Check you're assigned to it
- Verify task status

### Can't create task?
- All fields filled in?
- Selected an assignee?
- Checked form errors?

### Button not working?
- Try scrolling up/down
- Refresh the page
- Check internet connection

### Need more info?
- Read KANBAN_INTEGRATION_GUIDE.md
- Contact your administrator

---

## 📊 Board Stats at a Glance

Each column header shows the count:
- **TO DO [5]** = 5 unstarted tasks
- **IN PROGRESS [2]** = 2 being worked on
- **COMPLETE [8]** = 8 finished

---

## 💡 Tips & Tricks

### Provider Tips
1. Check due dates often - stay on top of deadlines
2. Add regular updates so company knows progress
3. Move tasks to IN PROGRESS when you start
4. Mark as COMPLETE when done

### Company Tips
1. Set due dates to keep team on schedule
2. Use HIGH priority for urgent tasks
3. Assign to most available team member
4. Check updates regularly for progress

---

## 🎯 Best Practices

### Creating Clear Tasks
✅ **Good**: "Design homepage wireframes"
❌ **Bad**: "Design stuff"

✅ **Good**: "Update user authentication to OAuth2"
❌ **Bad**: "Fix auth"

### Setting Realistic Due Dates
✅ **Good**: Due date 1-2 weeks from now
❌ **Bad**: Due date tomorrow for complex task

### Using Priority Correctly
- **HIGH**: Blocking other work, urgent deadline
- **MEDIUM**: Regular work, standard deadline
- **LOW**: Nice to have, flexible deadline

---

## 📞 Quick Support

### Common Questions

**Q: How do I move a task between columns?**
A: Currently, manually update status via dialog buttons. Drag-and-drop coming soon!

**Q: Can I see tasks from other people?**
A: Providers see only assigned tasks. Companies see all team tasks.

**Q: How do I add a comment?**
A: Open task → scroll to Updates → type message → send

**Q: Can I undo a deletion?**
A: No - deleted tasks cannot be recovered. Be careful with delete!

**Q: What if I miss a due date?**
A: The date still shows - just update the task to reflect current status.

---

## 🌐 Browser Support

Works great on:
- Chrome/Chromium
- Firefox
- Safari
- Edge
- Mobile browsers

---

## 📈 Performance Tips

For best performance:
- Don't have too many tasks open at once
- Close unused dialogs
- Refresh if page gets slow
- Check your internet connection

---

## 🔐 Access Control

| Action | Provider | Company |
|--------|----------|---------|
| View assigned tasks | ✅ | ✅ (all tasks) |
| Update own task status | ✅ | ❌ |
| Add task update | ✅ | ❌ |
| Create new task | ❌ | ✅ |
| Delete task | ❌ | ✅ |
| View all tasks | ❌ | ✅ |

---

## 🎓 Learning Path

1. **Start**: Read this Quick Reference
2. **Understand**: Read KANBAN_INTEGRATION_GUIDE.md
3. **Deep Dive**: Read KANBAN_BOARD_IMPLEMENTATION.md
4. **Master**: Read KANBAN_DEVELOPER_GUIDE.md (for devs)

---

## 🚨 Important Notes

⚠️ **Deleting is permanent** - No undo available
⚠️ **Only assignee can update status** - Company cannot mark task complete
⚠️ **Internet required** - Page needs connection to work
⚠️ **Data refreshes automatically** - Don't manually refresh

---

## 🎉 You're Ready!

You now have everything needed to use the Kanban Board effectively.

**Happy task managing!** 🚀

---

## Document Quick Links

- **Integration Guide**: KANBAN_INTEGRATION_GUIDE.md
- **Visual Guide**: KANBAN_VISUAL_GUIDE.md
- **Implementation Details**: KANBAN_BOARD_IMPLEMENTATION.md
- **Developer Guide**: KANBAN_DEVELOPER_GUIDE.md
- **Project Summary**: KANBAN_PROJECT_SUMMARY.md

---

**Version**: 1.0.0
**Last Updated**: January 15, 2024
**Status**: ✅ Ready to Use
