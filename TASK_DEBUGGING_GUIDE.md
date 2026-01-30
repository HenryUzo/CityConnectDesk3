# Task Assignment Debugging Guide

## Issues Fixed ✅

1. **Provider ID Detection** - Now uses `useAuth()` hook instead of manual localStorage reading
2. **Debug Logging** - Added console logs to track what's happening

## How to Debug Task Assignment Issues

### Step 1: Open Browser Console
- Press `F12` to open Developer Tools
- Go to the **Console** tab

### Step 2: Check Provider ID
When the provider opens `/provider/tasks`, look for this log:
```
Provider Tasks loaded - Provider ID: [UUID-or-ID]
```

**If you see `undefined`:**
- Provider is not logged in properly
- Check if the user object is being loaded correctly
- Verify the auth system is working

### Step 3: Check Company Staff Loading
When the company creates a task on `/company/tasks`, look for:
```
Company staff loaded: [Array of providers with IDs]
```

**If the array is empty:**
- No providers are assigned to the company
- Go to `/company/stores` and assign providers
- Or create a membership between company and provider first

**Expected output:**
```javascript
[
  { id: "uuid-123", name: "John Doe", email: "john@example.com", ... },
  { id: "uuid-456", name: "Jane Smith", email: "jane@example.com", ... }
]
```

### Step 4: Check All Tasks in localStorage
In browser console, run:
```javascript
JSON.parse(localStorage.getItem("company-tasks"))
```

**Look for:**
- Does the array have tasks?
- Does each task have an `assigneeId` field?
- Does the `assigneeId` match the provider's ID?

**Example output:**
```javascript
[
  {
    id: "task-1",
    title: "Install Shelving",
    assigneeId: "uuid-123",  // ← This should match provider's ID
    status: "open",
    ...
  }
]
```

### Step 5: Check Provider's Assigned Tasks
In browser console, when provider is on `/provider/tasks`:
```javascript
const providerId = "[paste provider ID from step 2]";
const tasks = JSON.parse(localStorage.getItem("company-tasks"));
const myTasks = tasks.filter(t => t.assigneeId === providerId);
console.log("My tasks:", myTasks);
```

**If empty:**
- Provider ID doesn't match assigneeId in the task
- Company assigned the task to a different provider

---

## Common Issues & Solutions

### Issue 1: Provider Doesn't See Assigned Task

**Check:**
1. Is the assigneeId in the task matching the provider's ID?
   ```javascript
   // Get provider ID
   localStorage.getItem("user");
   
   // Get task
   JSON.parse(localStorage.getItem("company-tasks"))[0];
   ```

2. Check if IDs match exactly (case-sensitive)

**Solution:**
- Verify the provider being assigned is the one logged in
- The staff dropdown should show the provider with their exact ID
- When assigning, confirm you selected the correct provider from dropdown

---

### Issue 2: Staff List is Empty in Company

**Check:**
1. Open DevTools Console
2. Look for log: `Company staff loaded: []`

**Solution:**
1. Go to `/company/stores`
2. Assign some providers to your company/stores
3. Return to `/company/tasks`
4. Staff list should now show providers

---

### Issue 3: IDs Don't Match

**Why this happens:**
- Provider might have multiple accounts
- Different ID formats (UUID vs numeric)
- Data sync issue

**How to fix:**
1. Log in as the company
2. Check browser console for staff IDs
3. Log in as the provider  
4. Check browser console for provider ID
5. Confirm they match exactly
6. If not, use the company's dropdown to assign to the correct provider

---

## Debug Checklist

- [ ] Provider is logged in (`useAuth()` returns user object)
- [ ] Provider ID is visible in console (`Provider Tasks loaded - Provider ID: ...`)
- [ ] Company staff loads from API (`Company staff loaded: [...]`)
- [ ] Task is created with correct `assigneeId`
- [ ] `assigneeId` matches provider's `user.id`
- [ ] localStorage shows the task
- [ ] localStorage shows correct assigneeId
- [ ] Filter by assigneeId returns the task

---

## Quick Fix Steps

If tasks aren't appearing:

1. **Check provider ID:**
   ```javascript
   // In provider's page console
   console.log(localStorage.getItem("user"));
   ```

2. **Check task assigneeId:**
   ```javascript
   // In company's page console
   console.log(JSON.parse(localStorage.getItem("company-tasks"))[0].assigneeId);
   ```

3. **Compare them** - they must match exactly

4. **If different:**
   - Company needs to reassign task to correct provider
   - Or provider needs to log in with correct account

5. **If same:**
   - Check browser cache (Ctrl+Shift+Del)
   - Refresh both pages
   - Try opening provider tasks in a new tab

---

## Testing Process

### Test Case 1: Single Provider Task
1. Log in as **Company A**
2. Go to `/company/tasks`
3. Click "Assign Task"
4. Select **Provider A** from dropdown
5. Create task
6. Log out
7. Log in as **Provider A**
8. Go to `/provider/tasks`
9. **Task should appear**

**Debugging if it fails:**
- Check console logs for IDs
- Verify provider dropdown shows "Provider A"
- Confirm assigneeId matches

### Test Case 2: Multiple Tasks
1. Create 3 tasks assigned to Provider A
2. Create 2 tasks assigned to Provider B
3. Log in as Provider A
4. Should see 3 tasks
5. Log in as Provider B
6. Should see 2 tasks

**Debugging:**
- Use console filter to verify each task's assigneeId

---

## Contact Support

If issues persist, provide:
1. Browser console logs (screenshot)
2. Output of:
   ```javascript
   console.log(localStorage.getItem("user"));
   console.log(JSON.parse(localStorage.getItem("company-tasks")));
   ```
3. What provider was selected when creating task
4. What provider is logged in now

