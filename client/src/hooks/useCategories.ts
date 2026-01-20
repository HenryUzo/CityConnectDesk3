import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, readCategoriesCache } from "@/lib/categoriesClient";
import { queryClient } from "@/lib/queryClient";

export default function useCategories(opts?: { scope?: string }) {
  const scope = opts?.scope || "global";

  const initial = readCategoriesCache();

  const q = useQuery({
    queryKey: ["categories", { scope }],
    queryFn: async () => fetchCategories(scope),
    staleTime: 1000 * 60 * 5,
    initialData: initial ?? undefined,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      const handler = (ev: MessageEvent) => {
        try {
          // server sends named events; when categories change we invalidate
          // parse payload and decide whether to refetch
          const data = JSON.parse(ev.data || '{}');
          // only invalidate the public categories query key
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        } catch (err) {
          // ignore malformed events
        }
      };

      // listen to named 'categories' events and also generic messages
      es.addEventListener('categories', handler as EventListener);
      es.addEventListener('message', handler as EventListener);
    } catch (err) {
      // EventSource not available or connection failed — fall back to nothing
    }

    return () => {
      if (es) {
        try { es.close(); } catch (_) {}
        es = null;
      }
    };
  }, [scope]);

  return { categories: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
