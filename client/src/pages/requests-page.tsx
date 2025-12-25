import React from "react";
import { ServiceRequestsTable } from "@/components/ServiceRequestsTable";
import { useMyEstates } from "@/hooks/useMyEstates";

export const RequestsPage: React.FC = () => {
  const { data, loading, error } = useMyEstates();
  const estate = data[0];

  if (loading) {
    return <div>Loading estates…</div>;
  }

  if (error) {
    return <div>Error loading estates: {error}</div>;
  }

  if (!estate) {
    return <div>No estates available.</div>;
  }

  return (
    <div>
      <h1>Service Requests</h1>
      <h2>{estate.name}</h2>
      {/* TODO: allow switching between estates once multi-estate users exist */}
      <ServiceRequestsTable estateId={estate.id} />
    </div>
  );
};
