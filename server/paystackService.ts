const PAYSTACK_API_BASE = "https://api.paystack.co";

type PaystackServiceError = Error & {
  status?: number;
  code?: string;
  details?: string;
};

function createPaystackError(
  message: string,
  options?: { status?: number; code?: string; details?: string },
): PaystackServiceError {
  const error = new Error(message) as PaystackServiceError;
  if (options?.status) error.status = options.status;
  if (options?.code) error.code = options.code;
  if (options?.details) error.details = options.details;
  return error;
}

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw createPaystackError("PAYSTACK_SECRET_KEY is not configured.", {
      status: 500,
      code: "PAYSTACK_CONFIG_MISSING",
    });
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

function normalizeCause(error: unknown) {
  const anyError = error as any;
  const cause = anyError?.cause;
  const code = String(cause?.code || anyError?.code || "").trim();
  const message = String(cause?.message || anyError?.message || "Unknown error");
  return { code, message };
}

function resolveNetworkErrorCode(rawCode: string, causeMessage: string, errorMessage: string) {
  const code = String(rawCode || "").trim().toUpperCase();
  const combined = `${causeMessage} ${errorMessage}`.toLowerCase();

  if (
    code === "23" ||
    code === "ABORT_ERR" ||
    combined.includes("aborted due to timeout") ||
    combined.includes("timed out") ||
    combined.includes("timeout")
  ) {
    return "PAYSTACK_TIMEOUT";
  }

  return code || "PAYSTACK_NETWORK_ERROR";
}

export async function initializePaystackTransaction({
  email,
  amountInNaira,
  reference,
  callbackUrl,
  metadata = {},
}: InitializePaystackTransactionArgs) {
  if (!email) {
    throw createPaystackError("Email is required to initialize a Paystack transaction.", {
      status: 400,
      code: "PAYSTACK_EMAIL_REQUIRED",
    });
  }
  if (typeof amountInNaira !== "number" || amountInNaira <= 0) {
    throw createPaystackError("amountInNaira must be a positive number.", {
      status: 400,
      code: "PAYSTACK_AMOUNT_INVALID",
    });
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
    const timeoutSignal = (AbortSignal as any)?.timeout
      ? ((AbortSignal as any).timeout(15_000) as AbortSignal)
      : undefined;

    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Paystack init failed", {
        status: response.status,
        body: text,
        payload: { email, amount: payload.amount },
      });

      throw createPaystackError("Paystack rejected transaction initialization.", {
        status: 502,
        code: "PAYSTACK_UPSTREAM_ERROR",
        details: `HTTP ${response.status}: ${text}`,
      });
    }

    const data = await response.json();
    if (!data?.status || !data?.data?.authorization_url || !data?.data?.reference) {
      console.error("Invalid Paystack response:", data);
      throw createPaystackError("Invalid response from Paystack.", {
        status: 502,
        code: "PAYSTACK_RESPONSE_INVALID",
      });
    }

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  } catch (error: any) {
    if (error?.status) {
      throw error;
    }

    const { code, message } = normalizeCause(error);
    const networkCodes = new Set([
      "ENOTFOUND",
      "EAI_AGAIN",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ECONNRESET",
      "ABORT_ERR",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ]);

    const looksNetworkRelated =
      networkCodes.has(code) ||
      /fetch failed/i.test(String(error?.message || "")) ||
      /network|connect|timeout|dns/i.test(message);

    if (looksNetworkRelated) {
      const resolvedCode = resolveNetworkErrorCode(code, message, String(error?.message || ""));

      console.error("Paystack initialization network error", {
        message: error?.message,
        causeCode: resolvedCode,
        rawCauseCode: code || undefined,
        causeMessage: message,
        email,
        amountInNaira,
      });

      throw createPaystackError(
        "Unable to reach Paystack right now. Check server internet/proxy/firewall and try again.",
        {
          status: 502,
          code: resolvedCode,
          details: message,
        },
      );
    }

    console.error("Paystack initialization error", {
      message: error?.message,
      stack: error?.stack,
      causeCode: code || undefined,
      causeMessage: message,
      email,
      amountInNaira,
    });

    throw createPaystackError("Unable to initialize Paystack payment at this time.", {
      status: 500,
      code: "PAYSTACK_INIT_FAILED",
      details: message,
    });
  }
}
