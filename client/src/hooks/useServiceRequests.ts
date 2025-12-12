import { useEffect, useState } from "react";

export type ServiceRequest = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  createdAt: string;
};

function normalizeStatus(status: string | undefined | null) {
  return status ? status.toUpperCase() : status;
}

function normalizeRequest(request: ServiceRequest): ServiceRequest {
  return { ...request, status: normalizeStatus(request.status) };
}

export function useServiceRequests(estateId: string | null) {
  const [data, setData] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estateId) {
      setData([]);
      return;
    }

    let canceled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/estates/${estateId}/requests`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load requests (${res.status})`);
        }
        return res.json();
      })
      .then((requests: ServiceRequest[]) => {
        if (!canceled) {
          setData(requests.map(normalizeRequest));
        }
      })
      .catch((err) => {
        if (!canceled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [estateId]);

  return { data, loading, error, setData };
}
