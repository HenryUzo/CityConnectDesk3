import { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStatusMeta, tokens } from "../theme/tokens";
import { font } from "../theme/typography";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function AppScreen({ children, scroll = true, padded = true, style }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.screenContent,
        padded ? styles.screenPadding : null,
        style,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, padded ? styles.screenPadding : null, style]}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

export function SectionCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children }: PropsWithChildren) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function BodyText({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted ? styles.textMuted : null]}>{children}</Text>;
}

export function FieldLabel({ children }: PropsWithChildren) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function InputField(props: TextInputProps) {
  return <TextInput placeholderTextColor={tokens.color.textMuted} style={styles.input} {...props} />;
}

type ButtonProps = PropsWithChildren<{
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onPress?: () => void;
  disabled?: boolean;
}>;

export function AppButton({ children, variant = "primary", onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : null,
        variant === "ghost" ? styles.buttonGhost : null,
        variant === "danger" ? styles.buttonDanger : null,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" || variant === "ghost" ? styles.buttonTextDark : null,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ status }: { status?: string | null }) {
  const meta = getStatusMeta(status);
  const toneStyle =
    meta.tone === "success"
      ? styles.statusSuccess
      : meta.tone === "accent"
        ? styles.statusAccent
        : meta.tone === "warning"
          ? styles.statusWarning
          : meta.tone === "danger"
            ? styles.statusDanger
            : styles.statusNeutral;

  return (
    <View style={[styles.statusPill, toneStyle]}>
      <Text style={styles.statusText}>{meta.label}</Text>
    </View>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <SectionCard style={styles.centerCard}>
      <ActivityIndicator color={tokens.color.primary} />
      <BodyText muted>{label}</BodyText>
    </SectionCard>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <SectionCard style={styles.centerCard}>
      <Title>{title}</Title>
      <BodyText muted>{body}</BodyText>
      {action}
    </SectionCard>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  action,
}: {
  title?: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <SectionCard style={[styles.centerCard, styles.errorCard]}>
      <Title>{title}</Title>
      <BodyText muted>{body}</BodyText>
      {action}
    </SectionCard>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.color.background,
  },
  screenContent: {
    gap: tokens.spacing.md,
  },
  screenPadding: {
    padding: tokens.spacing.lg,
  },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 0,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    ...tokens.shadow.card,
  },
  centerCard: {
    alignItems: "center",
  },
  errorCard: {
    backgroundColor: tokens.color.dangerSoft,
  },
  heading: {
    ...font("700"),
    fontSize: tokens.type.heading,
    color: tokens.color.text,
  },
  title: {
    ...font("700"),
    fontSize: tokens.type.title,
    color: tokens.color.text,
  },
  body: {
    ...font("400"),
    fontSize: tokens.type.body,
    color: tokens.color.text,
    lineHeight: 22,
  },
  textMuted: {
    color: tokens.color.textMuted,
  },
  fieldLabel: {
    ...font("600"),
    fontSize: 13,
    color: tokens.color.text,
  },
  input: {
    ...font("400"),
    minHeight: 52,
    borderWidth: 0,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: tokens.type.body,
    color: tokens.color.text,
    backgroundColor: tokens.color.surfaceMuted,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.md,
  },
  buttonSecondary: {
    backgroundColor: tokens.color.surfaceMuted,
  },
  buttonGhost: {
    backgroundColor: tokens.color.surfaceMuted,
  },
  buttonDanger: {
    backgroundColor: tokens.color.danger,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    ...font("700"),
    color: "#FFFFFF",
    fontSize: 15,
  },
  buttonTextDark: {
    color: tokens.color.text,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    ...font("700"),
    fontSize: 12,
    textTransform: "capitalize",
    color: tokens.color.text,
  },
  statusSuccess: {
    backgroundColor: "#D1FADF",
  },
  statusAccent: {
    backgroundColor: "#D1E9FF",
  },
  statusWarning: {
    backgroundColor: "#FEF0C7",
  },
  statusDanger: {
    backgroundColor: "#FEE4E2",
  },
  statusNeutral: {
    backgroundColor: "#EAECF0",
  },
  keyValueRow: {
    gap: 4,
  },
  keyLabel: {
    ...font("700"),
    fontSize: 12,
    color: tokens.color.textMuted,
    textTransform: "uppercase",
  },
  keyValue: {
    ...font("400"),
    fontSize: tokens.type.body,
    color: tokens.color.text,
  },
});
