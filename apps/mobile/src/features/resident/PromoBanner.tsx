import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { font } from "../../theme/typography";

type PromoBannerProps = {
  image: ImageSourcePropType;
  title: string;
  buttonLabel: string;
  onPress: () => void;
  backgroundColor: string;
  textColor?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  imageBackgroundColor?: string;
};

export function PromoBanner({
  image,
  title,
  buttonLabel,
  onPress,
  backgroundColor,
  textColor = "#FFFFFF",
  buttonBackgroundColor = "#FFFFFF",
  buttonTextColor = "#2B2B2B",
  imageBackgroundColor = "#FFFFFF",
}: PromoBannerProps) {
  return (
    <Pressable style={[styles.banner, { backgroundColor }]} onPress={onPress}>
      <View style={[styles.imageSlot, { backgroundColor: imageBackgroundColor }]}>
        <Image source={image} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.copySlot}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <View style={[styles.button, { backgroundColor: buttonBackgroundColor }]}>
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>{buttonLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    borderWidth: 0,
    elevation: 0,
    flexDirection: "row",
    margin: 0,
    overflow: "hidden",
    minHeight: 98,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  imageSlot: {
    alignItems: "center",
    borderWidth: 0,
    justifyContent: "center",
    margin: 0,
    width: 102,
  },
  image: {
    height: 82,
    width: 82,
  },
  copySlot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  title: {
    ...font("500"),
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 170,
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 14,
  },
  buttonText: {
    ...font("500"),
    fontSize: 13,
  },
});
