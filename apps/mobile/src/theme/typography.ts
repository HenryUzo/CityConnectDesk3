export const fontFamily = {
  regular: "TikTokSans-Regular",
  medium: "TikTokSans-Medium",
  semibold: "TikTokSans-SemiBold",
  bold: "TikTokSans-Bold",
  extrabold: "TikTokSans-ExtraBold",
} as const;

export type AppFontWeight = "400" | "500" | "600" | "700" | "800";

export function font(weight: AppFontWeight = "400") {
  if (weight === "500" || weight === "600" || weight === "700" || weight === "800") {
    return {
      fontFamily: fontFamily.medium,
      fontWeight: "normal" as const,
    };
  }

  return {
    fontFamily: fontFamily.regular,
    fontWeight: "normal" as const,
  };
}
