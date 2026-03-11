import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCategories,
  readCategoriesCache,
  type CategoryKind,
} from "@/lib/categoriesClient";
import { queryClient } from "@/lib/queryClient";

export default function useCategories(opts?: { scope?: string; kind?: CategoryKind }) {
  const scope = opts?.scope || "global";
  const kind = opts?.kind || "service";

  const initial = readCategoriesCache(kind);

  const q = useQuery({
    queryKey: ["categories", { scope, kind }],
    queryFn: async () => fetchCategories(scope, kind),
    staleTime: 1000 * 60 * 5,
    initialData: initial ?? undefined,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events");
      const handler = (ev: MessageEvent) => {
        try {
          JSON.parse(ev.data || "{}");
          queryClient.invalidateQueries({ queryKey: ["categories"] });
        } catch {
          // ignore malformed events
        }
      };

      es.addEventListener("categories", handler as EventListener);
      es.addEventListener("message", handler as EventListener);
    } catch {
      // EventSource not available; skip realtime invalidation.
    }

    return () => {
      if (es) {
        try {
          es.close();
        } catch {
          // noop
        }
        es = null;
      }
    };
  }, [scope, kind]);

  return { categories: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
