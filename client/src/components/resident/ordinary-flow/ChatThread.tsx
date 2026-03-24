import type { ReactNode } from "react";
import { ChatMessageBubble, type ChatRole } from "./ChatMessageBubble";
import { SystemMessage } from "./SystemMessage";
import { SystemEventCard } from "./SystemEventCard";
import { PaymentRequestCard } from "./PaymentRequestCard";
import { DeliveryConfirmationCard } from "./DeliveryConfirmationCard";
import { ConsultancyReportCard } from "./ConsultancyReportCard";

type ThreadMessageItem = {
  id: string;
  kind: "message";
  role: ChatRole;
  text: string;
  attachmentUrl?: string;
  timestamp?: string;
};

type ThreadSystemItem = {
  id: string;
  kind: "system";
  text: string;
};

type ThreadEventItem = {
  id: string;
  kind: "event";
  title: string;
  body: string;
  scheduleLabel?: string;
  countdownLabel?: string;
};

type ThreadPaymentItem = {
  id: string;
  kind: "payment";
  amountLabel: string;
  statusLabel: string;
  note?: string;
  requestedAt?: string;
  canPay?: boolean;
  onPay?: () => void;
  onDecline?: () => void;
  isPaying?: boolean;
  isDeclining?: boolean;
};

type ThreadDeliveryConfirmationItem = {
  id: string;
  kind: "delivery_confirmation";
  statusLabel: string;
  note?: string;
  requestedAt?: string;
  canConfirm?: boolean;
  onConfirm?: () => void;
  onDispute?: () => void;
  isConfirming?: boolean;
  isDisputing?: boolean;
};

type ThreadConsultancyReportItem = {
  id: string;
  kind: "consultancy_report";
  inspectionDate?: string;
  actualIssue: string;
  causeOfIssue: string;
  materialCostLabel: string;
  serviceCostLabel: string;
  preventiveRecommendation: string;
  timestamp?: string;
};

type ThreadDividerItem = {
  id: string;
  kind: "divider";
  text: string;
};

export type ThreadItem =
  | ThreadMessageItem
  | ThreadSystemItem
  | ThreadEventItem
  | ThreadPaymentItem
  | ThreadDeliveryConfirmationItem
  | ThreadConsultancyReportItem
  | ThreadDividerItem;

interface ChatThreadProps {
  items: ThreadItem[];
}

function ThreadCardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full justify-start">
      <div className="w-full max-w-[88%]">{children}</div>
    </div>
  );
}

export function ChatThread({ items }: ChatThreadProps) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        if (item.kind === "system") {
          return <SystemMessage key={item.id} text={item.text} />;
        }

        if (item.kind === "event") {
          return (
            <ThreadCardFrame key={item.id}>
              <SystemEventCard
                title={item.title}
                body={item.body}
                scheduleLabel={item.scheduleLabel}
                countdownLabel={item.countdownLabel}
              />
            </ThreadCardFrame>
          );
        }

        if (item.kind === "payment") {
          return (
            <ThreadCardFrame key={item.id}>
              <PaymentRequestCard
                amountLabel={item.amountLabel}
                statusLabel={item.statusLabel}
                note={item.note}
                requestedAt={item.requestedAt}
                canPay={item.canPay}
                onPay={item.onPay}
                onDecline={item.onDecline}
                isPaying={item.isPaying}
                isDeclining={item.isDeclining}
              />
            </ThreadCardFrame>
          );
        }

        if (item.kind === "delivery_confirmation") {
          return (
            <ThreadCardFrame key={item.id}>
              <DeliveryConfirmationCard
                statusLabel={item.statusLabel}
                note={item.note}
                requestedAt={item.requestedAt}
                canConfirm={item.canConfirm}
                onConfirm={item.onConfirm}
                onDispute={item.onDispute}
                isConfirming={item.isConfirming}
                isDisputing={item.isDisputing}
              />
            </ThreadCardFrame>
          );
        }

        if (item.kind === "consultancy_report") {
          return (
            <ThreadCardFrame key={item.id}>
              <ConsultancyReportCard
                inspectionDate={item.inspectionDate}
                actualIssue={item.actualIssue}
                causeOfIssue={item.causeOfIssue}
                materialCostLabel={item.materialCostLabel}
                serviceCostLabel={item.serviceCostLabel}
                preventiveRecommendation={item.preventiveRecommendation}
                timestamp={item.timestamp}
              />
            </ThreadCardFrame>
          );
        }

        if (item.kind === "divider") {
          return (
            <div key={item.id} className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                {item.text}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          );
        }

        return (
          <ChatMessageBubble
            key={item.id}
            role={item.role}
            text={item.text}
            attachmentUrl={item.attachmentUrl}
            timestamp={item.timestamp}
          />
        );
      })}
    </div>
  );
}
