import "./server/env.ts";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { requestConversationSettings } from "./shared/schema";
import { sql } from "drizzle-orm";

async function switchToOllama() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);
  try {
    console.log("🔄 Switching AI provider to Ollama with qwen2.5...\n");
    
    // Check if settings exist
    const existing = await db.select().from(requestConversationSettings).limit(1);
    
    if (existing.length > 0) {
      // Update existing settings
      await db
        .update(requestConversationSettings)
        .set({
          aiProvider: "ollama",
          aiModel: "qwen2.5:7b",
          aiTemperature: 0.7,
          updatedAt: new Date(),
        })
        .where(sql`id = ${existing[0].id}`);
      
      console.log("✅ Updated existing settings to use Ollama with qwen2.5:7b\n");
    } else {
      // Insert new settings
      await db.insert(requestConversationSettings).values({
        mode: "ai",
        aiProvider: "ollama",
        aiModel: "qwen2.5:7b",
        aiTemperature: 0.7,
        ordinaryPresentation: "chat",
      });
      
      console.log("✅ Created new settings with Ollama and qwen2.5:7b\n");
    }
    
    console.log("📋 Current AI settings:");
    const current = await db.select().from(requestConversationSettings).limit(1);
    if (current[0]) {
      console.log(`   Provider: ${current[0].aiProvider}`);
      console.log(`   Model: ${current[0].aiModel}`);
      console.log(`   Temperature: ${current[0].aiTemperature}`);
    }
    
    console.log("\n✅ Done! The AI chat will now use Ollama with qwen2.5:7b");
    console.log("   Restart the server to apply changes.\n");
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

switchToOllama();
