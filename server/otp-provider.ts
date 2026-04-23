type SendOtpInput = {
  channel: "sms" | "email";
  destination: string;
  code: string;
  purpose: "signup_verify" | "login_verify";
};

type SendOtpResult = {
  provider: string;
  delivered: boolean;
};

const RESEND_API_URL = "https://api.resend.com/emails";

function getOtpContext(purpose: SendOtpInput["purpose"]) {
  return purpose === "login_verify" ? "sign in" : "complete your signup";
}

function getOtpMessage(code: string, purpose: SendOtpInput["purpose"]) {
  return `Your CityConnect verification code is ${code}. Use it to ${getOtpContext(purpose)}. It expires in 5 minutes.`;
}

function getOtpEmailHtml(code: string, purpose: SendOtpInput["purpose"]) {
  const context = getOtpContext(purpose);
  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #f7f4ec; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 32px; border: 1px solid #dde7dd;">
        <p style="margin: 0 0 12px; color: #0f5132; font-size: 14px; font-weight: 700;">CityConnect verification</p>
        <h1 style="margin: 0 0 16px; color: #10281f; font-size: 28px; line-height: 1.15;">Use this code to ${context}</h1>
        <p style="margin: 0 0 24px; color: #5d6f65; font-size: 16px; line-height: 1.6;">Enter the 6-digit code below in CityConnect. It expires in 5 minutes.</p>
        <div style="display: inline-block; letter-spacing: 8px; background: #eef7f0; border-radius: 18px; padding: 16px 20px; color: #0b4a2e; font-size: 32px; font-weight: 800;">${code}</div>
        <p style="margin: 28px 0 0; color: #7a8b82; font-size: 13px; line-height: 1.6;">If you did not request this code, you can ignore this email.</p>
      </div>
    </div>
  `;
}

function shouldUseConsoleFallback() {
  return process.env.NODE_ENV !== "production";
}

function logOtpToConsole(input: SendOtpInput, provider: string) {
  const message = getOtpMessage(input.code, input.purpose);
  console.info(
    `[otp:${provider}] ${input.channel.toUpperCase()} -> ${input.destination} :: ${message}`,
  );
}

async function sendEmailWithResend(input: SendOtpInput): Promise<SendOtpResult> {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.OTP_EMAIL_FROM || "").trim();

  if (!apiKey || !from) {
    if (shouldUseConsoleFallback()) {
      logOtpToConsole(input, "console");
      return { provider: "console", delivered: true };
    }

    throw new Error("OTP email delivery is not configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.destination],
      subject: "Your CityConnect verification code",
      text: getOtpMessage(input.code, input.purpose),
      html: getOtpEmailHtml(input.code, input.purpose),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("[otp:resend] Failed to send email OTP:", response.status, body.slice(0, 500));
    throw new Error("Unable to send verification email right now");
  }

  return {
    provider: "resend",
    delivered: true,
  };
}

export async function sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
  const provider =
    input.channel === "sms"
      ? process.env.OTP_SMS_PROVIDER || "console"
      : process.env.OTP_EMAIL_PROVIDER || "resend";

  if (input.channel === "email" && provider === "resend") {
    return sendEmailWithResend(input);
  }

  if (shouldUseConsoleFallback()) {
    logOtpToConsole(input, provider);
    return {
      provider,
      delivered: true,
    };
  }

  throw new Error(`${input.channel.toUpperCase()} OTP delivery is not configured`);
}
