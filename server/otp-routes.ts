import { z } from "zod";

export const otpPurposeSchema = z.enum(["signup_verify", "login_verify"]);
export const otpChannelSchema = z.enum(["sms", "email"]);

export const otpRequestSchema = z.object({
  purpose: otpPurposeSchema,
  channel: otpChannelSchema.optional(),
  destination: z.string().trim().min(1).optional(),
  pendingRegistrationId: z.string().trim().min(1).nullable().optional(),
  identifier: z.string().trim().min(1).nullable().optional(),
});

export const otpVerifySchema = z.object({
  challengeId: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const otpResendSchema = z.object({
  challengeId: z.string().trim().min(1),
});

export const registerCompleteSchema = z.object({
  pendingRegistrationId: z.string().trim().min(1),
  verificationToken: z.string().trim().min(1),
});

export const loginStartSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    username: z.string().trim().min(1).optional(),
    accessCode: z.string().trim().regex(/^\d{6}$/).optional(),
    password: z.string().min(1).optional(),
  })
  .refine(
    (value) => Boolean(value.accessCode || value.identifier || value.email || value.username),
    "Provide an email, username, identifier, or access code",
  );

export type OtpRequestPayload = z.infer<typeof otpRequestSchema>;
export type OtpVerifyPayload = z.infer<typeof otpVerifySchema>;
export type OtpResendPayload = z.infer<typeof otpResendSchema>;
export type RegisterCompletePayload = z.infer<typeof registerCompleteSchema>;
export type LoginStartPayload = z.infer<typeof loginStartSchema>;
