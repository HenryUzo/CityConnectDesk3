import { isNotNull } from "drizzle-orm";
import { db, dbReady } from "../server/db";
import {
  aiPreparedRequests,
  aiSessionAttachments,
  aiSessionMessages,
  aiSessions,
  conversationMessages,
  conversations,
  requestMessages,
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

  await db.delete(requestMessages);
  await db.delete(transactions).where(isNotNull(transactions.serviceRequestId));
  await db.delete(serviceRequests);

  // eslint-disable-next-line no-console
  console.log(
    "Cleared service_requests, request_messages, related transactions, conversations, and AI prep snapshots.",
  );
}

clearServiceRequests().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to clear service requests:", error);
  process.exitCode = 1;
});