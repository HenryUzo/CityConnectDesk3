import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Home,
  BarChart3,
  Layers,
  FileText,
  Flag,
  Users,
  Settings,
  HelpCircle,
  Wrench,
  Clock,
  Shirt,
  Search,
} from "lucide-react";

// Default emoji mapping for common categories
const categoryEmojiMap: Record<string, string> = {
  electrician: "⚡",
  plumber: "🔧",
  carpenter: "🪚",
  hvac: "❄️",
  painter: "🎨",
  tiler: "🧱",
  mason: "🧱",
  roofer: "🏠",
  gardener: "🌿",
  cleaner: "🧹",
  security: "🛡️",
  cook: "🍳",
  laundry: "🧺",
  pest: "🐜",
  welder: "⚙️",
  mechanic: "🔩",
  phone: "📱",
  appliance: "🔌",
  tailor: "🧵",
  market: "🛒",
  surveillance: "🎥",
  gate: "🚧",
  rides: "🚕",
  janitorial: "🧼",
  catering: "🍽️",
  logistics: "🚚",
  it: "💻",
  computer: "💻",
  maintenance: "🔧",
  repair: "🔧",
  packaging: "📦",
  marketing: "📊",
  advertising: "📊",
  tutoring: "📚",
  education: "📚",
};

function getCategoryEmoji(category: any): string {
  // Use emoji from DB if available
  if (category.emoji) return category.emoji;
  
  // Try to match from category name or key
  const searchText = (category.key || category.name || "").toLowerCase();
  for (const [keyword, emoji] of Object.entries(categoryEmojiMap)) {
    if (searchText.includes(keyword)) {
      return emoji;
    }
  }
  
  // Default fallback
  return "🔧";
}

export default function ServiceCategories() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Fetch categories from API
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "global"],
    queryFn: async () => {
      const res = await fetch("/api/categories?scope=global");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  // Fetch provider requests to count providers per category
  const { data: providerRequests = [] } = useQuery({
    queryKey: ["provider-requests"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/provider-requests");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  // Count providers per category
  const providerCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    providerRequests.forEach((req: any) => {
      if (req.categories && Array.isArray(req.categories)) {
        req.categories.forEach((cat: string) => {
          counts[cat] = (counts[cat] || 0) + 1;
        });
      }
    });
    return counts;
  }, [providerRequests]);

  // Transform categories to include emoji and provider count
  const serviceCategories = useMemo(() => {
    return categories
      .filter((cat: any) => cat.isActive !== false)
      .map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        key: cat.key,
        icon: getCategoryEmoji(cat),
        providers: providerCountByCategory[cat.key] || 0,
        // Generate avatar seeds based on category id
        avatars: Array.from({ length: 5 }, (_, i) => 
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${cat.id}-${i}`
        ),
      }));
  }, [categories, providerCountByCategory]);

  // Generate alphabet array
  const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  // Get categories that start with each letter
  const categoriesByLetter = useMemo(() => {
    const map = new Map<string, number>();
    serviceCategories.forEach((cat: { name: string }) => {
      const firstLetter = cat.name[0].toUpperCase();
      map.set(firstLetter, (map.get(firstLetter) || 0) + 1);
    });
    return map;
  }, [serviceCategories]);

  // Filter categories based on search and selected letter
  const filteredCategories = useMemo(() => {
    let filtered = serviceCategories;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((cat: { name: string }) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by selected letter
    if (selectedLetter) {
      filtered = filtered.filter((cat: { name: string }) =>
        cat.name[0].toUpperCase() === selectedLetter
      );
    }

    return filtered;
  }, [serviceCategories, searchQuery, selectedLetter]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Primary Left Sidebar */}
      <div className="w-16 bg-emerald-700 flex flex-col items-center py-6 space-y-6">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <div className="w-6 h-6 bg-emerald-700 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col items-center space-y-4">
          <Link href="/resident">
            <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
          </Link>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <BarChart3 className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Layers className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Users className="w-5 h-5 text-white" />
          </button>
        </nav>

        <div className="flex flex-col items-center space-y-4">
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">OR</span>
          </div>
        </div>
      </div>

      {/* Secondary Left Navigation */}
      <div className="w-60 bg-emerald-800 text-white flex flex-col">
        <div className="p-4 border-b border-emerald-700">
          <Link href="/resident">
            <button className="flex items-center text-white/80 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="text-sm">Book a Service</span>
            </button>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          <Link href="/service-categories">
            <button className="w-full px-4 py-3 flex items-center space-x-3 bg-emerald-700 text-white">
              <Wrench className="w-5 h-5" />
              <span>Service Categories</span>
              <Badge className="ml-auto bg-white text-emerald-800 text-xs">
                {serviceCategories.length}
              </Badge>
            </button>
          </Link>

          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
              <Wrench className="w-5 h-5" />
              <span>Book Repairs</span>
            </button>
          </Link>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Clock className="w-5 h-5" />
            <span>Schedule Maintenance</span>
          </button>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Shirt className="w-5 h-5" />
            <span>Do your Laundry</span>
          </button>
        </nav>

        <div className="p-4 border-t border-emerald-700">
          <div className="flex items-center space-x-3 bg-emerald-900 rounded-lg p-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">OR</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Olivia Rhye</div>
              <div className="text-xs text-emerald-300">olivia@untitledu.com</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Service Categories</h1>
              <p className="text-gray-600 mt-1">Find the right professional for your repair needs</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search Categories"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Alphabetical Filter */}
          <div className="mt-6 flex items-center gap-2 flex-wrap">
            {alphabet.map((letter) => {
              const count = categoriesByLetter.get(letter) || 0;
              const isActive = selectedLetter === letter;
              const hasCategories = count > 0;

              return (
                <Button
                  key={letter}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLetter(isActive ? null : letter)}
                  disabled={!hasCategories}
                  className={`
                    min-w-[44px] h-8 px-2 text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600' 
                      : hasCategories
                        ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    }
                  `}
                >
                  {letter}
                  {hasCategories && (
                    <span className={`ml-1 text-xs ${isActive ? 'text-emerald-100' : 'text-emerald-600'}`}>
                      ({count})
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Service Categories Grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-lg">Loading categories...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <p className="text-lg">No categories found</p>
              <p className="text-sm mt-2">Try a different search or filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.map((category: any) => (
                <Link key={category.id} href="/book-artisan">
                  <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 hover:border-emerald-500 bg-white">
                    <div className="p-6">
                      {/* Icon */}
                      <div className="mb-4 flex items-center justify-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                          <span className="text-4xl">{category.icon}</span>
                        </div>
                      </div>

                      {/* Category Name */}
                      <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">
                        {category.name}
                      </h3>

                      {/* Provider Avatars */}
                      <div className="flex items-center justify-center">
                        <div className="flex -space-x-2">
                          {category.avatars.slice(0, 5).map((avatar: string, idx: number) => (
                            <Avatar key={idx} className="w-8 h-8 border-2 border-white">
                              <AvatarImage src={avatar} alt={`Provider ${idx + 1}`} />
                              <AvatarFallback className="bg-emerald-500 text-white text-xs">
                                P{idx + 1}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <span className="ml-3 text-sm font-medium text-emerald-600">
                          +{category.providers} Providers
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
