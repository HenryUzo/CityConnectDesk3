import { useEffect, useState } from "react";

export type Estate = {
  id: string;
  name: string;
  slug: string;
};

export function useMyEstates() {
  const [data, setData] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);

    fetch("/api/my-estates")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load estates (${res.status})`);
        }
        return res.json();
      })
      .then((estates: Estate[]) => {
        if (!canceled) {
          setData(estates);
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
  }, []);

  return { data, loading, error };
}
