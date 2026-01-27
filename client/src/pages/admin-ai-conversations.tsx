import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AiConversationRow = {
  conversationId: string;
  category: string;
  urgency: string;
  recommendedApproach: string;
  confidenceScore: number;
  requiresConsultancy: boolean;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function AdminAiConversationsPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<AiConversationRow[]>({
    queryKey: ["/api/admin/ai/conversations"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/ai/conversations"),
  });

  if (user?.globalRole !== "super_admin") {
    return (
      <AdminLayout title="AI Conversations">
        <Card>
          <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="AI Conversations">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">Loading…</div>
          ) : error ? (
            <div className="p-6">Failed to load conversations.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conversation</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Approach</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => (
                  <TableRow key={row.conversationId}>
                    <TableCell className="font-mono text-xs">{row.conversationId}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.urgency}</TableCell>
                    <TableCell>{row.recommendedApproach}</TableCell>
                    <TableCell>{row.confidenceScore}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
