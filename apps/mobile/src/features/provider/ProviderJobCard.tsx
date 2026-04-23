import { Pressable, StyleSheet, Text, View } from "react-native";
import { ServiceRequest } from "../../api/contracts";
import { formatDateTime, summarizeText } from "../../lib/format";
import { tokens } from "../../theme/tokens";
import { AppButton, BodyText, SectionCard, StatusPill } from "../../components/ui";

type ProviderJobCardProps = {
  request: ServiceRequest;
  onPress?: () => void;
  action?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
};

export function ProviderJobCard({ request, onPress, action }: ProviderJobCardProps) {
  const content = (
    <SectionCard>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{request.categoryLabel || request.category || "Job"}</Text>
          <Text style={styles.meta}>Updated {formatDateTime(request.updatedAt || request.createdAt)}</Text>
        </View>
        <StatusPill status={request.status} />
      </View>
      <Text style={styles.body}>{summarizeText(request.description, 180) || "No description provided."}</Text>
      <View style={styles.footer}>
        <BodyText muted>Location: {request.location || "Not specified"}</BodyText>
        <BodyText muted>Urgency: {request.urgency || "Not specified"}</BodyText>
      </View>
      {action ? (
        <AppButton onPress={action.onPress} disabled={action.disabled}>
          {action.label}
        </AppButton>
      ) : null}
    </SectionCard>
  );

  if (!onPress) return content;

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
  header: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
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
