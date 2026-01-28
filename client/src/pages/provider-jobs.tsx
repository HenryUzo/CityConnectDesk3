import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  User,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
import formatDate from "@/utils/formatDate";
import { useState, useMemo } from "react";
import { Link } from "wouter";

interface ServiceRequest {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  budget?: number;
  location?: string;
  urgency?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  buyer?: {
    id?: string;
    name?: string;
    email?: string;
  };
  assignedProviderId?: string;
  completedAt?: string;
}

export default function ProviderJobs() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch assigned jobs/service requests for the provider
  const { data: jobs = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["provider-jobs", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests?assignedProviderId=${user?.id}`);
      return res.json() as Promise<ServiceRequest[]>;
    },
    enabled: !!user?.id,
  });

  const getStatusColor = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      assigned: "bg-purple-100 text-purple-800",
    };
    return statusMap[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "in_progress":
        return <AlertCircle className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "assigned":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredJobs = useMemo(
    () =>
      statusFilter === "all"
        ? jobs
        : jobs.filter((job: ServiceRequest) => job.status === statusFilter),
    [jobs, statusFilter]
  );

  const stats = useMemo(
    () => ({
      total: jobs.length,
      pending: jobs.filter((j: ServiceRequest) => j.status === "pending").length,
      inProgress: jobs.filter(
        (j: ServiceRequest) => j.status === "in_progress"
      ).length,
      completed: jobs.filter(
        (j: ServiceRequest) => j.status === "completed"
      ).length,
    }),
    [jobs]
  );

  return (
    <ProviderLayout title="My Jobs">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">All time jobs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <p className="text-xs text-gray-500 mt-1">Awaiting acceptance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active jobs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.completed}
              </div>
              <p className="text-xs text-gray-500 mt-1">Finished jobs</p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs List</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="assigned">Assigned</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <p>Loading jobs...</p>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-gray-500 mb-4">No jobs found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map((job: ServiceRequest) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium max-w-xs">
                              {job.title || job.description || "Untitled Job"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {job.category || "General"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  {job.buyer?.name || "Unknown"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {job.location || "Not specified"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 font-medium">
                                <DollarSign className="w-4 h-4" />
                                {job.budget ? job.budget.toLocaleString() : "TBD"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${getStatusColor(job.status)} flex items-center gap-1 w-fit`}
                              >
                                {getStatusIcon(job.status)}
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {job.createdAt
                                ? formatDate(job.createdAt)
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Link href={`/service-requests?id=${job.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  View Details
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ProviderLayout>
  );
}
