# How to Test the Task Sync Fix

This document provides step-by-step instructions to verify that the task sync issue is fixed.

## Test Overview
- **Time Required:** 10-15 minutes
- **Accounts Needed:** Company admin + Test Provider
- **Browsers:** 2 windows (or 2 tabs with different user profiles)

## Step 1: Prepare Your Testing Environment

### 1.1 Open Application
- Navigate to your CityConnect application
- Make sure you're on a fresh page (clear cache if needed)
- DevTools ready: Press F12

### 1.2 Login as Company Admin
- If not already logged in, login with admin credentials
- You should see the company dashboard
- Keep this tab open for Step 3

## Step 2: Create and Assign a Task

### 2.1 Navigate to Task Management
- Click on "Tasks" in the sidebar (or navigate to `/company/tasks`)
- You should see three sections: "Open Tasks", "In Progress", "Completed"

### 2.2 Create New Task
- Click "Add New Task" button
- Fill in the form with these details:

| Field | Value |
|-------|-------|
| Title | "Test Sync Task" |
| Description | "Testing the task sync fix" |
| Priority | "High" |
| Assignee | "Test Provider" (select from dropdown) |
| Due Date | Tomorrow's date |

### 2.3 Submit Task
- Click "Assign Task" button
- ✅ You should see a green toast notification: "Task assigned successfully"
- ✅ Task should appear in the "Open Tasks" section

### 2.4 Verify Task in localStorage
- Press F12 to open DevTools
- Go to Console tab
- Copy and paste this code:

```javascript
const tasks = JSON.parse(localStorage.getItem('company-tasks'));
console.log('=== TASK DETAILS ===');
console.log('Total tasks:', tasks.length);
console.log('Task title:', tasks[0].title);
console.log('Assigned to ID:', tasks[0].assigneeId);
console.log('Full task object:', tasks[0]);
```

- ✅ You should see the task details
- **IMPORTANT:** Copy the value of `assigneeId` (it should be a long UUID like `550e8400-e29b-41d4-a716-446655440000`)

## Step 3: Switch to Provider Account

### 3.1 Logout from Company
- Click your profile icon in the top right
- Click "Logout"
- ✅ You should be redirected to login page

### 3.2 Clear Browser Cache (Optional but Recommended)
- Press Ctrl+Shift+Del (Windows) or Cmd+Shift+Del (Mac)
- Select "All time" for time range
- Check "Cookies and other site data" and "Cached images and files"
- Click "Clear data"
- ✅ Cache is cleared

### 3.3 Login as Test Provider
- Email: `testprovider@example.com`
- Password: `TestProvider123!`
- ✅ You should see the provider dashboard

## Step 4: Verify Task Appears

### 4.1 Check Console for Logs
- Press F12 to open DevTools
- Go to Console tab
- ✅ You should see these logs automatically (from page load):

```
Provider Tasks loaded - Provider ID: [UUID]
All tasks from localStorage: [...]
Tasks assigned to this provider: [...]
```

**If you don't see the logs:**
- Refresh the page with Ctrl+F5 (hard refresh)
- Check for any error messages in the console
- If still no logs, the provider ID isn't being detected properly

### 4.2 Navigate to My Tasks
- Look in the left sidebar
- You should see "My Tasks" link (with CheckCircle icon)
- Click on it (or navigate to `/provider/tasks`)
- ✅ The "Test Sync Task" should appear in the list

### 4.3 Verify Task Details
- Click on the task to view details
- You should see:
  - Task title: "Test Sync Task"
  - Description: "Testing the task sync fix"
  - Priority: "High"
  - Status: "Open"
  - Assigned date shown

### 4.4 Verify IDs Match
- In Console, run:

```javascript
const user = JSON.parse(localStorage.getItem('user'));
const tasks = JSON.parse(localStorage.getItem('company-tasks'));

console.log('Your user ID:', user.id);
console.log('Task assigneeId:', tasks[0].assigneeId);
console.log('IDs match?', user.id === tasks[0].assigneeId);
```

- ✅ All three values should match (the ID you copied in Step 2.4)
- ✅ "IDs match?" should show `true`

## Step 5: Test Task Interaction

### 5.1 Update Task Status
- On the My Tasks page, click the task
- Change status from "Open" to "In Progress"
- ✅ Status should update immediately
- ✅ Task should appear in "In Progress" section

### 5.2 Add Task Update
- Click "Add Update" button
- Type a message: "Started working on this task"
- Click "Send Update"
- ✅ Update should appear in task details

### 5.3 Upload Evidence (Optional)
- Click "Add Evidence" or file upload button
- Select a file from your computer
- ✅ File should be attached to the task

## Step 6: Verify Sync Back to Company

### 6.1 Switch Back to Company Tab
- Go back to your company admin tab
- Refresh the page (Ctrl+F5)
- ✅ Task status should show as "In Progress" (if you changed it)

### 6.2 Verify in Company Dashboard
- The task should now show:
  - Updated status
  - Any updates or attachments from the provider

## Success Criteria Checklist

Check all of these to confirm the fix is working:

- [ ] Task created successfully from company side
- [ ] Task appears in company's "Assigned Tasks" section
- [ ] Provider can login successfully
- [ ] Console shows "Provider Tasks loaded" log
- [ ] "My Tasks" link visible in provider sidebar
- [ ] Task appears in provider's task list
- [ ] Task details are correct
- [ ] IDs match (user.id === task.assigneeId)
- [ ] Provider can update task status
- [ ] Provider can add updates
- [ ] Company sees updates from provider

**✅ If ALL checkmarks are done:** The fix is working correctly!

## Troubleshooting

### Problem: Task doesn't appear on provider side
**Check these in order:**

1. **Are IDs matching?**
   ```javascript
   const user = JSON.parse(localStorage.getItem('user'));
   const tasks = JSON.parse(localStorage.getItem('company-tasks'));
   console.log(user.id === tasks[0]?.assigneeId);
   ```
   - If `false`: Re-assign task to correct provider

2. **Is provider ID detected?**
   - Look for log: "Provider Tasks loaded - Provider ID: [UUID]"
   - If missing: Logout and login again

3. **Is localStorage syncing?**
   - Check: `localStorage.getItem('company-tasks')`
   - If null: Create task from company side

4. **Browser cache issues?**
   - Clear cache: Ctrl+Shift+Del
   - Hard refresh: Ctrl+F5

### Problem: Can't find "My Tasks" link
**Solutions:**

1. Refresh page (Ctrl+F5)
2. Clear browser cache
3. Check that you're logged in as a provider (role: "provider")
4. Navigate directly to `/provider/tasks`

### Problem: Error messages in console
**Common errors:**

- "Failed to parse tasks" → localStorage is corrupted, clear cache
- "Provider ID not found" → User not logged in properly
- "tasks is not iterable" → Company-tasks not properly formatted

## Advanced Testing

### Test 1: Multiple Tasks
- Create 3 different tasks from company
- Assign them to the same provider
- Verify all 3 appear in provider's list

### Test 2: Different Providers
- Create task for "Test Provider"
- Login as different provider
- Verify task does NOT appear for other providers

### Test 3: Status Transitions
- Create task (status: "open")
- Change to "in_progress"
- Change to "completed"
- Verify each status update syncs

### Test 4: Real-Time Sync
- Open company and provider pages side-by-side
- Update task status on provider side
- Refresh company side
- Verify status is updated

## Performance Notes

- First load: May take a moment to load all tasks
- Task filtering: Should be instant (< 100ms)
- localStorage: Can hold up to 5-10MB of data
- Browser cache: Clear if performance degrades

## Next Steps After Testing

1. **If working perfectly:**
   - System is ready for production
   - Users can start using task management
   - Continue with additional features

2. **If minor issues:**
   - Clear cache and try again
   - Check troubleshooting section
   - Report specific behavior

3. **If major issues:**
   - Check console for errors
   - Review TASK_SYNC_FIX.md
   - Contact development team

## Support Resources

- **Full Guide:** `TASK_SYNC_FIX.md`
- **Quick Test:** `browser-console-test.js` (paste in console)
- **Feature Docs:** `TASK_MANAGEMENT_FEATURE.md`
- **Quick Reference:** `TASK_MANAGEMENT_QUICK_START.md`

---

**Need help?** Run this in the console to get a detailed report:
```javascript
// Detailed system report
const user = JSON.parse(localStorage.getItem('user') || '{}');
const tasks = JSON.parse(localStorage.getItem('company-tasks') || '[]');

console.log('%c=== SYSTEM STATUS ===', 'color: blue; font-weight: bold;');
console.log('Logged in:', !!user.id);
console.log('User ID:', user.id);
console.log('User role:', user.role);
console.log('Total tasks:', tasks.length);
console.log('Your tasks:', tasks.filter(t => t.assigneeId === user.id).length);
```

Good luck with testing! 🚀
