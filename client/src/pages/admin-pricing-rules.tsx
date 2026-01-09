import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PricingRule = {
  id: string;
  name: string;
  category: string | null;
  scope: string | null;
  urgency: string | null;
  minPrice: string;
  maxPrice: string;
  isActive: boolean;
  updatedAt?: string | null;
};

export default function AdminPricingRulesPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<PricingRule[]>({
    queryKey: ["/api/admin/pricing-rules"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/pricing-rules"),
  });

  if (user?.globalRole !== "super_admin") {
    return (
      <AdminLayout title="Pricing Rules">
        <Card>
          <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pricing Rules">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">Loading…</div>
          ) : error ? (
            <div className="p-6">Failed to load pricing rules.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category ?? "—"}</TableCell>
                    <TableCell>{r.urgency ?? "—"}</TableCell>
                    <TableCell>{r.scope ?? "—"}</TableCell>
                    <TableCell>{r.minPrice}</TableCell>
                    <TableCell>{r.maxPrice}</TableCell>
                    <TableCell>{r.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</TableCell>
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
