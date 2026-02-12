import { Client } from "pg";

const connectionString =
  "postgresql://postgres:MyHoneyPie@localhost:5432/cityconnectdesk?schema=public";

const provider = process.argv[2] || "ollama";

const client = new Client({ connectionString });
await client.connect();
const res = await client.query(
  "UPDATE request_conversation_settings SET ai_provider = $1, updated_at = NOW() RETURNING id, ai_provider, updated_at;",
  [provider],
);
console.log(res.rows);
await client.end();
