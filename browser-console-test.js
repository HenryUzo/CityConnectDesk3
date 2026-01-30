/**
 * QUICK TEST SCRIPT FOR TASK SYNC
 * 
 * Copy and paste the entire script into browser console (F12) to run
 * This will quickly verify if tasks are syncing correctly
 */

console.clear();
console.log("%c=== TASK SYNC VERIFICATION ===", "color: blue; font-size: 16px; font-weight: bold;");

// Test 1: Check if tasks exist
console.log("\n1️⃣  CHECKING TASKS IN LOCALSTORAGE...");
const tasksData = localStorage.getItem('company-tasks');
if (tasksData) {
  try {
    const tasks = JSON.parse(tasksData);
    console.log(`✅ Found ${tasks.length} task(s) in localStorage`);
    if (tasks.length > 0) {
      console.log("📋 First task details:");
      console.log(`   ID: ${tasks[0].id}`);
      console.log(`   Title: ${tasks[0].title}`);
      console.log(`   Assigned to: ${tasks[0].assigneeId}`);
      console.log(`   Status: ${tasks[0].status}`);
    }
  } catch (e) {
    console.error("❌ Failed to parse tasks:", e.message);
  }
} else {
  console.warn("⚠️  No tasks found. Create one from company dashboard first.");
}

// Test 2: Check if user is logged in
console.log("\n2️⃣  CHECKING LOGGED-IN USER...");
const userData = localStorage.getItem('user');
if (userData) {
  try {
    const user = JSON.parse(userData);
    console.log(`✅ User logged in: ${user.name || 'Unknown'}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role || 'N/A'}`);
  } catch (e) {
    console.error("❌ Failed to parse user data:", e.message);
  }
} else {
  console.warn("⚠️  No user logged in");
}

// Test 3: Compare IDs if both exist
console.log("\n3️⃣  COMPARING IDS...");
if (tasksData && userData) {
  try {
    const tasks = JSON.parse(tasksData);
    const user = JSON.parse(userData);
    
    if (tasks.length > 0) {
      const taskAssigneeId = tasks[0].assigneeId;
      const userId = user.id;
      const match = taskAssigneeId === userId;
      
      console.log(`   User ID:        ${userId}`);
      console.log(`   Task Assigned:  ${taskAssigneeId}`);
      console.log(`   ${match ? "✅ IDs MATCH!" : "❌ IDs DO NOT MATCH"}`);
      
      if (!match) {
        console.log("\n📝 This means:");
        console.log("   - The task was assigned to a different user");
        console.log("   - Make sure you selected the right provider in the dropdown");
        console.log("   - Or you're logged in as the wrong provider account");
      }
    }
  } catch (e) {
    console.error("❌ Comparison failed:", e.message);
  }
}

// Test 4: Provider-specific check
console.log("\n4️⃣  PROVIDER-SIDE CHECK...");
try {
  const user = JSON.parse(localStorage.getItem('user'));
  const tasks = JSON.parse(localStorage.getItem('company-tasks') || '[]');
  
  if (user && tasks.length > 0) {
    const myTasks = tasks.filter(t => t.assigneeId === user.id);
    console.log(`   You have ${myTasks.length} task(s) assigned to you`);
    
    if (myTasks.length > 0) {
      console.log("✅ TASKS FOUND!");
      myTasks.forEach((task, index) => {
        console.log(`\n   📌 Task ${index + 1}: ${task.title}`);
        console.log(`      Status: ${task.status}`);
        console.log(`      Priority: ${task.priority}`);
      });
    } else {
      console.log("⚠️  No tasks assigned to you");
      console.log("   This could mean:");
      console.log("   1. The dropdown selected the wrong provider");
      console.log("   2. You're logged in as a different provider");
      console.log("   3. The task assigneeId doesn't match your user ID");
    }
  }
} catch (e) {
  console.error("❌ Provider check failed:", e.message);
}

// Test 5: Summary
console.log("\n%c=== SUMMARY ===", "color: green; font-size: 14px; font-weight: bold;");
try {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const tasks = JSON.parse(localStorage.getItem('company-tasks') || '[]');
  
  console.log(`Total tasks created: ${tasks.length}`);
  console.log(`Logged in as: ${user.name || 'Not logged in'}`);
  console.log(`Your ID: ${user.id || 'N/A'}`);
  
  if (user.id && tasks.length > 0) {
    const myTasks = tasks.filter(t => t.assigneeId === user.id);
    console.log(`Your tasks: ${myTasks.length}`);
    
    if (myTasks.length > 0) {
      console.log("%c✅ SUCCESS - Tasks are syncing!", "color: green; font-weight: bold;");
    } else {
      console.log("%c⚠️  NO TASKS - Check the troubleshooting guide", "color: orange; font-weight: bold;");
    }
  }
} catch (e) {
  console.error("Summary error:", e.message);
}

console.log("\n%c=== END OF VERIFICATION ===", "color: blue; font-size: 14px;");
console.log("📖 Full guide: Check TASK_SYNC_FIX.md file");
