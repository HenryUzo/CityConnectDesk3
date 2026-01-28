import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
import { useState, useMemo } from "react";
import { ShoppingCart, Search, DollarSign, Star, Package } from "lucide-react";

interface MarketplaceItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  storeId?: string;
  storeName?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  image?: string;
  isAvailable?: boolean;
  stock?: number;
}

export default function ProviderMarketplace() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");

  // Fetch all marketplace items
  const { data: items = [], isLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ["provider-marketplace"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/marketplace");
      return res.json() as Promise<MarketplaceItem[]>;
    },
  });

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.category?.toLowerCase().includes(search.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [items, search, sortBy]);

  return (
    <ProviderLayout title="Marketplace">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Marketplace</h2>
            <p className="text-gray-500">Browse and discover products</p>
          </div>
          <Badge variant="secondary">{filteredAndSortedItems.length} Items</Badge>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative col-span-1 md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search products, categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="price-low">Price (Low to High)</SelectItem>
              <SelectItem value="price-high">Price (High to Low)</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Items Grid */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <p className="text-gray-500">Loading marketplace items...</p>
              </div>
            ) : filteredAndSortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">No items found</p>
                <p className="text-sm text-gray-400">
                  {search ? "Try adjusting your search" : "Browse available products"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSortedItems.map((item) => (
                  <Card
                    key={item.id}
                    className="hover:shadow-lg transition-shadow flex flex-col"
                  >
                    {/* Image Placeholder */}
                    <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-12 h-12 text-gray-400" />
                      )}
                    </div>

                    <CardContent className="pt-4 flex-1 flex flex-col">
                      {/* Category Badge */}
                      {item.category && (
                        <Badge variant="outline" className="w-fit mb-2 text-xs">
                          {item.category}
                        </Badge>
                      )}

                      {/* Product Name */}
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                        {item.name}
                      </h3>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Rating */}
                      {item.rating && (
                        <div className="flex items-center gap-1 mb-3">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium">{item.rating}</span>
                          {item.reviews && (
                            <span className="text-xs text-gray-500">
                              ({item.reviews} reviews)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Store Name */}
                      {item.storeName && (
                        <p className="text-xs text-gray-500 mb-3">
                          From: <span className="font-medium">{item.storeName}</span>
                        </p>
                      )}

                      {/* Price and Stock */}
                      <div className="mt-auto space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-lg font-bold">
                            <DollarSign className="w-4 h-4" />
                            {item.price.toLocaleString()}
                          </div>
                          {item.stock !== undefined && (
                            <Badge
                              variant={item.stock > 0 ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
                            </Badge>
                          )}
                        </div>

                        {/* Add to Cart Button */}
                        <Button
                          className="w-full"
                          variant="default"
                          disabled={!item.isAvailable || (item.stock === 0)}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {item.isAvailable ? "View Details" : "Unavailable"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProviderLayout>
  );
}
