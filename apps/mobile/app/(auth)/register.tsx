import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buildApiUrl } from "../../src/api/client";
import { MobileAuthResponse, PublicCompany } from "../../src/api/contracts";
import { AppButton, AppScreen, BodyText, FieldLabel, InputField, SectionCard } from "../../src/components/ui";
import { useSession } from "../../src/features/auth/session";
import { tokens } from "../../src/theme/tokens";
import { font } from "../../src/theme/typography";

type EstateOption = { id: string; name: string; address?: string | null };
type UserRole = "resident" | "provider";
type CompanyMode = "existing" | "new";
type ResidentEstateAccessMode = "access_code" | "open_estate" | "none";
type Step = "welcome" | "role" | "info" | "details" | "complete";

const steps: Step[] = ["welcome", "role", "info", "details", "complete"];
const welcomeHeroImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuAJ6CgfYE3uGJ6IsmghNbjp3h3DAu2xAYO8dKY09jaK1CKaKRa-pRKGLaaQr8U7uKoYyB9EGQki9knCG_KOrby0-ATQhRT3W8y5ljv0IuF8N2XhY9QIdcTj8_KGsoej4y9Ds2guJhHrB0cH4GdBPvnz-dGr57bwN1QqXJfhkor0LOgSNcEWBcLDEXKxzAOhaWLL-69LjPhZ4Ye-DrHoNAcp7SgCkz7jJ2hTDiu2IVOg5wq-akqUUyE_y-k-kvr9JtPm_bmxUToHqVu8";
const residentRoleImage = require("../../assets/images/role-resident.png");
const providerRoleImage = require("../../assets/images/role-provider.png");

function Progress({ step }: { step: Step }) {
  const activeIndex = steps.indexOf(step);
  return (
    <View style={styles.progressRow}>
      {steps.map((item, index) => (
        <View
          key={item}
          style={[
            styles.progressPill,
            index <= activeIndex ? styles.progressDone : styles.progressTodo,
            index === activeIndex ? styles.progressCurrent : null,
          ]}
        />
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const { services, startRegister, verifyOtp, resendOtp, completeRegister } = useSession();
  const inviteCodeInputRef = useRef<TextInput | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [role, setRole] = useState<UserRole>("resident");
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [experience, setExperience] = useState("0");
  const [inviteCode, setInviteCode] = useState("");
  const [estateId, setEstateId] = useState("");
  const [estateAccessMode, setEstateAccessMode] = useState<ResidentEstateAccessMode>("access_code");
  const [companyMode, setCompanyMode] = useState<CompanyMode>("existing");
  const [companyId, setCompanyId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDescription, setNewCompanyDescription] = useState("");
  const [description, setDescription] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingRegistrationId, setPendingRegistrationId] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [estates, setEstates] = useState<EstateOption[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState("");

  const normalizedInviteCode = useMemo(() => inviteCode.replace(/\D/g, "").slice(0, 4), [inviteCode]);

  useEffect(() => {
    let cancelled = false;
    const loadEstates = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/estates", { filter: "open-access" }));
        const data = (await response.json()) as EstateOption[];
        if (!cancelled) setEstates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setEstates([]);
      }
    };
    void loadEstates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role !== "provider") return;
    let cancelled = false;
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const data = await services.auth.publicCompanies();
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        setCompanies(rows);
        if (!rows.length) {
          setCompanyMode("new");
          setCompanyId("");
        } else if (!companyId) {
          setCompanyId(rows[0].id);
        }
      } catch {
        if (!cancelled) {
          setCompanies([]);
          setCompanyMode("new");
        }
      } finally {
        if (!cancelled) setLoadingCompanies(false);
      }
    };
    void loadCompanies();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    setError("");
    if (step !== "details") {
      resetOtpState();
    }
  }, [step, role]);

  useEffect(() => {
    if (step !== "details" || resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCountdown]);

  useEffect(() => {
    if (role !== "resident") return;
    if (estateAccessMode !== "access_code") {
      setInviteCode("");
    }
    if (estateAccessMode !== "open_estate") {
      setEstateId("");
    }
  }, [estateAccessMode, role]);

  function resetOtpState() {
    setOtpChallengeId("");
    setMaskedDestination("");
    setOtpCode("");
    setPendingRegistrationId("");
    setResendCountdown(0);
  }

  function goBack() {
    const index = steps.indexOf(step);
    if (index <= 0) {
      router.back();
      return;
    }
    setStep(steps[index - 1]);
  }

  function validateInfo() {
    if (role === "resident") {
      if (!name.trim()) throw new Error("Full name is required");
      if (!email.trim() && !phone.trim()) throw new Error("Email or phone is required");
      if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) throw new Error("First name and last name are required");
    if (!email.trim() && !phone.trim()) throw new Error("Email or phone is required");
    if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      if (!otpChallengeId) {
        let payload: Record<string, unknown>;

        if (role === "provider") {
          if (companyMode === "existing" && !companyId) {
            throw new Error("Select a company or switch to creating a new company");
          }
          if (companyMode === "new" && !newCompanyName.trim()) {
            throw new Error("New company name is required");
          }
          payload = {
            role: "provider",
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim().toLowerCase(),
            username: email.trim().toLowerCase(),
            phone: phone.trim(),
            companyMode,
            company: companyMode === "existing" ? companyId : newCompanyName.trim(),
            companyId: companyMode === "existing" ? companyId : undefined,
            newCompanyName: companyMode === "new" ? newCompanyName.trim() : undefined,
            newCompanyDescription:
              companyMode === "new" ? newCompanyDescription.trim() || undefined : undefined,
            experience: Number.isFinite(Number(experience)) ? Number(experience) : 0,
            description: description.trim() || undefined,
            password,
          };
        } else {
          if (estateAccessMode === "access_code" && normalizedInviteCode.length !== 4) {
            throw new Error("Enter the 4-digit estate access code or choose another option");
          }
          if (estateAccessMode === "open_estate" && !estateId) {
            throw new Error("Choose an estate with open registration or select another option");
          }
          payload = {
            role: "resident",
            name: name.trim(),
            email: email.trim().toLowerCase(),
            username: email.trim().toLowerCase() || undefined,
            phone: phone.trim(),
            password,
            estateAccessMode,
            inviteCode:
              estateAccessMode === "access_code" ? normalizedInviteCode || undefined : undefined,
            estateId: estateAccessMode === "open_estate" ? estateId || undefined : undefined,
          };
        }

        const result = (await startRegister(payload as Record<string, unknown>)) as
          | { challengeId?: string; maskedDestination?: string; pendingRegistrationId?: string | null; resendAvailableIn?: number; user?: unknown }
          | MobileAuthResponse;

        if ("challengeId" in result && result.challengeId) {
          setOtpChallengeId(result.challengeId);
          setMaskedDestination(String(result.maskedDestination || ""));
          setPendingRegistrationId(String(result.pendingRegistrationId || ""));
          setResendCountdown(result.resendAvailableIn || 0);
          setOtpCode("");
          return;
        }

        if ("user" in result && result.user) {
          setStep("complete");
          return;
        }

        if (role === "provider") {
          await services.auth.submitProviderRequest({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            companyMode,
            company: companyMode === "existing" ? companyId : newCompanyName.trim(),
            companyId: companyMode === "existing" ? companyId : undefined,
            newCompanyName: companyMode === "new" ? newCompanyName.trim() : undefined,
            newCompanyDescription:
              companyMode === "new" ? newCompanyDescription.trim() || undefined : undefined,
            experience: Number.isFinite(Number(experience)) ? Number(experience) : 0,
            description: description.trim() || undefined,
            password,
          });
          setStep("complete");
          return;
        }

        throw new Error("Verification is required to create a resident account. Please try again when OTP is available.");
      }

      if (otpCode.trim().length !== 6) {
        throw new Error("Enter the 6-digit verification code");
      }

      const verification = await verifyOtp(otpChallengeId, otpCode.trim());
      const completed = await completeRegister(
        pendingRegistrationId || String(verification.pendingRegistrationId || ""),
        verification.verificationToken,
      );
      if (!completed?.user) {
        throw new Error("Registration completed without a user session");
      }
      setStep("complete");
      return;
    } catch (err: any) {
      setError(String(err?.message || "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerificationCode() {
    if (!otpChallengeId || resendCountdown > 0) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await resendOtp(otpChallengeId);
      setOtpChallengeId(result.challengeId);
      setMaskedDestination(result.maskedDestination);
      setResendCountdown(result.resendAvailableIn || 0);
      setOtpCode("");
    } catch (err: any) {
      setError(String(err?.message || "Unable to resend verification code"));
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    try {
      if (step === "welcome") return setStep("role");
      if (step === "role") return setStep("info");
      if (step === "info") {
        validateInfo();
        return setStep("details");
      }
      if (step === "details") return void submit();
      if (role === "provider") {
        router.replace({ pathname: "/(auth)/provider-pending", params: { email: email.trim().toLowerCase() } });
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      setError(String(err?.message || "Please review your details"));
    }
  }

  return (
    <AppScreen style={styles.screen}>
      <View style={[styles.topRow, step === "welcome" ? styles.topRowWelcome : null]}>
        <View style={styles.topLeft}>
          {step !== "welcome" ? (
            <Pressable onPress={goBack} style={styles.iconButton}>
              <Ionicons name="arrow-back-outline" size={18} color={tokens.color.text} />
            </Pressable>
          ) : (
            <View style={styles.brandBadge}>
              <Ionicons name="business-outline" size={16} color={tokens.color.primary} />
            </View>
          )}
          <Text style={styles.brand}>CityConnect</Text>
        </View>
        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.skip}>Sign in</Text>
        </Pressable>
      </View>

      {step === "welcome" ? (
        <View style={styles.welcomeShell}>
          <View style={styles.welcomeContent}>
            <View style={styles.heroCluster}>
              <View style={styles.heroImageShell}>
                <Image source={{ uri: welcomeHeroImage }} style={styles.heroImage} resizeMode="cover" />
                <View style={styles.heroImageShade} />
              </View>
              <View style={styles.heroTrustChip}>
                <View style={styles.heroTrustIcon}>
                  <Ionicons name="shield-checkmark-outline" size={15} color="#FFFFFF" />
                </View>
                <View style={styles.heroTrustTextWrap}>
                  <Text style={styles.heroTrustLabel}>Trusted platform</Text>
                  <Text style={styles.heroTrustValue}>Verified service providers</Text>
                </View>
              </View>
            </View>

            <View style={styles.welcomeTextBlock}>
              <Text style={styles.heroEyebrow}>Citywide home services</Text>
              <Text style={styles.heroTitle}>
                Manage your{"\n"}home services{" "}
                <Text style={styles.heroAccent}>effortlessly</Text>
              </Text>
              <Text style={styles.heroBody}>
                Connect with reliable providers for all your home needs in one place.
              </Text>
            </View>
          </View>

          <View style={styles.welcomeFooter}>
            <Pressable onPress={advance} style={({ pressed }) => [styles.welcomeCta, pressed ? styles.welcomeCtaPressed : null]}>
              <Text style={styles.welcomeCtaText}>Get started</Text>
            </Pressable>
            <Text style={styles.welcomeSecondary}>
              Already have an account? <Link href="/(auth)/login">Sign in</Link>
            </Text>
          </View>
        </View>
      ) : null}

      {step === "role" ? (
        <View style={styles.roleShell}>
          <Progress step={step} />
          <View style={styles.roleHeader}>
            <Text style={styles.title}>Choose your role</Text>
            <Text style={styles.subtitle}>Tell us how you will use CityConnect.</Text>
          </View>

          <View style={styles.roleCards}>
            <Pressable style={[styles.roleCard, role === "resident" ? styles.roleCardActive : null]} onPress={() => setRole("resident")}>
              <View style={styles.roleCardTop}>
                <View style={[styles.rolePortraitWrap, role === "resident" ? styles.rolePortraitWrapActive : null]}>
                  <View style={styles.rolePortraitGlow} />
                  <Image source={residentRoleImage} style={styles.rolePortrait} resizeMode="contain" />
                </View>
                {role === "resident" ? (
                  <View style={styles.roleCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>Resident</Text>
                <Text style={styles.roleBody}>Find and manage home services.</Text>
              </View>
              <View style={styles.roleBackdropResident} />
            </Pressable>

            <Pressable style={[styles.roleCard, role === "provider" ? styles.roleCardActive : null]} onPress={() => setRole("provider")}>
              <View style={styles.roleCardTop}>
                <View style={[styles.rolePortraitWrap, role === "provider" ? styles.rolePortraitWrapActive : null]}>
                  <View style={styles.rolePortraitGlow} />
                  <Image source={providerRoleImage} style={styles.rolePortrait} resizeMode="contain" />
                </View>
                {role === "provider" ? (
                  <View style={styles.roleCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>Provider</Text>
                <Text style={styles.roleBody}>Grow your business and manage jobs.</Text>
              </View>
              <View style={styles.roleBackdropProvider} />
            </Pressable>
          </View>

          <View style={styles.roleFooter}>
            <AppButton onPress={advance}>Continue</AppButton>
            <BodyText muted>
              You can always switch your role later in your account settings.
            </BodyText>
          </View>
        </View>
      ) : null}

      {step === "info" ? (
        <View style={styles.stepStack}>
          <Progress step={step} />
          <Text style={styles.title}>A bit about you</Text>
          <Text style={styles.subtitle}>Let&apos;s get your profile started.</Text>
          <View style={styles.formPlain}>
            {role === "resident" ? (
              <>
                <FieldLabel>Full name</FieldLabel>
                <InputField placeholder="e.g. Julian Rivers" value={name} onChangeText={setName} />
                <FieldLabel>Email</FieldLabel>
                <InputField autoCapitalize="none" keyboardType="email-address" placeholder="hello@cityconnect.com" value={email} onChangeText={setEmail} />
              </>
            ) : (
              <>
                <FieldLabel>First name</FieldLabel>
                <InputField placeholder="First name" value={firstName} onChangeText={setFirstName} />
                <FieldLabel>Last name</FieldLabel>
                <InputField placeholder="Last name" value={lastName} onChangeText={setLastName} />
                <FieldLabel>Email</FieldLabel>
                <InputField autoCapitalize="none" keyboardType="email-address" placeholder="hello@cityconnect.com" value={email} onChangeText={setEmail} />
                <FieldLabel>Years of experience</FieldLabel>
                <InputField keyboardType="number-pad" placeholder="0" value={experience} onChangeText={setExperience} />
              </>
            )}
            <FieldLabel>Phone number</FieldLabel>
            <InputField keyboardType="phone-pad" placeholder="+234..." value={phone} onChangeText={setPhone} />
            <FieldLabel>Password</FieldLabel>
            <InputField secureTextEntry placeholder="Create a password" value={password} onChangeText={setPassword} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton onPress={advance}>Continue</AppButton>
        </View>
      ) : null}

      {step === "details" ? (
        <View style={styles.stepStack}>
          <Progress step={step} />
          <Text style={styles.title}>{role === "resident" ? "Verify your access" : "Verify your contact"}</Text>
          <Text style={styles.subtitle}>
            {otpChallengeId
              ? `Enter the 6-digit code sent to ${maskedDestination}.`
              : role === "resident"
                ? ""
                : "Confirm your company setup and verify your contact before your provider request is submitted."}
          </Text>
          <View style={styles.formPlain}>
            {role === "resident" ? (
              <>
                {!otpChallengeId ? (
                  <>
                    <View style={styles.accessSection}>
                      <Text style={styles.accessSectionTitle}>How are you joining?</Text>
                    </View>
                    <View style={styles.accessOptionGrid}>
                      <Pressable
                        style={[styles.accessOptionCard, estateAccessMode === "access_code" ? styles.accessOptionCardActive : null]}
                        onPress={() => setEstateAccessMode("access_code")}
                      >
                        <View style={[styles.accessOptionIcon, estateAccessMode === "access_code" ? styles.accessOptionIconActive : null]}>
                          <Ionicons name="key-outline" size={18} color={estateAccessMode === "access_code" ? tokens.color.primary : tokens.color.textMuted} />
                        </View>
                        <Text style={[styles.accessOptionTitle, estateAccessMode === "access_code" ? styles.accessOptionTitleActive : null]}>
                          Access code
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.accessOptionCard, estateAccessMode === "open_estate" ? styles.accessOptionCardActive : null]}
                        onPress={() => setEstateAccessMode("open_estate")}
                      >
                        <View style={[styles.accessOptionIcon, estateAccessMode === "open_estate" ? styles.accessOptionIconActive : null]}>
                          <Ionicons name="business-outline" size={18} color={estateAccessMode === "open_estate" ? tokens.color.primary : tokens.color.textMuted} />
                        </View>
                        <Text style={[styles.accessOptionTitle, estateAccessMode === "open_estate" ? styles.accessOptionTitleActive : null]}>
                          Open estate
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.accessOptionCard, estateAccessMode === "none" ? styles.accessOptionCardActive : null]}
                        onPress={() => setEstateAccessMode("none")}
                      >
                        <View style={[styles.accessOptionIcon, estateAccessMode === "none" ? styles.accessOptionIconActive : null]}>
                          <Ionicons name="person-outline" size={18} color={estateAccessMode === "none" ? tokens.color.primary : tokens.color.textMuted} />
                        </View>
                        <Text style={[styles.accessOptionTitle, estateAccessMode === "none" ? styles.accessOptionTitleActive : null]}>
                          No estate
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.accessDetailCard}>
                      {estateAccessMode === "access_code" ? (
                        <>
                          <Text style={styles.accessDetailTitle}>Enter your access code</Text>
                          <Text style={styles.accessDetailBody}>Use the 4-digit code provided by your estate manager.</Text>
                          <Pressable onPress={() => inviteCodeInputRef.current?.focus()} style={styles.codeEntryShell}>
                            <View style={styles.accessCodeRow}>
                              {Array.from({ length: 4 }, (_, index) => (
                                <View key={index} style={styles.accessCodeBox}>
                                  <Text style={styles.codeText}>{normalizedInviteCode[index] || ""}</Text>
                                </View>
                              ))}
                            </View>
                            <TextInput
                              ref={inviteCodeInputRef}
                              keyboardType="number-pad"
                              maxLength={4}
                              value={normalizedInviteCode}
                              onChangeText={setInviteCode}
                              style={styles.hiddenCodeInput}
                              caretHidden
                              autoCorrect={false}
                              autoComplete="off"
                            />
                          </Pressable>
                        </>
                      ) : null}

                      {estateAccessMode === "open_estate" ? (
                        <>
                          <Text style={styles.accessDetailTitle}>Choose an open estate</Text>
                          <Text style={styles.accessDetailBody}>Pick an estate that allows direct signup. We will send a verification code next.</Text>
                          <View style={styles.chipWrap}>
                            {estates.map((estate) => (
                              <Pressable
                                key={estate.id}
                                style={[styles.chip, estateId === estate.id ? styles.chipActive : null]}
                                onPress={() => setEstateId(estate.id)}
                              >
                                <Text style={[styles.chipText, estateId === estate.id ? styles.chipTextActive : null]}>{estate.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : null}

                      {estateAccessMode === "none" ? (
                        <>
                          <Text style={styles.accessDetailTitle}>Continue without an estate</Text>
                          <Text style={styles.accessDetailBody}>You can create your account now without an estate. We will verify your contact before signup.</Text>
                        </>
                      ) : null}
                    </View>
                  </>
                ) : null}
                {otpChallengeId ? (
                  <>
                    <FieldLabel>Verification code</FieldLabel>
                    <View style={styles.codeRow}>
                      {Array.from({ length: 6 }, (_, index) => (
                        <View key={`otp-${index}`} style={styles.codeBox}>
                          <Text style={styles.codeText}>{otpCode[index] || ""}</Text>
                        </View>
                      ))}
                    </View>
                    <InputField
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otpCode}
                      onChangeText={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <BodyText muted>
                      We sent a code to {maskedDestination}. Verify your contact to finish creating your account.
                    </BodyText>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.chipWrap}>
                  <Pressable style={[styles.chip, companyMode === "existing" ? styles.chipActive : null, companies.length === 0 ? styles.chipDisabled : null]} onPress={() => setCompanyMode("existing")} disabled={companies.length === 0}>
                    <Text style={[styles.chipText, companyMode === "existing" ? styles.chipTextActive : null]}>Join existing company</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, companyMode === "new" ? styles.chipActive : null]} onPress={() => setCompanyMode("new")}>
                    <Text style={[styles.chipText, companyMode === "new" ? styles.chipTextActive : null]}>Create new company</Text>
                  </Pressable>
                </View>
                {companyMode === "existing" ? (
                  <>
                    <BodyText muted>{loadingCompanies ? "Loading active companies..." : "Select the company you belong to."}</BodyText>
                    <View style={styles.chipWrap}>
                      {companies.map((company) => (
                        <Pressable key={company.id} style={[styles.chip, companyId === company.id ? styles.chipActive : null]} onPress={() => setCompanyId(company.id)}>
                          <Text style={[styles.chipText, companyId === company.id ? styles.chipTextActive : null]}>{company.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <FieldLabel>New company name</FieldLabel>
                    <InputField placeholder="Enter company name" value={newCompanyName} onChangeText={setNewCompanyName} />
                    <FieldLabel>Company description</FieldLabel>
                    <InputField multiline placeholder="Tell us about your company" value={newCompanyDescription} onChangeText={setNewCompanyDescription} />
                  </>
                )}
                <FieldLabel>Application note</FieldLabel>
                <InputField multiline placeholder="Share your service background" value={description} onChangeText={setDescription} />
                {otpChallengeId ? (
                  <>
                    <FieldLabel>Verification code</FieldLabel>
                    <View style={styles.codeRow}>
                      {Array.from({ length: 6 }, (_, index) => (
                        <View key={`provider-otp-${index}`} style={styles.codeBox}>
                          <Text style={styles.codeText}>{otpCode[index] || ""}</Text>
                        </View>
                      ))}
                    </View>
                    <InputField
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otpCode}
                      onChangeText={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <BodyText muted>
                      We sent a code to {maskedDestination}. Your provider request will be created after verification.
                    </BodyText>
                  </>
                ) : null}
              </>
            )}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {otpChallengeId ? (
            <AppButton variant="secondary" onPress={resendVerificationCode} disabled={submitting || resendCountdown > 0}>
              {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
            </AppButton>
          ) : null}
          <AppButton onPress={advance} disabled={submitting}>
            {submitting
              ? otpChallengeId
                ? "Verifying..."
                : "Sending code..."
              : otpChallengeId
                ? "Verify and continue"
              : "Send verification code"}
          </AppButton>
        </View>
      ) : null}

      {step === "complete" ? (
        <View style={styles.stepStack}>
          <Progress step={step} />
          <SectionCard style={styles.completeCard}>
            <View style={styles.completeIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{role === "provider" ? "Application submitted." : "All set. Welcome to CityConnect."}</Text>
            <Text style={styles.subtitle}>
              {role === "provider" ? "Your request is now in the approval queue." : "Your account is ready and linked to the live backend."}
            </Text>
          </SectionCard>
          <AppButton onPress={advance}>{role === "provider" ? "Continue to approval" : "Continue to app"}</AppButton>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.background },
  topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  topRowWelcome: { marginBottom: 8, paddingTop: 4 },
  topLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  iconButton: { alignItems: "center", backgroundColor: tokens.color.surfaceMuted, borderRadius: 14, height: 38, justifyContent: "center", width: 38 },
  brandBadge: { alignItems: "center", backgroundColor: "#ECFDF3", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  brand: { ...font("800"), color: tokens.color.text, fontSize: 21, letterSpacing: -0.4 },
  skip: { ...font("700"), color: "#475467", fontSize: 14 },
  progressRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  progressPill: { borderRadius: 999, height: 6, width: 28 },
  progressTodo: { backgroundColor: "#E5E7EB" },
  progressDone: { backgroundColor: "#B8E6CD" },
  progressCurrent: { backgroundColor: "#00875A", width: 40 },
  welcomeShell: { flexGrow: 1, justifyContent: "space-between", paddingTop: 8, paddingBottom: 12 },
  welcomeContent: { alignItems: "center", gap: 28, paddingTop: 28 },
  heroCluster: { alignItems: "center", justifyContent: "center", minHeight: 252, width: "100%" },
  heroImageShell: { backgroundColor: "#DCE7E1", borderRadius: 24, height: 204, overflow: "hidden", width: "100%" },
  heroImage: { height: "100%", width: "100%" },
  heroImageShade: { backgroundColor: "rgba(7, 24, 18, 0.14)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  heroTrustChip: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255, 255, 255, 0.96)", borderRadius: 18, bottom: 16, flexDirection: "row", gap: 10, left: 16, paddingHorizontal: 14, paddingVertical: 12, position: "absolute" },
  heroTrustIcon: { alignItems: "center", backgroundColor: "#12B76A", borderRadius: 999, height: 28, justifyContent: "center", width: 28 },
  heroTrustTextWrap: { gap: 1 },
  heroTrustLabel: { ...font("700"), color: "#667085", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  heroTrustValue: { ...font("800"), color: "#101828", fontSize: 13 },
  welcomeTextBlock: { alignItems: "center", gap: 12, maxWidth: 332 },
  heroEyebrow: { ...font("700"), color: "#027A48", fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase" },
  heroTitle: { ...font("800"), color: tokens.color.text, fontSize: 36, letterSpacing: -1.2, lineHeight: 42, textAlign: "center" },
  heroAccent: { color: "#027A48" },
  heroBody: { ...font("400"), color: "#5F6E63", fontSize: 16, lineHeight: 25, maxWidth: 310, textAlign: "center" },
  welcomeFooter: { gap: 16, paddingTop: 18 },
  welcomeCta: { alignItems: "center", backgroundColor: "#027A48", borderRadius: 18, justifyContent: "center", minHeight: 58 },
  welcomeCtaPressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  welcomeCtaText: { ...font("800"), color: "#FFFFFF", fontSize: 17, letterSpacing: -0.2 },
  welcomeSecondary: { ...font("400"), color: "#667085", fontSize: 15, lineHeight: 22, textAlign: "center" },
  title: { ...font("600"), color: tokens.color.text, fontSize: 28, textAlign: "center" },
  subtitle: { ...font("400"), color: "#3E4942", fontSize: 15, lineHeight: 22, textAlign: "center" },
  stepStack: { gap: 24, paddingTop: 16 },
  roleShell: { flexGrow: 1, gap: 44, paddingTop: 16, paddingBottom: 4 },
  roleHeader: { alignItems: "center", gap: 8, paddingTop: 6 },
  roleCards: { gap: 18 },
  roleCard: { backgroundColor: "#FFFFFF", borderRadius: 24, minHeight: 160, overflow: "hidden", padding: 22, position: "relative" },
  roleCardActive: { backgroundColor: "#ECFDF3" },
  roleCardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  rolePortraitWrap: { alignItems: "center", backgroundColor: "#EEF1EF", borderRadius: 20, height: 78, justifyContent: "flex-end", overflow: "hidden", position: "relative", width: 78 },
  rolePortraitWrapActive: { backgroundColor: "#DFF5E7" },
  rolePortraitGlow: { backgroundColor: "rgba(2, 122, 72, 0.08)", borderRadius: 999, height: 54, position: "absolute", top: 10, width: 54 },
  rolePortrait: { height: 72, width: 72 },
  roleCheck: { alignItems: "center", backgroundColor: "#027A48", borderRadius: 999, height: 24, justifyContent: "center", width: 24 },
  roleCopy: { gap: 8, maxWidth: "72%" },
  roleTitle: { ...font("600"), color: tokens.color.text, fontSize: 22 },
  roleBody: { ...font("400"), color: "#3E4942", fontSize: 15, lineHeight: 22 },
  roleBackdropResident: { backgroundColor: "rgba(2, 122, 72, 0.05)", borderRadius: 999, bottom: -36, height: 110, position: "absolute", right: -16, width: 110 },
  roleBackdropProvider: { backgroundColor: "rgba(16, 24, 40, 0.04)", borderRadius: 999, bottom: -40, height: 118, position: "absolute", right: -18, width: 118 },
  roleFooter: { gap: 14, paddingTop: 10 },
  formPlain: {
    backgroundColor: "transparent",
    borderWidth: 0,
    gap: 12,
    padding: 0,
  },
  error: { ...font("400"), color: tokens.color.danger, fontSize: 14, textAlign: "center" },
  codeEntryShell: {
    alignSelf: "center",
    marginTop: 6,
    paddingVertical: 4,
    position: "relative",
  },
  accessCodeRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  hiddenCodeInput: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.01,
  },
  accessCodeBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  codeBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, height: 62, justifyContent: "center", width: 54 },
  codeText: { ...font("800"), color: tokens.color.text, fontSize: 20 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#F3F4F5", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: "#ECFDF3" },
  chipDisabled: { opacity: 0.45 },
  chipText: { ...font("700"), color: tokens.color.text, fontSize: 13 },
  chipTextActive: { color: "#006B47" },
  accessSection: {
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  accessSectionEyebrow: {
    color: "#027A48",
    fontSize: 11,
    ...font("700"),
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  accessSectionTitle: {
    color: tokens.color.text,
    fontSize: 18,
    ...font("700"),
    letterSpacing: -0.3,
  },
  accessSectionBody: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
    textAlign: "center",
  },
  accessOptionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  accessOptionCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: 22,
    backgroundColor: tokens.color.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 0,
    shadowOpacity: 0,
  },
  accessOptionCardActive: {
    backgroundColor: "#ECFDF3",
  },
  accessOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#E9EEEA",
    alignItems: "center",
    justifyContent: "center",
  },
  accessOptionIconActive: {
    backgroundColor: "#D9F2E2",
  },
  accessOptionTitle: {
    color: tokens.color.text,
    fontSize: 14,
    ...font("700"),
    letterSpacing: -0.3,
    textAlign: "center",
  },
  accessOptionTitleActive: {
    color: "#006B47",
  },
  accessDetailCard: {
    backgroundColor: "#F6F7F7",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  accessDetailTitle: {
    color: tokens.color.text,
    fontSize: 18,
    ...font("700"),
    letterSpacing: -0.3,
    textAlign: "center",
  },
  accessDetailBody: {
    color: "#5E6B63",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  completeCard: { alignItems: "center", gap: 12, paddingVertical: 28 },
  completeIcon: { alignItems: "center", backgroundColor: "#00875A", borderRadius: 24, height: 96, justifyContent: "center", width: 96 },
});
