export type AppErrorActionKind =
  | "close"
  | "navigate"
  | "reload"
  | "back"
  | "dashboard"
  | "contact";

export type AppErrorAction = {
  label: string;
  kind: AppErrorActionKind;
  href?: string;
};

export type AppErrorTone = "danger" | "warning" | "info";

export type AppErrorPresentation = {
  title: string;
  message: string;
  nextStep: string;
  tone: AppErrorTone;
  primaryAction: AppErrorAction;
  secondaryAction?: AppErrorAction;
  technicalDetails?: string;
};

export type AppErrorInput = {
  title?: unknown;
  description?: unknown;
  error?: unknown;
  source?: string;
};

type HttpErrorInit = {
  status?: number;
  statusText?: string;
  url?: string;
  responseBody?: string;
  responseJson?: unknown;
  kind?: "http" | "network" | "unexpected";
  cause?: unknown;
};

export class AppRequestError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  responseBody?: string;
  responseJson?: unknown;
  kind: "http" | "network" | "unexpected";

  constructor(message: string, init: HttpErrorInit = {}) {
    super(message);
    this.name = "AppRequestError";
    this.status = init.status;
    this.statusText = init.statusText;
    this.url = init.url;
    this.responseBody = init.responseBody;
    this.responseJson = init.responseJson;
    this.kind = init.kind || "http";

    if (init.cause !== undefined) {
      try {
        (this as Error & { cause?: unknown }).cause = init.cause;
      } catch {
        // Older runtimes may not allow assigning cause.
      }
    }
  }
}

function toPlainText(value: unknown): string {
  if (value == null || value === false) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toPlainText).filter(Boolean).join(" ");
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    const maybe = value as { message?: unknown; error?: unknown; title?: unknown };
    return toPlainText(maybe.message || maybe.error || maybe.title);
  }
  return "";
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function getMessageFromJson(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return toPlainText(
    record.error ||
      record.message ||
      record.details ||
      record.reason ||
      record.code,
  );
}

function extractHttpShape(input: AppErrorInput) {
  const error = input.error;
  const description = toPlainText(input.description);
  const title = toPlainText(input.title);
  const baseMessage = toPlainText(error) || description;

  if (error instanceof AppRequestError) {
    const bodyJson =
      error.responseJson !== undefined
        ? error.responseJson
        : error.responseBody
          ? tryParseJson(error.responseBody)
          : undefined;
    const backendMessage = getMessageFromJson(bodyJson) || error.responseBody || error.message;
    return {
      title,
      description,
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      bodyText: error.responseBody || "",
      backendMessage,
      kind: error.kind,
    };
  }

  const raw = [baseMessage, description].filter(Boolean).join("\n");
  const httpMatch = raw.match(/^(\d{3})(?:\s+([^\n@]*?))?\s*@\s*([^\n]+)\n?([\s\S]*)?$/);
  if (httpMatch) {
    const bodyText = httpMatch[4] || "";
    const bodyJson = tryParseJson(bodyText);
    return {
      title,
      description,
      status: Number(httpMatch[1]),
      statusText: (httpMatch[2] || "").trim(),
      url: httpMatch[3]?.trim(),
      bodyText,
      backendMessage: getMessageFromJson(bodyJson) || bodyText,
      kind: "http" as const,
    };
  }

  const networkMatch = raw.match(/^Network error fetching\s+([^:]+):\s*([\s\S]+)$/i);
  if (networkMatch) {
    return {
      title,
      description,
      url: networkMatch[1]?.trim(),
      bodyText: raw,
      backendMessage: networkMatch[2]?.trim() || raw,
      kind: "network" as const,
    };
  }

  return {
    title,
    description,
    bodyText: raw,
    backendMessage: baseMessage || description || title,
    kind: undefined,
  };
}

function detailsFrom(input: ReturnType<typeof extractHttpShape>) {
  const lines = [
    input.status ? `Status: ${input.status}${input.statusText ? ` ${input.statusText}` : ""}` : "",
    input.url ? `URL: ${input.url}` : "",
    input.backendMessage ? `Message: ${input.backendMessage}` : "",
    input.bodyText && input.bodyText !== input.backendMessage ? `Body: ${input.bodyText}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function matchAny(text: string, patterns: Array<string | RegExp>) {
  return patterns.some((pattern) =>
    typeof pattern === "string" ? text.includes(pattern.toLowerCase()) : pattern.test(text),
  );
}

function close(label: string): AppErrorAction {
  return { label, kind: "close" };
}

export function presentAppError(input: AppErrorInput): AppErrorPresentation {
  const extracted = extractHttpShape(input);
  const combined = [
    extracted.title,
    extracted.description,
    extracted.backendMessage,
    extracted.statusText,
    extracted.url,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const technicalDetails = detailsFrom(extracted);

  const withDetails = (
    presentation: Omit<AppErrorPresentation, "technicalDetails">,
  ): AppErrorPresentation => ({
    ...presentation,
    technicalDetails: technicalDetails || undefined,
  });

  if (matchAny(combined, ["invalid credentials"])) {
    return withDetails({
      title: "Check your login details",
      message: "Those details don't match any CityConnect account. Check your email, password, or access code.",
      nextStep: "Try again, or create an account if you are new to CityConnect.",
      tone: "warning",
      primaryAction: close("Try again"),
      secondaryAction: { label: "Create account", kind: "navigate", href: "/auth" },
    });
  }

  if (matchAny(combined, ["account is inactive"])) {
    return withDetails({
      title: "Account inactive",
      message: "This account is currently inactive. An admin may need to reactivate it.",
      nextStep: "Contact support or go back to sign in with another account.",
      tone: "warning",
      primaryAction: { label: "Contact support", kind: "contact" },
      secondaryAction: { label: "Back to sign in", kind: "navigate", href: "/auth" },
    });
  }

  if (matchAny(combined, ["user already exists"])) {
    return withDetails({
      title: "Account already exists",
      message: "An account already exists with these details.",
      nextStep: "Sign in instead, or use a different email or phone number.",
      tone: "info",
      primaryAction: { label: "Sign in instead", kind: "navigate", href: "/auth" },
      secondaryAction: close("Use another email/phone"),
    });
  }

  if (matchAny(combined, ["username already exists"])) {
    return withDetails({
      title: "Username already taken",
      message: "That username is already taken.",
      nextStep: "Edit the username or sign in if this is already your account.",
      tone: "warning",
      primaryAction: close("Edit details"),
      secondaryAction: { label: "Sign in instead", kind: "navigate", href: "/auth" },
    });
  }

  if (matchAny(combined, ["phone number already exists"])) {
    return withDetails({
      title: "Phone already connected",
      message: "This phone number is already connected to an account.",
      nextStep: "Sign in instead, or use another phone number.",
      tone: "info",
      primaryAction: { label: "Sign in instead", kind: "navigate", href: "/auth" },
      secondaryAction: close("Use another phone"),
    });
  }

  if (matchAny(combined, ["invalid access code"])) {
    return withDetails({
      title: "Check your access code",
      message: "That estate access code is not valid. Check the code from your estate admin.",
      nextStep: "Try another code, or select your estate if open registration is available.",
      tone: "warning",
      primaryAction: close("Try another code"),
      secondaryAction: close("Select estate instead"),
    });
  }

  if (matchAny(combined, ["access code not allowed"])) {
    return withDetails({
      title: "Access code mismatch",
      message: "This code doesn't match the selected estate setup.",
      nextStep: "Check the access code or select the correct estate.",
      tone: "warning",
      primaryAction: close("Check access code"),
      secondaryAction: close("Select estate"),
    });
  }

  if (matchAny(combined, ["estate not found"])) {
    return withDetails({
      title: "Estate not found",
      message: "We couldn't find that estate.",
      nextStep: "Select another estate or contact your estate admin.",
      tone: "warning",
      primaryAction: close("Select another estate"),
      secondaryAction: { label: "Contact support", kind: "contact" },
    });
  }

  if (matchAny(combined, ["estate does not allow open registration"])) {
    return withDetails({
      title: "Access code required",
      message: "This estate requires approval or an access code before residents can join.",
      nextStep: "Enter the estate access code or contact your estate admin.",
      tone: "info",
      primaryAction: close("Enter access code"),
      secondaryAction: { label: "Contact support", kind: "contact" },
    });
  }

  if (matchAny(combined, ["otp challenge not found"])) {
    return withDetails({
      title: "Verification session not found",
      message: "We couldn't find that verification session. Start again to get a fresh code.",
      nextStep: "Restart verification from the sign-in form.",
      tone: "warning",
      primaryAction: { label: "Restart verification", kind: "navigate", href: "/auth" },
      secondaryAction: close("Back to form"),
    });
  }

  if (matchAny(combined, ["otp challenge is no longer active"])) {
    return withDetails({
      title: "Verification no longer active",
      message: "This verification session is no longer active.",
      nextStep: "Send a new code or go back to the form.",
      tone: "warning",
      primaryAction: close("Send new code"),
      secondaryAction: close("Back to form"),
    });
  }

  if (matchAny(combined, ["otp code has expired", "pending registration has expired"])) {
    return withDetails({
      title: "Code expired",
      message: "That code has expired. Request a new one to continue.",
      nextStep: "Send a new code, then enter the latest 6 digits.",
      tone: "warning",
      primaryAction: close("Send new code"),
      secondaryAction: close("Back to form"),
    });
  }

  if (matchAny(combined, ["invalid verification code"])) {
    return withDetails({
      title: "Code did not match",
      message: "That code didn't match. Check the 6 digits and try again.",
      nextStep: "Use the latest code sent to your phone or email.",
      tone: "warning",
      primaryAction: close("Try again"),
      secondaryAction: close("Resend code"),
    });
  }

  if (matchAny(combined, ["too many invalid attempts"])) {
    return withDetails({
      title: "Too many attempts",
      message: "There were too many failed attempts, so this code was locked.",
      nextStep: "Send a new code before trying again.",
      tone: "warning",
      primaryAction: close("Send new code"),
      secondaryAction: close("Back to form"),
    });
  }

  if (matchAny(combined, [/please wait \d+ seconds before requesting another code/])) {
    return withDetails({
      title: "Please wait before resending",
      message: "Please wait a few seconds before requesting another code.",
      nextStep: "Use the countdown on the verification screen, then resend if needed.",
      tone: "info",
      primaryAction: close("Okay"),
    });
  }

  if (
    extracted.status !== 401 &&
    matchAny(combined, ["payment", "paystack", "transaction"]) &&
    matchAny(combined, ["verification failed", "verify", "confirm"])
  ) {
    return withDetails({
      title: "Payment not confirmed yet",
      message: "We couldn't confirm the payment yet.",
      nextStep: "Retry verification. If payment was deducted, do not pay again until support checks it.",
      tone: "warning",
      primaryAction: close("Retry verification"),
      secondaryAction: { label: "View account", kind: "dashboard" },
    });
  }

  if (extracted.status === 413 || (!extracted.status && matchAny(combined, ["upload", "image", "photo", "file"]))) {
    return withDetails({
      title: "File could not be uploaded",
      message: "That file could not be uploaded. Try a smaller image or a supported format.",
      nextStep: "Choose another file and try again.",
      tone: "warning",
      primaryAction: close("Choose another file"),
      secondaryAction: close("Close"),
    });
  }

  if (
    extracted.kind === "network" ||
    matchAny(combined, ["cors blocked", "failed to fetch", "networkerror", "load failed"])
  ) {
    return withDetails({
      title: "Connection problem",
      message: "CityConnect can't be reached right now. This may be a connection or server configuration issue.",
      nextStep: "Try again. If it keeps happening, sign in again or contact support.",
      tone: "warning",
      primaryAction: close("Try again"),
      secondaryAction: { label: "Back to sign in", kind: "navigate", href: "/auth" },
    });
  }

  if (extracted.kind === "unexpected" || matchAny(combined, ["expected json", "got html", "unexpected page"])) {
    return withDetails({
      title: "Unexpected server response",
      message: "The server returned an unexpected page instead of app data.",
      nextStep: "Refresh the page. If it continues, contact support with the technical details.",
      tone: "warning",
      primaryAction: { label: "Refresh page", kind: "reload" },
      secondaryAction: { label: "Contact support", kind: "contact" },
    });
  }

  if (extracted.status === 401 || matchAny(combined, ["unauthorized", "authentication required"])) {
    return withDetails({
      title: "Sign in needed",
      message: "Your sign-in session is missing or has expired. Please sign in again to continue.",
      nextStep: "Sign in again, then retry the action.",
      tone: "info",
      primaryAction: { label: "Sign in again", kind: "navigate", href: "/auth" },
      secondaryAction: close("Try again"),
    });
  }

  if (extracted.status === 403 || matchAny(combined, ["forbidden", "permission"])) {
    return withDetails({
      title: "Access not available",
      message: "You don't have permission to view or change this area.",
      nextStep: "Go back to your dashboard or sign in with another account.",
      tone: "warning",
      primaryAction: { label: "Go to dashboard", kind: "dashboard" },
      secondaryAction: { label: "Sign in with another account", kind: "navigate", href: "/auth" },
    });
  }

  if (extracted.status === 404 || matchAny(combined, ["not found"])) {
    return withDetails({
      title: "Record not found",
      message: "We couldn't find that record. It may have been moved, removed, or refreshed elsewhere.",
      nextStep: "Go back or refresh the page before trying again.",
      tone: "warning",
      primaryAction: { label: "Go back", kind: "back" },
      secondaryAction: { label: "Refresh page", kind: "reload" },
    });
  }

  if (extracted.status === 429 || matchAny(combined, ["too many requests", "rate limit"])) {
    return withDetails({
      title: "Too many attempts",
      message: "Too many attempts were made in a short time.",
      nextStep: "Wait a moment, then try again.",
      tone: "warning",
      primaryAction: close("Okay"),
    });
  }

  if (extracted.status === 400 || matchAny(combined, ["validation", "required", "invalid"])) {
    return withDetails({
      title: "Review the details",
      message: "Some details need attention before we can continue.",
      nextStep: extracted.backendMessage || "Review the form fields and try again.",
      tone: "warning",
      primaryAction: close("Review fields"),
      secondaryAction: close("Close"),
    });
  }

  if (extracted.status && extracted.status >= 500) {
    return withDetails({
      title: "Something went wrong",
      message: "Something went wrong on our side. Your data is safe, but the action did not complete.",
      nextStep: "Try again. If the issue continues, contact support with the technical details.",
      tone: "danger",
      primaryAction: close("Try again"),
      secondaryAction: { label: "Contact support", kind: "contact" },
    });
  }

  return withDetails({
    title: extracted.title || "Something needs attention",
    message: extracted.backendMessage || "The action could not be completed.",
    nextStep: "Try again or contact support if the issue continues.",
    tone: "warning",
    primaryAction: close("Try again"),
    secondaryAction: close("Close"),
  });
}

export async function createAppRequestErrorFromResponse(
  res: Response,
  url: string,
  bodyLimit = 300,
) {
  const contentType = res.headers.get("content-type") || "";
  let bodyText = "";
  let responseJson: unknown;

  try {
    if (contentType.includes("application/json")) {
      responseJson = await res.json();
      bodyText = JSON.stringify(responseJson);
    } else {
      bodyText = await res.text();
    }
  } catch {
    bodyText = "";
  }

  const backendMessage = getMessageFromJson(responseJson) || bodyText.slice(0, bodyLimit).trim();
  const message = backendMessage || res.statusText || "Request failed";

  return new AppRequestError(message, {
    status: res.status,
    statusText: res.statusText,
    url,
    responseBody: bodyText.slice(0, bodyLimit),
    responseJson,
    kind: "http",
  });
}

export function createNetworkRequestError(url: string, error: unknown) {
  const message = toPlainText(error) || "Network request failed";
  return new AppRequestError(message, {
    url,
    responseBody: message,
    kind: "network",
    cause: error,
  });
}

export function createUnexpectedResponseError(url: string, contentType: string, bodyText: string) {
  return new AppRequestError("The server returned an unexpected response.", {
    url,
    responseBody: `Expected JSON but got ${contentType || "unknown content type"}\n${bodyText.slice(0, 300)}`,
    kind: "unexpected",
  });
}
