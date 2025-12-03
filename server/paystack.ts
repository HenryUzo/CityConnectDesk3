import crypto from "node:crypto";

const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured. Set it in your server environment.",
    );
  }
  return key;
}

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: string;
    amount: number;
    currency: string;
    reference: string;
    paid_at?: string;
    created_at?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifyResponse> {
  const secretKey = getSecretKey();
  const res = await fetch(
    `${PAYSTACK_API_BASE}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Paystack verify failed (${res.status} ${res.statusText}): ${text.slice(
        0,
        200,
      )}`,
    );
  }

  return (await res.json()) as PaystackVerifyResponse;
}

export function validatePaystackSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;

  const secretKey = getSecretKey();
  // Security: Paystack signs webhook payloads with sha512(secret, body).
  const computed = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  return computed === signatureHeader;
}
