import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestsSidebarProps {
  onCreateNew?: () => void;
}

export function RequestsSidebar({ onCreateNew }: RequestsSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch wallet
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch("/api/app/wallet");
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  // Fetch recent requests
  const { data: recentRequests = [] } = useQuery({
    queryKey: ["my-recent-requests"],
    queryFn: async () => {
      const res = await fetch("/api/app/service-requests/mine?limit=5");
      if (!res.ok) throw new Error("Failed to fetch recent requests");
      return res.json();
    },
  });

  const coins = wallet?.coins ?? 0;
  const canCreateRequest = coins >= 100;

  const handleCreateNew = () => {
    if (!canCreateRequest) {
      toast({
        title: "Insufficient Coins",
        description: "You need at least 100 coins to create a service request. Subscribe to get more coins.",
        variant: "destructive",
      });
      return;
    }
    onCreateNew?.();
  };

  return (
    <div className="w-80 bg-white rounded-2xl shadow p-6 space-y-6">
      {/* Create New Request */}
      <div>
        <Button
          onClick={handleCreateNew}
          disabled={!canCreateRequest}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {canCreateRequest ? (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create new request
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Create new request
            </>
          )}
        </Button>
        {!canCreateRequest && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Subscribe to get more coins
          </p>
        )}
      </div>

      {/* Recent Requests */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recents</h3>
        <div className="space-y-3">
          {recentRequests.length === 0 ? (
            <p className="text-sm text-gray-500">No recent requests</p>
          ) : (
            recentRequests.map((request: any) => (
              <div key={request.id} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {request.title || `${request.category}: ${request.description?.slice(0, 30)}...`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "COMPLETED" ? "default" :
                      request.status === "IN_PROGRESS" ? "secondary" :
                      "outline"
                    }
                    className="text-xs"
                  >
                    {request.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Coins Info */}
      <div className="bg-emerald-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-800">
              You have {coins} city coins left
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              Subscribe to get more coins
            </p>
          </div>
          <div className="text-2xl">🪙</div>
        </div>
      </div>
    </div>
  );
}