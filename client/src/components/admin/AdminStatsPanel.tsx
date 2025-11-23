import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminApiRequest } from "@/lib/adminApi";
import { Users, UserCheck, Clock, TrendingUp } from "lucide-react";

type BridgeStats = {
  users?: {
    totalResidents?: number;
    totalProviders?: number;
    pendingProviders?: number;
  };
};

export default function AdminStatsPanel() {
  const { data, isLoading } = useQuery<BridgeStats>({
    queryKey: ["/api/admin/bridge/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/bridge/stats"),
    staleTime: 30_000,
  });

  const cards = [
    {
      title: "Residents",
      value: data?.users?.totalResidents ?? 0,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Providers",
      value: data?.users?.totalProviders ?? 0,
      icon: UserCheck,
      color: "text-green-600",
    },
    {
      title: "Pending Providers",
      value: data?.users?.pendingProviders ?? 0,
      icon: Clock,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="border-l-4 border-l-primary">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Badge variant="secondary">{isLoading ? "..." : "Live"}</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {isLoading ? "--" : card.value}
                  </p>
                </div>
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span>{isLoading ? "Updating..." : "vs last month"}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
