import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../theme/tokens";
import { font } from "../../theme/typography";
import { OrdinaryFlowThreadItem } from "./ordinaryFlowAdapter";

type Props = {
  items: OrdinaryFlowThreadItem[];
};

export function OrdinaryFlowThread({ items }: Props) {
  return (
    <View style={styles.thread}>
      {items.map((entry) => (
        <View
          key={entry.id}
          style={[styles.row, entry.role === "user" ? styles.rowUser : styles.rowAssistant]}
        >
          <View
            style={[
              styles.bubble,
              entry.role === "user"
                ? styles.bubbleUser
                : entry.role === "system"
                  ? entry.tone === "danger"
                    ? styles.bubbleSystemDanger
                    : entry.tone === "success"
                      ? styles.bubbleSystemSuccess
                      : styles.bubbleSystem
                  : styles.bubbleAssistant,
            ]}
          >
            <Text
              style={[
                styles.text,
                entry.role === "user" ? styles.textUser : null,
                entry.role === "system" ? styles.textSystem : null,
              ]}
            >
              {entry.text}
            </Text>
            {entry.caption ? <Text style={styles.caption}>{entry.caption}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
  },
  rowAssistant: {
    justifyContent: "flex-start",
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  bubble: {
    borderRadius: 22,
    gap: 4,
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleAssistant: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 8,
  },
  bubbleUser: {
    backgroundColor: tokens.color.primary,
    borderBottomRightRadius: 8,
  },
  bubbleSystem: {
    alignSelf: "center",
    backgroundColor: "#EEF2F6",
    maxWidth: "100%",
  },
  bubbleSystemSuccess: {
    alignSelf: "center",
    backgroundColor: "#E8F7EF",
    maxWidth: "100%",
  },
  bubbleSystemDanger: {
    alignSelf: "center",
    backgroundColor: "#FDEEEE",
    maxWidth: "100%",
  },
  text: {
    ...font("400"),
    color: tokens.color.text,
    fontSize: 15,
    lineHeight: 20,
  },
  textUser: {
    color: "#FFFFFF",
  },
  textSystem: {
    textAlign: "center",
  },
  caption: {
    ...font("400"),
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
