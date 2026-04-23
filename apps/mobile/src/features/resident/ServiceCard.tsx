import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { font } from "../../theme/typography";

type ServiceCardProps = {
  title: string;
  providerCountLabel: string;
  locationLabel: string;
  image: ImageSourcePropType;
  width: number;
  height: number;
  onPress?: () => void;
};

export function ServiceCard({
  title,
  providerCountLabel,
  locationLabel,
  image,
  width,
  height,
  onPress,
}: ServiceCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, { width, height }]}> 
      <View style={styles.media}>
        <Image source={image} resizeMode="cover" style={styles.image} />
        <LinearGradient
          colors={["rgba(8, 15, 29, 0.02)", "rgba(8, 15, 29, 0.14)", "rgba(8, 15, 29, 0.82)"]}
          locations={[0, 0.44, 1]}
          style={styles.gradient}
        />

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {providerCountLabel}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#FFFFFF" />
            <Text style={styles.location} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#D6D8DC",
  },
  media: {
    flex: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 40,
    gap: 4,
  },
  title: {
    ...font("500"),
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 20,
  },
  subtitle: {
    ...font("400"),
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    lineHeight: 16,
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  location: {
    ...font("400"),
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 16,
  },
});
