import { cn } from "@/lib/utils";

type ChatRole = "resident" | "provider" | "admin";

interface ChatMessageBubbleProps {
  role: ChatRole;
  text: string;
  attachmentUrl?: string;
  timestamp?: string;
}

function detectAttachmentKind(attachmentUrl?: string) {
  if (!attachmentUrl) return null;
  const url = attachmentUrl.toLowerCase();
  if (url.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(url)) {
    return "image" as const;
  }
  if (url.startsWith("data:audio/") || /\.(mp3|wav|ogg|webm|m4a|aac)(\?|$)/.test(url)) {
    return "audio" as const;
  }
  return "file" as const;
}

export function ChatMessageBubble({ role, text, attachmentUrl, timestamp }: ChatMessageBubbleProps) {
  const isResident = role === "resident";
  const attachmentKind = detectAttachmentKind(attachmentUrl);
  const hasText = Boolean(text?.trim());

  return (
    <div className={cn("flex w-full", isResident ? "justify-end" : "justify-start")}>
      <div className="max-w-[68%] space-y-1.5">
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            isResident
              ? "rounded-br-md bg-[#039855] text-white shadow-[0_6px_16px_-12px_rgba(3,152,85,0.8)]"
              : "rounded-bl-md border border-[#E4E7EC] bg-[#FFFFFF] text-[#1D2939]",
          )}
        >
          {hasText ? <p className="whitespace-pre-wrap">{text}</p> : null}
          {attachmentUrl && attachmentKind === "image" ? (
            <img
              src={attachmentUrl}
              alt="Shared attachment"
              className={cn(
                "mt-2 max-h-60 w-full rounded-xl object-cover",
                hasText ? "border border-black/10" : "mt-0",
              )}
            />
          ) : null}
          {attachmentUrl && attachmentKind === "audio" ? (
            <audio
              controls
              src={attachmentUrl}
              className={cn("mt-2 w-full", hasText ? "" : "mt-0")}
            />
          ) : null}
          {attachmentUrl && attachmentKind === "file" ? (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-2 inline-block text-xs underline",
                isResident ? "text-white/90" : "text-[#175CD3]",
              )}
            >
              Open attachment
            </a>
          ) : null}
        </div>
        {timestamp ? (
          <p className={cn("px-1 text-[11px] text-[#98A2B3]", isResident ? "text-right" : "text-left")}>
            {new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type { ChatRole };
