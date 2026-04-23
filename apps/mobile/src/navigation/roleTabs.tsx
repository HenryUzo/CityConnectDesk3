import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { tokens } from "../theme/tokens";

type TabSpec = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  hidden?: boolean;
};

function getFocusedIcon(name: keyof typeof Ionicons.glyphMap, focused: boolean) {
  if (!focused) return name;

  if (typeof name === "string" && name.endsWith("-outline")) {
    const filledName = name.replace("-outline", "") as keyof typeof Ionicons.glyphMap;
    if (filledName in Ionicons.glyphMap) {
      return filledName;
    }
  }

  return name;
}

export function RoleTabs({ tabs }: { tabs: TabSpec[] }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: "#475467",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E9EDF2",
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.hidden ? null : undefined,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={getFocusedIcon(tab.icon, focused)} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
