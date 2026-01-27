import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PriceEstimate = { min: number; max: number; ruleId?: string } | null;

type PreparedRequestRow = {
  id: string;
  conversationId: string;
  resident: string;
  estateId: string | null;
  category: string;
  urgency: string;
  recommendedApproach: string;
  confidenceScore: number;
  requiresConsultancy: boolean;
  readyToBook: boolean;
  headline: string | null;
  imageCount: number;
  scope: string | null;
  priceEstimate: PriceEstimate;
  updatedAt?: string | null;
};

function formatNgn(value: number) {
  const n = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function AdminAiPreparedRequestsPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<PreparedRequestRow[]>({
    queryKey: ["/api/admin/ai/prepared-requests"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/ai/prepared-requests"),
    enabled: !!user && user.globalRole === "super_admin",
  });

  if (user?.globalRole !== "super_admin") {
    return (
      <AdminLayout title="AI Prepared Requests">
        <Card>
          <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="AI Prepared Requests">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Prepared Requests
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              View AI-analyzed service requests ready for booking
            </p>
          </div>
        </div>

        {/* Prepared Requests Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">Loading…</div>
            ) : error ? (
              <div className="p-6">Failed to load prepared requests.</div>
            ) : (data ?? []).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No AI-prepared requests available yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Approach</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Ready</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Estimate</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.resident}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.urgency}</TableCell>
                      <TableCell>{row.recommendedApproach}</TableCell>
                      <TableCell>{row.confidenceScore}</TableCell>
                      <TableCell>{row.readyToBook ? "Yes" : "No"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{row.headline ?? "—"}</TableCell>
                      <TableCell>{row.scope ?? "—"}</TableCell>
                      <TableCell>
                        {row.priceEstimate
                          ? `${formatNgn(row.priceEstimate.min)} – ${formatNgn(row.priceEstimate.max)}`
                          : "—"}
                      </TableCell>
                      <TableCell>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
