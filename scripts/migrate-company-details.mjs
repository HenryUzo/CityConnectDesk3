#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function safeParse(obj) {
  if (!obj) return {};
  if (typeof obj === 'string') {
    try { return JSON.parse(obj); } catch { return {}; }
  }
  return obj;
}

function cleanEmpty(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) {
      out[k] = v;
    }
  }
  return out;
}

async function main(){
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT id, details, business_details, bank_details, location_details, submitted_at FROM companies');
    let updated = 0;
    for (const row of res.rows) {
      const id = row.id;
      const details = await safeParse(row.details);
      const existingBusiness = row.business_details;
      const existingBank = row.bank_details;
      const existingLocation = row.location_details;
      const existingSubmitted = row.submitted_at;

      // Map business details
      const b = await safeParse(details.businessDetails || details.business_details || {});
      const businessDetails = cleanEmpty({
        taxId: b.taxId ?? b.tax_id ?? details.taxId ?? details.tax_id,
        industry: b.industry ?? details.industry,
        businessType: b.businessType ?? b.business_type ?? details.businessType ?? details.business_type,
        yearEstablished: b.yearEstablished ?? b.year_established ?? details.yearEstablished ?? details.year_established,
        registrationNumber: b.registrationNumber ?? b.registration_number ?? details.registrationNumber ?? details.registration_number,
      });

      // Map bank details
      const bk = await safeParse(details.bankDetails || details.bank_details || {});
      const bankDetails = cleanEmpty({
        bankName: bk.bankName ?? bk.bank_name ?? details.bankName ?? details.bank_name,
        accountName: bk.accountName ?? bk.account_name ?? details.accountName ?? details.account_name,
        accountNumber: bk.accountNumber ?? bk.account_number ?? details.accountNumber ?? details.account_number,
        swiftCode: bk.swiftCode ?? bk.swift_code ?? details.swiftCode ?? details.swift_code,
        routingNumber: bk.routingNumber ?? bk.routing_number ?? details.routingNumber ?? details.routing_number,
      });

      // Map location details
      const l = await safeParse(details.locationDetails || details.location_details || {});
      const coords = await safeParse(l.coordinates || details.coordinates || {});
      const locationDetails = cleanEmpty({
        addressLine1: l.addressLine1 ?? l.address_line1 ?? details.addressLine1 ?? details.address_line1,
        city: l.city ?? details.city,
        lga: l.lga ?? details.lga,
        state: l.state ?? details.state,
        country: l.country ?? details.country,
        latitude: coords.latitude ?? l.latitude ?? details.latitude ?? undefined,
        longitude: coords.longitude ?? l.longitude ?? details.longitude ?? undefined,
      });

      const submittedAtRaw = details.submittedAt ?? details.submitted_at ?? undefined;
      const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : undefined;

      const shouldUpdate = (
        (Object.keys(businessDetails).length > 0 && !existingBusiness) ||
        (Object.keys(bankDetails).length > 0 && !existingBank) ||
        (Object.keys(locationDetails).length > 0 && !existingLocation) ||
        (submittedAt && !existingSubmitted)
      );

      if (shouldUpdate) {
        await client.query(
          `UPDATE companies SET business_details = COALESCE(business_details, $1::jsonb), bank_details = COALESCE(bank_details, $2::jsonb), location_details = COALESCE(location_details, $3::jsonb), submitted_at = COALESCE(submitted_at, $4) WHERE id = $5`,
          [
            Object.keys(businessDetails).length ? JSON.stringify(businessDetails) : null,
            Object.keys(bankDetails).length ? JSON.stringify(bankDetails) : null,
            Object.keys(locationDetails).length ? JSON.stringify(locationDetails) : null,
            submittedAt || null,
            id
          ]
        );
        updated++;
      }
    }
    await client.query('COMMIT');
    console.log('Migration complete. Rows updated:', updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
