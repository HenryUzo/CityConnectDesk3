import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProviderMatchingRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  categories: string[] | null;
  serviceCategory: string | null;
  isActive: boolean;
  isApproved: boolean;
  matching: {
    isEnabled: boolean;
    settings: any;
    updatedAt?: string | null;
  };
};

export default function AdminProviderMatchingPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<ProviderMatchingRow[]>({
    queryKey: ["/api/admin/providers/matching"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/providers/matching"),
  });

  if (user?.globalRole !== "super_admin") {
    return (
      <AdminLayout title="Provider Matching">
        <Card>
          <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Provider Matching">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">Loading…</div>
          ) : error ? (
            <div className="p-6">Failed to load provider matching settings.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {(p.categories && p.categories.length ? p.categories : p.serviceCategory ? [p.serviceCategory] : [])
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>{p.matching?.isEnabled ? "Yes" : "No"}</TableCell>
                    <TableCell>{p.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell>{p.isApproved ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {p.matching?.updatedAt ? new Date(p.matching.updatedAt).toLocaleString() : "—"}
                    </TableCell>
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
