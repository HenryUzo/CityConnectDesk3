import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AdminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface ProviderRequest {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
}

export function ProviderRequestsNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: requests, isLoading } = useQuery<ProviderRequest[]>({
    queryKey: ["provider-requests"],
        queryFn: () => AdminAPI.providerRequests.getProviderRequests(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pendingRequests = requests?.filter((r) => r.status === "pending") ?? [];

    const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      AdminAPI.providerRequests.updateProviderRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] });
      toast({
        title: "Success",
        description: "Provider request status updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleUpdateStatus = (id: string, status: "approved" | "rejected") => {
    mutation.mutate({ id, status });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendingRequests.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0"
            >
              {pendingRequests.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Provider Requests</h4>
            <p className="text-sm text-muted-foreground">
              Review company dashboard submissions
            </p>
          </div>
          <div className="grid gap-2">
            {isLoading ? (
              <p>Loading...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending requests.
              </p>
            ) : (
              pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4"
                >
                  <div>
                    <p className="font-semibold">{request.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Received: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(request.id, "approved")}
                      disabled={mutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(request.id, "rejected")}
                      disabled={mutation.isPending}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
