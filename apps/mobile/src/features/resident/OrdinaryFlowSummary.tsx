import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, BodyText, SectionCard, Title } from "../../components/ui";
import { tokens } from "../../theme/tokens";
import { font } from "../../theme/typography";
import { OrdinaryFlowSummaryItem } from "./ordinaryFlowAdapter";

type Props = {
  items: OrdinaryFlowSummaryItem[];
  onEditItem: (item: OrdinaryFlowSummaryItem) => void;
  onFinalize: () => void;
  onBack: () => void;
  finalizing?: boolean;
};

export function OrdinaryFlowSummary({ items, onEditItem, onFinalize, onBack, finalizing = false }: Props) {
  return (
    <View style={styles.stack}>
      <SectionCard>
        <Title>Review your request</Title>
        <BodyText muted>
          Confirm the details below before the mobile client creates the real request and switches into the live thread.
        </BodyText>
      </SectionCard>

      {items.map((item) => (
        <SectionCard key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Pressable onPress={() => onEditItem(item)} style={styles.editChip}>
              <Text style={styles.editChipText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.itemValue}>{item.value}</Text>
        </SectionCard>
      ))}

      <View style={styles.footerActions}>
        <AppButton variant="secondary" onPress={onBack}>
          Back to flow
        </AppButton>
        <AppButton onPress={onFinalize} disabled={finalizing}>
          {finalizing ? "Creating request..." : "Create request"}
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  itemCard: {
    gap: 10,
  },
  itemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  itemLabel: {
    ...font("500"),
    color: tokens.color.text,
    flex: 1,
    fontSize: 15,
  },
  editChip: {
    backgroundColor: tokens.color.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editChipText: {
    ...font("500"),
    color: tokens.color.primary,
    fontSize: 12,
  },
  itemValue: {
    ...font("400"),
    color: tokens.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  footerActions: {
    gap: 10,
    paddingBottom: 8,
  },
});
