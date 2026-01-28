import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Package, ArrowRight, Home } from "lucide-react";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";

interface ProviderStore {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  itemCount?: number;
  createdAt?: string;
}

export default function ProviderStores() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  // Fetch stores for the logged-in provider
  const { data: stores = [], isLoading } = useQuery<ProviderStore[]>({
    queryKey: ["provider-stores", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/stores");
      return res.json() as Promise<ProviderStore[]>;
    },
    enabled: !!user?.id,
  });

  const filteredStores = useMemo(
    () =>
      stores.filter(
        (store) =>
          store.name.toLowerCase().includes(search.toLowerCase()) ||
          store.location.toLowerCase().includes(search.toLowerCase())
      ),
    [stores, search]
  );

  return (
    <ProviderLayout title="My Stores">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">My Stores</h2>
            <p className="text-gray-500">Manage your stores and inventory</p>
          </div>
          <Badge variant="secondary">{filteredStores.length} Store(s)</Badge>
        </div>

        {/* Search */}
        <div className="max-w-sm">
          <Input
            placeholder="Search by store name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Stores Grid/Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Stores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <p className="text-gray-500">Loading stores...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Home className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">No stores found</p>
                <p className="text-sm text-gray-400">
                  {search
                    ? "Try adjusting your search filters"
                    : "You haven't created any stores yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStores.map((store) => (
                  <Card key={store.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{store.name}</CardTitle>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin className="w-4 h-4" />
                            {store.location}
                          </div>
                        </div>
                        {store.isActive && (
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {store.description && (
                        <p className="text-sm text-gray-600">{store.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-blue-500" />
                        <span>
                          {store.itemCount || 0} Item{(store.itemCount || 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Link href={`/provider/stores/${store.id}/items`}>
                        <Button className="w-full" variant="default">
                          Manage Items
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
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
