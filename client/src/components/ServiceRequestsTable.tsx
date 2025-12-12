import React from "react";
import { ServiceRequest, useServiceRequests } from "@/hooks/useServiceRequests";

type Props = {
  estateId: string;
};

export const ServiceRequestsTable: React.FC<Props> = ({ estateId }) => {
  const { data, loading, error, setData } = useServiceRequests(estateId);

  const normalizeStatus = (status: string | null | undefined) => (status ? status.toUpperCase() : status);
  const normalizeRequest = (request: ServiceRequest) => ({
    ...request,
    status: normalizeStatus(request.status),
  });

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/requests/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      console.error("Status update failed", await res.text());
      return;
    }

    const updated = await res.json();
    setData((prev) => prev.map((r) => (r.id === updated.id ? normalizeRequest(updated) : r)));
  }

  if (!estateId) return <div>No estate selected.</div>;
  if (loading) return <div>Loading requests…</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data.length) return <div>No requests yet.</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Description</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions (dev)</th>
        </tr>
      </thead>
      <tbody>
        {data.map((request) => (
          <tr key={request.id}>
            <td>{request.title || "Untitled request"}</td>
            <td>{request.description || "No description"}</td>
            <td>{request.status}</td>
            <td>{new Date(request.createdAt).toLocaleString()}</td>
            <td>
              {request.status === "PENDING" && (
                <>
                  <button onClick={() => updateStatus(request.id, "UNDER_REVIEW")}>
                    Under review
                  </button>
                  <button onClick={() => updateStatus(request.id, "IN_PROGRESS")}>
                    In Progress
                  </button>
                </>
              )}

              {request.status === "UNDER_REVIEW" && (
                <button onClick={() => updateStatus(request.id, "IN_PROGRESS")}>
                  In Progress
                </button>
              )}

              {request.status === "IN_PROGRESS" && (
                <button onClick={() => updateStatus(request.id, "COMPLETED")}>
                  Complete
                </button>
              )}

              {request.status === "COMPLETED" && <span>Done</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
