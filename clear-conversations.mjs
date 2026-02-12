import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearConversations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM ai_session_attachments");
    await client.query("DELETE FROM ai_session_messages");
    await client.query("DELETE FROM ai_sessions");
    await client.query("DELETE FROM conversation_messages");
    await client.query("DELETE FROM conversations");
    // Optional: clear AI prepared request snapshots (if present)
    try {
      await client.query("DELETE FROM ai_prepared_requests");
    } catch {
      // ignore if table doesn't exist
    }
    await client.query("COMMIT");
    console.log("? Cleared conversations and AI sessions");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

clearConversations().catch((err) => {
  console.error("? Failed to clear conversations", err);
  process.exit(1);
});
