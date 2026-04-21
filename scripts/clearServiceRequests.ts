import { isNotNull } from "drizzle-orm";
import { count } from "drizzle-orm";
import { db, dbReady } from "../server/db";
import {
  aiPreparedRequests,
  aiSessionAttachments,
  aiSessionMessages,
  aiSessions,
  companyTaskUpdates,
  companyTasks,
  conversationMessages,
  conversations,
  inspections,
  notifications,
  requestMessages,
  requestBillItems,
  requestBills,
  serviceRequests,
  transactions,
} from "../shared/schema";

async function clearServiceRequests() {
  await dbReady;

  // Delete in FK-safe order.
  await db.delete(conversationMessages);
  await db.delete(conversations);

  await db.delete(aiSessionAttachments);
  await db.delete(aiSessionMessages);
  await db.delete(aiSessions);
  await db.delete(aiPreparedRequests);

  await db.delete(companyTaskUpdates);
  await db.delete(companyTasks);
  await db.delete(inspections);
  await db.delete(requestBillItems);
  await db.delete(requestBills);

  await db.delete(requestMessages);
  await db.delete(notifications);
  await db.delete(transactions).where(isNotNull(transactions.serviceRequestId));
  await db.delete(serviceRequests);

  const tablesToVerify = [
    ["service_requests", serviceRequests],
    ["request_messages", requestMessages],
    ["notifications", notifications],
    ["conversations", conversations],
    ["conversation_messages", conversationMessages],
    ["company_tasks", companyTasks],
    ["company_task_updates", companyTaskUpdates],
    ["inspections", inspections],
    ["request_bills", requestBills],
    ["request_bill_items", requestBillItems],
  ] as const;

  const verification: Record<string, number> = {};
  for (const [name, table] of tablesToVerify) {
    const [row] = await db.select({ c: count() }).from(table);
    verification[name] = Number(row?.c ?? 0);
  }

  // eslint-disable-next-line no-console
  console.log(
    "Cleared service requests, jobs/tasks, billing, messages, conversations, related transactions, and AI prep snapshots.",
  );
  // eslint-disable-next-line no-console
  console.log("Verification counts:", verification);
}

clearServiceRequests().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to clear service requests:", error);
  process.exitCode = 1;
});
