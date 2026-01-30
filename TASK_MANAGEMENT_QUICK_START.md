# Task Management Feature - Quick Start Guide

## How to Use

### For Companies 🏢

1. **Navigate to Tasks:**
   - Go to Company Dashboard
   - Click the "Tasks" card in Quick Links section
   - Or go directly to `/company/tasks`

2. **Create a Task:**
   - Click "Assign Task" button
   - Fill in the form:
     - **Task Title** (required) - What needs to be done
     - **Description** (optional) - Details about the task
     - **Assign To** (required) - Select a provider from dropdown
     - **Priority** - Low, Medium, or High
     - **Due Date** (optional) - When should it be done
   - Click "Assign Task"

3. **Track Progress:**
   - View tasks organized by status:
     - **Open** - Not started yet
     - **In Progress** - Provider is working on it
     - **Completed** - Provider finished
   - Click on any task to see:
     - Full details
     - All updates from provider
     - Attached files

4. **Manage Tasks:**
   - Delete tasks with trash icon
   - View provider updates in real-time
   - See file attachments providers send

---

### For Providers 👷

1. **View Assigned Tasks:**
   - Go to Provider Dashboard
   - Click "My Tasks" tab
   - Or go directly to `/provider/tasks`

2. **Get Started:**
   - See all tasks assigned to you
   - Grouped by status: Open, In Progress, Completed
   - Quick statistics at the top

3. **Work on Tasks:**
   - Click "Start Task" → status becomes "In Progress"
   - Click "Mark Complete" → task is finished
   - Tasks show priority, due date, and assignment date

4. **Send Updates:**
   - Click on any task to open details
   - Add message about your progress
   - Attach files (photos, documents, etc.)
   - Click "Send Update"
   - Company sees updates instantly

5. **Track Progress:**
   - View all updates you've sent
   - See timestamps for each update
   - View attached files

---

## Features Overview

### Task Status Flow
```
Open → Start Task → In Progress → Mark Complete → Completed
```

### Priority Levels
- 🔴 **High** - Urgent, needs immediate attention
- 🟡 **Medium** - Standard priority (default)
- 🟢 **Low** - Can be done when there's time

### What Gets Stored
- Task details (title, description, priority, due date)
- Assignments (which provider has the task)
- Status updates (progress messages from provider)
- Attachments (file names/links from provider)
- Timestamps (when task created, when updates sent)

---

## Real-time Synchronization

When a **provider** sends an update:
- Company sees it immediately (on same browser/device)
- Appears in task details
- Shows timestamp
- Displays any attachments

When a **provider** changes task status:
- Task moves to new status section
- Company dashboard updates automatically
- Counts at top refresh

---

## Tips & Best Practices

✅ **Do:**
- Set clear, specific task titles
- Add due dates for important tasks
- Use High priority for urgent work
- Check for provider updates regularly
- Provide context in descriptions

❌ **Don't:**
- Create overly complex tasks (break them down)
- Forget to check task updates
- Set unrealistic due dates
- Ignore priority when assigning

---

## Keyboard Shortcuts

While in task dialogs:
- `Escape` - Close dialog
- `Tab` - Move to next field
- `Shift + Tab` - Move to previous field
- `Enter` - Submit form (when focused on button)

---

## Troubleshooting

**Q: Task not showing up?**
A: Make sure you assigned it to the correct provider ID. Refresh your browser.

**Q: Provider not seeing updates?**
A: Updates sync within seconds. If not showing, refresh the provider tasks page.

**Q: Lost my tasks?**
A: Tasks are saved in your browser's local storage. Clearing browser data will delete them. Use browser's dev tools to check localStorage if needed.

**Q: Can't see attachments?**
A: File names are shown. Full file preview coming soon - currently stores file names only.

---

## Data Safety

- **Backup:** Keep important task info backed up externally
- **Storage:** Currently uses browser localStorage (survives refreshes)
- **Future:** Will migrate to database for permanent storage
- **Access:** Only you and assigned providers can see your tasks

---

## Navigation Map

```
Company Dashboard
├── Quick Links
│   ├── Store Management → /company/stores
│   ├── Inventory → /company/inventory
│   └── Tasks ✨ → /company/tasks
└── [Other sections...]

Provider Dashboard
├── Tabs
│   ├── Available Jobs
│   ├── Active Jobs
│   ├── Completed Jobs
│   ├── My Stores
│   └── My Tasks ✨ → /provider/tasks
└── [Other sections...]
```

---

## Getting Help

If you encounter issues:
1. Try refreshing the page
2. Clear browser cache (Ctrl+Shift+Del)
3. Check browser console (F12) for errors
4. Make sure you're logged in
5. Verify you have the right role (company/provider)

---

## What's Coming Next

🚀 **Planned Enhancements:**
- Database storage (tasks survive system restarts)
- Email notifications
- Task templates
- Recurring tasks
- Time tracking
- Advanced analytics
- Mobile app support
- Two-way approvals
- Payment integration

---

**Created:** Now  
**Status:** Active & Ready to Use  
**Storage:** Browser LocalStorage  
**Last Updated:** Today
