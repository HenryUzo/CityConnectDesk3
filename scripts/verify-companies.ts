import { db, dbReady } from "../server/db";
import { companies } from "@shared/schema";
import { desc } from "drizzle-orm";

async function verifyCompanies() {
  await dbReady;
  
  console.log("Fetching all companies from the database...\n");
  
  const allCompanies = await db
    .select()
    .from(companies)
    .orderBy(desc(companies.createdAt));

  if (allCompanies.length === 0) {
    console.log("❌ No companies found in the database.");
    return;
  }

  console.log(`✅ Found ${allCompanies.length} company(ies):\n`);
  
  allCompanies.forEach((company, index) => {
    console.log(`${index + 1}. ${company.name}`);
    console.log(`   ID: ${company.id}`);
    if (company.description) console.log(`   Description: ${company.description}`);
    if (company.contactEmail) console.log(`   Email: ${company.contactEmail}`);
    if (company.phone) console.log(`   Phone: ${company.phone}`);
    console.log(`   Created: ${company.createdAt}`);
    console.log();
  });
}

verifyCompanies().catch(console.error).finally(() => process.exit(0));
