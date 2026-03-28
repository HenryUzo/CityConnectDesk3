import { useEffect, useState } from "react";

export type Estate = {
  id: string;
  name: string;
  slug?: string;
};

export function useMyEstates() {
  const [data, setData] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);

    const normalizeEstateRows = (rows: unknown): Estate[] => {
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row: any) => {
          const id = String(row?.id || row?._id || "").trim();
          const name = String(row?.name || "").trim();
          const slug = String(row?.slug || "").trim();
          if (!id || !name) return null;
          return {
            id,
            name,
            slug: slug || undefined,
          };
        })
        .filter(Boolean) as Estate[];
    };

    const load = async () => {
      const [myEstatesResult, publicEstatesResult] = await Promise.allSettled([
        fetch("/api/my-estates").then(async (res) => {
          if (!res.ok) throw new Error(`Failed to load member estates (${res.status})`);
          return (await res.json()) as unknown;
        }),
        fetch("/api/estates").then(async (res) => {
          if (!res.ok) throw new Error(`Failed to load estates (${res.status})`);
          return (await res.json()) as unknown;
        }),
      ]);

      const memberEstates =
        myEstatesResult.status === "fulfilled" ? normalizeEstateRows(myEstatesResult.value) : [];
      const publicEstates =
        publicEstatesResult.status === "fulfilled" ? normalizeEstateRows(publicEstatesResult.value) : [];

      const merged = [...memberEstates, ...publicEstates];
      const deduped = Array.from(
        merged.reduce((acc, estate) => {
          const key = estate.id || estate.name.toLowerCase();
          if (!acc.has(key)) acc.set(key, estate);
          return acc;
        }, new Map<string, Estate>()),
      )
        .map(([, estate]) => estate)
        .sort((left, right) => left.name.localeCompare(right.name));

      if (!canceled) {
        setData(deduped);
      }

      if (
        myEstatesResult.status === "rejected" &&
        publicEstatesResult.status === "rejected" &&
        !canceled
      ) {
        setError("Could not load estates.");
      }
    };

    load()
      .catch((err) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Could not load estates.");
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
