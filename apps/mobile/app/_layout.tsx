import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, TextInput } from "react-native";
import { AppProviders } from "../src/providers/AppProviders";
import { describeEnv } from "../src/config/env";
import { fontFamily } from "../src/theme/typography";

let defaultsApplied = false;

function applyGlobalFontDefaults() {
  if (defaultsApplied) return;

  const TextWithDefaults = Text as any;
  const TextInputWithDefaults = TextInput as any;

  TextWithDefaults.defaultProps = TextWithDefaults.defaultProps || {};
  TextWithDefaults.defaultProps.style = [TextWithDefaults.defaultProps.style, { fontFamily: fontFamily.regular }];

  TextInputWithDefaults.defaultProps = TextInputWithDefaults.defaultProps || {};
  TextInputWithDefaults.defaultProps.style = [
    TextInputWithDefaults.defaultProps.style,
    { fontFamily: fontFamily.regular },
  ];

  defaultsApplied = true;
}

export default function RootLayout() {
  void describeEnv();
  const [fontsLoaded] = useFonts({
    [fontFamily.regular]: require("../assets/fonts/TikTokSans-Regular.ttf"),
    [fontFamily.medium]: require("../assets/fonts/TikTokSans-Medium.ttf"),
    [fontFamily.semibold]: require("../assets/fonts/TikTokSans-SemiBold.ttf"),
    [fontFamily.bold]: require("../assets/fonts/TikTokSans-Bold.ttf"),
    [fontFamily.extrabold]: require("../assets/fonts/TikTokSans-ExtraBold.ttf"),
  });

  if (!fontsLoaded) return null;

  applyGlobalFontDefaults();

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
