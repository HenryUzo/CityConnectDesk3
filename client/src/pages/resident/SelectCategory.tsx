import CityBuddyChat from "@/components/resident/CityBuddyChat";
import { useLocation } from "wouter";

export default function SelectCategory() {
  const [, navigate] = useLocation();

  return (
    <CityBuddyChat
      initialView="select-category"
      onCategorySelected={(categoryName) => {
        navigate(
          `/resident/book-a-service/chat?category=${encodeURIComponent(categoryName)}`
        );
      }}
    />
  );
}
