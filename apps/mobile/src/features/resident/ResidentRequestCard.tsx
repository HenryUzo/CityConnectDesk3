import { Pressable, StyleSheet, Text, View } from "react-native";
import { ServiceRequest } from "../../api/contracts";
import { formatDateTime, summarizeText } from "../../lib/format";
import { tokens } from "../../theme/tokens";
import { BodyText, SectionCard, StatusPill } from "../../components/ui";

type ResidentRequestCardProps = {
  request: ServiceRequest;
  onPress?: () => void;
  compact?: boolean;
};

export function ResidentRequestCard({
  request,
  onPress,
  compact = false,
}: ResidentRequestCardProps) {
  const content = (
    <SectionCard style={compact ? styles.compactCard : undefined}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{request.categoryLabel || request.category || "Request"}</Text>
          <Text style={styles.meta}>Updated {formatDateTime(request.updatedAt || request.createdAt)}</Text>
        </View>
        <StatusPill status={request.status} />
      </View>
      <Text style={styles.body}>{summarizeText(request.description, compact ? 100 : 180) || "No description yet."}</Text>
      <View style={styles.footer}>
        <BodyText muted>Location: {request.location || "Not specified"}</BodyText>
        {request.provider?.name || request.provider?.company ? (
          <BodyText muted>
            Provider: {request.provider?.company || request.provider?.name}
          </BodyText>
        ) : null}
      </View>
    </SectionCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    gap: tokens.spacing.sm,
  },
  compactCard: {
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: tokens.color.text,
  },
  meta: {
    fontSize: 12,
    color: tokens.color.textMuted,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.color.text,
  },
  footer: {
    gap: 4,
  },
});
