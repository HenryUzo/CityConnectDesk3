import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { RequestsSidebar } from "@/components/resident/RequestsSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Wrench, Zap, Droplets, Home, Car, Phone } from "lucide-react";
import SelectCategoryUi from "@/components/NewSelectUi/src/SelectCategoryUi/SelectCategoryUi";

const FALLBACK_CATEGORIES = [
  { id: "plumbing", name: "Plumbing", icon: Droplets, providers: 12 },
  { id: "electrical", name: "Electrical", icon: Zap, providers: 8 },
  { id: "carpentry", name: "Carpentry", icon: Home, providers: 15 },
  { id: "automotive", name: "Automotive", icon: Car, providers: 6 },
  { id: "general", name: "General Repairs", icon: Wrench, providers: 20 },
  { id: "telecom", name: "Telecommunications", icon: Phone, providers: 4 },
];

export default function SelectCategory() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/categories?scope=global");
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();
        return data.map((cat: any) => ({
          id: cat.id || cat.name?.toLowerCase().replace(/\s+/g, "-"),
          name: cat.name,
          icon: getIconForCategory(cat.name),
          providers: cat.providers || Math.floor(Math.random() * 20) + 1,
        }));
      } catch (error) {
        console.warn("Failed to load categories from server, using fallback");
        return FALLBACK_CATEGORIES;
      }
    },
  });

  const filteredCategories = categories.filter((cat: any) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCategorySelect = (category: any) => {
    setLocation(`/resident/requests/new/${category.id}`);
  };

  const handleCreateNew = () => {
    // This will be handled by the sidebar
  };

  return (

      <div>
        <SelectCategoryUi />
      </div>

  );
}

function getIconForCategory(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("plumb")) return Droplets;
  if (lowerName.includes("electr")) return Zap;
  if (lowerName.includes("carpent") || lowerName.includes("wood")) return Home;
  if (lowerName.includes("auto") || lowerName.includes("car")) return Car;
  if (lowerName.includes("phone") || lowerName.includes("telecom"))
    return Phone;
  return Wrench;
}
