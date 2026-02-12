const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }
  return key;
}

type InitializePaystackTransactionArgs = {
  email: string;
  amountInNaira: number;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function initializePaystackTransaction({
  email,
  amountInNaira,
  reference,
  callbackUrl,
  metadata = {},
}: InitializePaystackTransactionArgs) {
  if (!email) {
    throw new Error("Email is required to initialize a Paystack transaction.");
  }
  if (typeof amountInNaira !== "number" || amountInNaira <= 0) {
    throw new Error("amountInNaira must be a positive number.");
  }

  const secretKey = getSecretKey();
  const payload = {
    email,
    amount: Math.round(amountInNaira * 100),
    metadata,
    ...(reference ? { reference } : {}),
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  };

  try {
    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Paystack API response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("Paystack init failed", { 
        status: response.status, 
        body: text,
        payload: { email, amount: payload.amount }
      });
      throw new Error(
        `Paystack initialization failed (${response.status}): ${text}`,
      );
    }

    const data = await response.json();
    console.log("Paystack response data:", {
      status: data?.status,
      hasAuthUrl: !!data?.data?.authorization_url,
      hasReference: !!data?.data?.reference,
    });

    if (!data?.status || !data?.data?.authorization_url || !data?.data?.reference) {
      console.error("Invalid Paystack response:", data);
      throw new Error("Invalid response from Paystack.");
    }

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  } catch (error: any) {
    console.error("Paystack initialization error", {
      message: error?.message,
      stack: error?.stack,
      email,
      amountInNaira,
    });
    throw new Error("Unable to initialize Paystack payment at this time.");
  }
}
