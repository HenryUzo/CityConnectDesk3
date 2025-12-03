declare global {
  interface Window {
    PaystackPop?: {
      setup(config: PaystackInlineConfig): PaystackInlineHandler;
    };
  }
}

type PaystackInlineConfig = {
  key: string;
  email: string;
  amount: number;
  ref: string;
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose?: () => void;
};

type PaystackInlineHandler = {
  openIframe: () => void;
};

const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v1/inline.js";
let loaderPromise: Promise<void> | null = null;

export function ensurePaystackScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack requires a browser environment"));
  }

  if (window.PaystackPop) {
    return Promise.resolve();
  }

  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PAYSTACK_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Paystack inline script"));
      document.body.appendChild(script);
    });
  }

  return loaderPromise;
}

type PaystackCheckoutOptions = {
  key: string;
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
};

export async function openPaystackCheckout(
  options: PaystackCheckoutOptions,
): Promise<void> {
  await ensurePaystackScript();

  if (!window.PaystackPop) {
    throw new Error("Paystack inline script failed to load");
  }

  const handler = window.PaystackPop.setup({
    key: options.key,
    email: options.email,
    amount: options.amountKobo,
    ref: options.reference,
    metadata: options.metadata,
    callback: (response) => options.onSuccess(response.reference),
    onClose: () => options.onCancel?.(),
  });

  handler.openIframe();
}

export {};
