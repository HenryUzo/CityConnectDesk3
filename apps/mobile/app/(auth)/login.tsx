import { Link, router } from "expo-router";
import { PropsWithChildren, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { ApiError } from "../../src/api/client";
import { useSession } from "../../src/features/auth/session";
import { tokens } from "../../src/theme/tokens";
import { font } from "../../src/theme/typography";

const cityConnectLogoMark = require("../../assets/images/cityconnect-logo-mark-premium.png");
const cityConnectWordmark = require("../../assets/images/cityconnect-wordmark-premium.png");
const authButtonLeaves = require("../../assets/images/auth-button-leaves.png");
const authBackgroundBotanical = require("../../assets/images/auth-background-transparent.png");

const eco = {
  background: "#F6F4EE",
  primary: "#0B7A43",
  primaryPressed: "#09683A",
  text: "#103B2D",
  muted: "#667085",
  card: "#FCFCFA",
  inputFill: "#F2F4EE",
  inputBorder: "#DDE5D7",
  securePill: "#EEF5EB",
  divider: "#D9E2D4",
  leafTint: "#DDE8CE",
  dangerSoft: "#FEF3F2",
} as const;

function isMissingOtpRoute(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    /\/api\/mobile\/auth\/login\/start/i.test(error.message)
  );
}

type IconName = "alert" | "chevron" | "eye" | "eyeOff" | "keypad" | "lock" | "person" | "shield";

export default function LoginScreen() {
  const { startLogin, verifyLogin, resendOtp, legacyLogin } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordHidden, setPasswordHidden] = useState(true);

  useEffect(() => {
    if (!challengeId || resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [challengeId, resendCountdown]);

  const primaryPayload = useMemo(
    () =>
      accessCode.trim()
        ? { accessCode: accessCode.trim() }
        : { identifier: identifier.trim(), password },
    [accessCode, identifier, password],
  );

  async function handleLogin() {
    setSubmitting(true);
    setError("");
    try {
      const result = await startLogin(primaryPayload);
      setChallengeId(result.challengeId);
      setMaskedDestination(result.maskedDestination);
      setResendCountdown(result.resendAvailableIn || 0);
    } catch (err: unknown) {
      if (isMissingOtpRoute(err)) {
        try {
          await legacyLogin(primaryPayload);
          router.replace("/");
          return;
        } catch (legacyErr: any) {
          setError(String(legacyErr?.message || "Failed to sign in"));
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setSubmitting(true);
    setError("");
    try {
      await verifyLogin(challengeId, otpCode.trim());
      router.replace("/");
    } catch (err: any) {
      setError(String(err?.message || "Failed to verify code"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!challengeId || resendCountdown > 0) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await resendOtp(challengeId);
      setChallengeId(result.challengeId);
      setMaskedDestination(result.maskedDestination);
      setResendCountdown(result.resendAvailableIn || 0);
      setOtpCode("");
    } catch (err: any) {
      setError(String(err?.message || "Failed to resend code"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackgroundDecorations />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader />

        <View style={styles.centerColumn}>
          <AuthCard
            title={challengeId ? "Verification code" : "Welcome back"}
            subtitle={
              challengeId
                ? `Enter the code sent to ${maskedDestination} to finish signing in.`
                : "Use your password or resident access code."
            }
            badgeText={challengeId ? "OTP" : "Secure"}
            badgeIcon="shield"
          >
            {challengeId ? (
              <View style={styles.formBlock}>
                <View style={styles.otpRow}>
                  {Array.from({ length: 6 }, (_, index) => (
                    <View
                      key={`otp-${index}`}
                      style={[
                        styles.otpBox,
                        otpCode[index] ? styles.otpBoxFilled : null,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{otpCode[index] || "."}</Text>
                    </View>
                  ))}
                </View>

                <FormField
                  icon="keypad"
                  keyboardType="number-pad"
                  label="One-time code"
                  maxLength={6}
                  onChangeText={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                />

                <Text style={styles.helperText}>
                  We sent a verification code to {maskedDestination}. The code expires shortly for security.
                </Text>

                <ErrorBanner error={error} />

                <PrimaryButton onPress={handleVerify} disabled={submitting || otpCode.trim().length !== 6}>
                  {submitting ? "Verifying..." : "Verify and continue"}
                </PrimaryButton>
                <SecondaryButton
                  onPress={handleResend}
                  disabled={submitting || resendCountdown > 0}
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
                </SecondaryButton>
              </View>
            ) : (
              <View style={styles.formBlock}>
                <FormField
                  autoCapitalize="none"
                  icon="person"
                  label="Email, username, or phone"
                  onChangeText={setIdentifier}
                  placeholder="you@example.com"
                  value={identifier}
                />

                <FormField
                  icon="lock"
                  label="Password"
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={passwordHidden}
                  trailing={
                    <Pressable
                      accessibilityLabel={passwordHidden ? "Show password" : "Hide password"}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setPasswordHidden((value) => !value)}
                      style={styles.fieldIconButton}
                    >
                      <LineIcon name={passwordHidden ? "eye" : "eyeOff"} size={23} color="#386A47" />
                    </Pressable>
                  }
                  value={password}
                />

                <DividerOr />

                <FormField
                  icon="keypad"
                  keyboardType="number-pad"
                  label="Resident access code"
                  maxLength={6}
                  onChangeText={setAccessCode}
                  placeholder="Optional 6-digit code"
                  value={accessCode}
                />

                <ErrorBanner error={error} />

                <PrimaryButton onPress={handleLogin} disabled={submitting}>
                  {submitting ? "Continuing..." : "Sign in"}
                </PrimaryButton>
              </View>
            )}
          </AuthCard>

          <BottomAccountPrompt />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandBadge}>
          <Image source={cityConnectLogoMark} style={styles.brandMark} resizeMode="contain" />
        </View>
        <Image
          source={cityConnectWordmark}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="CityConnect"
        />
      </View>
    </View>
  );
}

function AuthCard({
  title,
  subtitle,
  badgeText,
  badgeIcon,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  badgeText: string;
  badgeIcon: IconName;
}>) {
  return (
    <View style={styles.authCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.securePill}>
          <LineIcon name={badgeIcon} size={18} color="#28613F" />
          <Text style={styles.securePillText}>{badgeText}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function FormField({
  label,
  icon,
  trailing,
  inputStyle,
  ...inputProps
}: TextInputProps & {
  label: string;
  icon: IconName;
  trailing?: ReactNode;
  inputStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputFrame, inputStyle]}>
        <LineIcon name={icon} size={23} color="#28613F" />
        <TextInput
          placeholderTextColor="#5F6B76"
          style={styles.input}
          {...inputProps}
        />
        {trailing}
      </View>
    </View>
  );
}

function DividerOr() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>OR</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function PrimaryButton({
  children,
  onPress,
  disabled,
}: PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled ? styles.primaryButtonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <ButtonLeafOverlay />
      <Text style={styles.primaryButtonText}>{children}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  children,
  onPress,
  disabled,
}: PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </Pressable>
  );
}

function BottomAccountPrompt() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>New to CityConnect?</Text>
      <Link href="/(auth)/register" asChild>
        <Pressable style={styles.footerLinkRow}>
          <Text style={styles.footerLink}>Create an account</Text>
          <LineIcon name="chevron" size={18} color={eco.primary} />
        </Pressable>
      </Link>
    </View>
  );
}

function BackgroundDecorations() {
  return (
    <View style={styles.backgroundImageFrame} pointerEvents="none">
      <Image
        source={authBackgroundBotanical}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
    </View>
  );
}

function ButtonLeafOverlay() {
  return (
    <View style={styles.buttonLeafImageFrame} pointerEvents="none">
      <Image
        source={authButtonLeaves}
        style={styles.buttonLeafImage}
        resizeMode="contain"
      />
    </View>
  );
}

function ErrorBanner({ error }: { error: string }) {
  if (!error) return null;

  return (
    <View style={styles.errorBanner}>
      <LineIcon name="alert" size={18} color={tokens.color.danger} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

function LineIcon({ name, size, color }: { name: IconName; size: number; color: string }) {
  if (name === "chevron") {
    return (
      <View
        style={[
          styles.chevronIcon,
          {
            borderColor: color,
            height: size * 0.58,
            width: size * 0.58,
          },
        ]}
      />
    );
  }

  if (name === "person") {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View
          style={[
            styles.personHead,
            {
              borderColor: color,
              height: size * 0.34,
              width: size * 0.34,
            },
          ]}
        />
        <View
          style={[
            styles.personBody,
            {
              borderColor: color,
              height: size * 0.42,
              width: size * 0.72,
            },
          ]}
        />
      </View>
    );
  }

  if (name === "lock") {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View
          style={[
            styles.lockShackle,
            {
              borderColor: color,
              height: size * 0.42,
              width: size * 0.52,
            },
          ]}
        />
        <View
          style={[
            styles.lockBody,
            {
              borderColor: color,
              height: size * 0.48,
              width: size * 0.72,
            },
          ]}
        />
      </View>
    );
  }

  if (name === "eye" || name === "eyeOff") {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View
          style={[
            styles.eyeShape,
            {
              borderColor: color,
              height: size * 0.48,
              width: size * 0.86,
            },
          ]}
        >
          <View
            style={[
              styles.eyeDot,
              {
                backgroundColor: color,
                height: size * 0.18,
                width: size * 0.18,
              },
            ]}
          />
        </View>
        {name === "eyeOff" ? <View style={[styles.eyeSlash, { backgroundColor: color, height: 2, width: size }]} /> : null}
      </View>
    );
  }

  if (name === "keypad") {
    return (
      <View style={[styles.keypadIcon, { height: size, width: size }]}>
        {Array.from({ length: 9 }, (_, index) => (
          <View
            key={`keypad-dot-${index}`}
            style={[
              styles.keypadDot,
              {
                backgroundColor: color,
                height: size * 0.13,
                width: size * 0.13,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (name === "shield") {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View
          style={[
            styles.shieldShape,
            {
              borderColor: color,
              height: size * 0.84,
              width: size * 0.7,
            },
          ]}
        />
        <View style={[styles.shieldCheckLong, { backgroundColor: color }]} />
        <View style={[styles.shieldCheckShort, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View style={[styles.alertIcon, { borderColor: color, height: size, width: size }]}>
      <View style={[styles.alertMark, { backgroundColor: color, height: size * 0.42 }]} />
      <View style={[styles.alertDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: eco.background,
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 34,
  },
  scroll: {
    position: "relative",
    zIndex: 2,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-start",
    minHeight: 84,
    position: "relative",
    zIndex: 2,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    minWidth: 0,
  },
  brandBadge: {
    alignItems: "center",
    backgroundColor: eco.securePill,
    borderRadius: 22,
    height: 66,
    justifyContent: "center",
    width: 66,
  },
  brandMark: {
    height: 42,
    width: 42,
  },
  wordmark: {
    height: 32,
    width: 184,
  },
  centerColumn: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 40,
    position: "relative",
    zIndex: 2,
  },
  authCard: {
    backgroundColor: eco.card,
    borderRadius: 30,
    gap: 26,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: "#103B2D",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 8,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    minHeight: 102,
    position: "relative",
  },
  cardTitleBlock: {
    width: "100%",
  },
  cardTitle: {
    ...font("800"),
    color: eco.text,
    fontSize: 31,
    lineHeight: 38,
  },
  cardSubtitle: {
    ...font("400"),
    color: eco.muted,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 14,
  },
  securePill: {
    alignItems: "center",
    backgroundColor: eco.securePill,
    borderRadius: 17,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
    right: 0,
    top: 0,
  },
  securePillText: {
    ...font("700"),
    color: "#28613F",
    fontSize: 15,
  },
  formBlock: {
    gap: 18,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    ...font("700"),
    color: eco.text,
    fontSize: 17,
  },
  inputFrame: {
    alignItems: "center",
    backgroundColor: eco.inputFill,
    borderColor: eco.inputBorder,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    height: 64,
    paddingLeft: 18,
    paddingRight: 16,
  },
  input: {
    ...font("400"),
    color: eco.text,
    flex: 1,
    fontSize: 17,
    height: "100%",
    padding: 0,
  },
  fieldIconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    paddingVertical: 8,
  },
  dividerLine: {
    backgroundColor: eco.divider,
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...font("700"),
    color: eco.primary,
    fontSize: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: eco.primary,
    borderRadius: 20,
    height: 72,
    justifyContent: "center",
    marginTop: 4,
    overflow: "hidden",
    position: "relative",
  },
  primaryButtonPressed: {
    backgroundColor: eco.primaryPressed,
  },
  primaryButtonText: {
    ...font("700"),
    color: "#FFFFFF",
    fontSize: 21,
    position: "relative",
    zIndex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: eco.securePill,
    borderColor: eco.inputBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
  },
  secondaryButtonPressed: {
    opacity: 0.86,
  },
  secondaryButtonText: {
    ...font("700"),
    color: eco.primary,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 26,
    minHeight: 44,
  },
  footerText: {
    ...font("400"),
    color: "#344054",
    fontSize: 16,
  },
  footerLinkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    marginLeft: 8,
    minHeight: 44,
  },
  footerLink: {
    ...font("700"),
    color: eco.primary,
    fontSize: 16,
  },
  otpRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  otpBox: {
    alignItems: "center",
    backgroundColor: eco.inputFill,
    borderColor: eco.inputBorder,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    height: 58,
    justifyContent: "center",
  },
  otpBoxFilled: {
    backgroundColor: eco.securePill,
    borderColor: "#BFD2B7",
  },
  otpDigit: {
    ...font("800"),
    color: eco.text,
    fontSize: 22,
  },
  helperText: {
    ...font("400"),
    color: eco.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorBanner: {
    alignItems: "flex-start",
    backgroundColor: eco.dangerSoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    ...font("400"),
    color: tokens.color.danger,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  backgroundImageFrame: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
  backgroundImage: {
    height: "100%",
    width: "100%",
  },
  decorations: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 0,
  },
  topWash: {
    backgroundColor: "rgba(221, 232, 206, 0.28)",
    borderRadius: 140,
    height: 180,
    position: "absolute",
    right: -92,
    top: 142,
    transform: [{ rotate: "-18deg" }],
    width: 210,
  },
  bottomWash: {
    backgroundColor: "rgba(221, 232, 206, 0.38)",
    borderRadius: 170,
    bottom: -44,
    height: 150,
    position: "absolute",
    right: -44,
    transform: [{ rotate: "-12deg" }],
    width: 250,
  },
  bottomSweep: {
    backgroundColor: "rgba(221, 232, 206, 0.26)",
    borderRadius: 180,
    bottom: -66,
    height: 120,
    left: 94,
    position: "absolute",
    transform: [{ rotate: "7deg" }],
    width: 260,
  },
  diagonalWash: {
    bottom: 26,
    height: 140,
    position: "absolute",
    right: -2,
    transform: [{ rotate: "42deg" }],
    width: 180,
  },
  washLine: {
    backgroundColor: "rgba(221, 232, 206, 0.55)",
    borderRadius: 999,
    height: 72,
    position: "absolute",
    top: 18,
    width: 4,
  },
  leafCluster: {
    bottom: -86,
    height: 190,
    left: -58,
    opacity: 0.72,
    position: "absolute",
    width: 190,
  },
  leafStem: {
    backgroundColor: "rgba(103, 132, 84, 0.42)",
    borderRadius: 999,
    position: "absolute",
    width: 2,
  },
  leafStemTall: {
    bottom: 4,
    height: 164,
    left: 62,
    transform: [{ rotate: "-18deg" }],
  },
  leafStemShort: {
    bottom: 28,
    height: 102,
    left: 26,
    transform: [{ rotate: "8deg" }],
  },
  leaf: {
    backgroundColor: "rgba(103, 132, 84, 0.38)",
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 24,
    position: "absolute",
  },
  leafLarge: {
    bottom: 16,
    height: 52,
    left: 74,
    transform: [{ rotate: "-38deg" }],
    width: 96,
  },
  leafMedium: {
    bottom: 72,
    height: 44,
    left: 42,
    transform: [{ rotate: "-28deg" }],
    width: 74,
  },
  leafSmall: {
    bottom: 120,
    height: 30,
    left: 76,
    transform: [{ rotate: "-34deg" }],
    width: 44,
  },
  leafTiny: {
    bottom: 110,
    height: 22,
    left: 24,
    transform: [{ rotate: "34deg" }],
    width: 28,
  },
  buttonLeafImageFrame: {
    bottom: -34,
    height: 116,
    position: "absolute",
    right: -26,
    width: 166,
  },
  buttonLeafImage: {
    height: "100%",
    opacity: 0.34,
    width: "100%",
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chevronIcon: {
    borderRightWidth: 2,
    borderTopWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  personHead: {
    borderRadius: 999,
    borderWidth: 2,
    position: "absolute",
    top: 1,
  },
  personBody: {
    borderRadius: 999,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    bottom: 0,
    position: "absolute",
  },
  lockShackle: {
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    position: "absolute",
    top: 0,
  },
  lockBody: {
    borderRadius: 3,
    borderWidth: 2,
    bottom: 0,
    position: "absolute",
  },
  eyeShape: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    transform: [{ scaleY: 0.72 }],
  },
  eyeDot: {
    borderRadius: 999,
  },
  eyeSlash: {
    borderRadius: 999,
    position: "absolute",
    transform: [{ rotate: "-42deg" }],
  },
  keypadIcon: {
    alignContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    justifyContent: "center",
    padding: 2,
  },
  keypadDot: {
    borderRadius: 999,
  },
  shieldShape: {
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  shieldCheckLong: {
    borderRadius: 999,
    height: 2,
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
    width: 8,
  },
  shieldCheckShort: {
    borderRadius: 999,
    height: 2,
    left: 5,
    position: "absolute",
    top: 10,
    transform: [{ rotate: "45deg" }],
    width: 5,
  },
  alertIcon: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
  },
  alertMark: {
    borderRadius: 999,
    width: 2,
  },
  alertDot: {
    borderRadius: 999,
    height: 2,
    marginTop: 2,
    width: 2,
  },
});
