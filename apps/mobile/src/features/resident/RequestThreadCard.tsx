import { StyleSheet, Text, View } from "react-native";
import { AppUser, RequestMessage } from "../../api/contracts";
import { formatDateTime } from "../../lib/format";
import { tokens } from "../../theme/tokens";
import { AppButton, BodyText, InputField, SectionCard, Title } from "../../components/ui";
import { getTypingLabel } from "./requestPresentation";

type RequestThreadCardProps = {
  user: AppUser | null;
  messages: RequestMessage[];
  typingState?: Record<string, unknown> | null;
  viewerRole?: "resident" | "provider" | "admin";
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  loading?: boolean;
  error?: string | null;
  title?: string;
  intro?: string;
  emptyTitle?: string;
  emptyBody?: string;
  composerPlaceholder?: string;
};

export function RequestThreadCard({
  user,
  messages,
  typingState,
  viewerRole = "resident",
  draft,
  onChangeDraft,
  onSend,
  sending = false,
  loading = false,
  error,
  title = "Chat",
  intro = "This thread uses the same `/api/service-requests/:id/messages` and typing endpoints as the current resident and provider web views.",
  emptyTitle = "No messages yet",
  emptyBody = "When support or the assigned provider replies, the thread will appear here.",
  composerPlaceholder = "Send a message",
}: RequestThreadCardProps) {
  const typingLabel = getTypingLabel(typingState, viewerRole);

  function getSenderLabel(message: RequestMessage, isOwnMessage: boolean) {
    if (isOwnMessage) return "You";
    if (message.senderRole === "admin") return "Support";
    if (message.senderRole === "provider") return "Provider";
    return "Resident";
  }

  return (
    <SectionCard>
      <Title>{title}</Title>
      <BodyText muted>{intro}</BodyText>
      {loading ? (
        <BodyText muted>Loading conversation...</BodyText>
      ) : error ? (
        <BodyText muted>{error}</BodyText>
      ) : !messages.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      ) : (
        <View style={styles.thread}>
          {messages.map((message) => {
            const isOwnMessage = message.senderId === user?.id;
            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isOwnMessage ? styles.messageRowOwn : styles.messageRowOther,
                ]}
              >
                <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
                  <Text style={styles.messageRole}>{getSenderLabel(message, isOwnMessage)}</Text>
                  <Text style={styles.messageBody}>{message.message}</Text>
                  <Text style={styles.messageMeta}>{formatDateTime(message.createdAt)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {typingLabel ? <BodyText muted>{typingLabel}</BodyText> : null}
      <InputField multiline placeholder={composerPlaceholder} value={draft} onChangeText={onChangeDraft} />
      <AppButton onPress={onSend} disabled={sending || !draft.trim()}>
        {sending ? "Sending..." : "Send message"}
      </AppButton>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: 4,
    backgroundColor: tokens.color.surfaceMuted,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: tokens.color.text,
  },
  emptyBody: {
    fontSize: 13,
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  thread: {
    gap: tokens.spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 4,
  },
  ownBubble: {
    backgroundColor: tokens.color.primarySoft,
  },
  otherBubble: {
    backgroundColor: tokens.color.surfaceMuted,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "500",
    color: tokens.color.primary,
    textTransform: "capitalize",
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.color.text,
  },
  messageMeta: {
    fontSize: 11,
    color: tokens.color.textMuted,
  },
});
