import { ChatMessageBubble, type ChatRole } from "./ChatMessageBubble";
import { SystemMessage } from "./SystemMessage";
import { SystemEventCard } from "./SystemEventCard";
import { PaymentRequestCard } from "./PaymentRequestCard";
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

export type ThreadItem =
  | ThreadMessageItem
  | ThreadSystemItem
  | ThreadEventItem
  | ThreadPaymentItem
  | ThreadConsultancyReportItem;

interface ChatThreadProps {
  items: ThreadItem[];
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
            <SystemEventCard
              key={item.id}
              title={item.title}
              body={item.body}
              scheduleLabel={item.scheduleLabel}
              countdownLabel={item.countdownLabel}
            />
          );
        }

        if (item.kind === "payment") {
          return (
            <PaymentRequestCard
              key={item.id}
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
          );
        }

        if (item.kind === "consultancy_report") {
          return (
            <ConsultancyReportCard
              key={item.id}
              inspectionDate={item.inspectionDate}
              actualIssue={item.actualIssue}
              causeOfIssue={item.causeOfIssue}
              materialCostLabel={item.materialCostLabel}
              serviceCostLabel={item.serviceCostLabel}
              preventiveRecommendation={item.preventiveRecommendation}
              timestamp={item.timestamp}
            />
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
