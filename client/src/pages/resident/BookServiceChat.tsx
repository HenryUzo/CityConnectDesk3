import CityBuddyChat from "@/components/resident/CityBuddyChat";
import { Redirect } from "wouter";
import { useLocation } from "wouter";

function getCategoryFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const category = params.get("category")?.trim();
  return category || undefined;
}

export default function BookServiceChat() {
  // Use Wouter to re-render on navigation, but read search from the real URL.
  useLocation();
  const category = getCategoryFromSearch(window.location.search);

  if (!category) {
    return <Redirect to="/resident/requests/new" />;
  }

  return (
    <CityBuddyChat
      key={category}
      initialView="conversation"
      initialSelectedCategory={category}
    />
  );
}
