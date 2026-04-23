import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../auth/session";

export function useProviderThread(requestId?: string) {
  const queryClient = useQueryClient();
  const { services } = useSession();
  const [messageDraft, setMessageDraft] = useState("");

  const messagesQuery = useQuery({
    queryKey: ["provider", "job-messages", requestId],
    queryFn: () => services.requests.messages(String(requestId)),
    enabled: Boolean(requestId),
    refetchInterval: 5_000,
  });

  const typingQuery = useQuery({
    queryKey: ["provider", "job-typing", requestId],
    queryFn: () => services.requests.typingState(String(requestId)),
    enabled: Boolean(requestId),
    refetchInterval: 3_000,
  });

  useEffect(() => {
    if (!requestId) return;
    const timer = setTimeout(() => {
      void services.requests.setTyping(String(requestId), Boolean(messageDraft.trim())).catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [messageDraft, requestId, services.requests]);

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      services.requests.sendMessage(String(requestId), {
        message: messageDraft.trim(),
      }),
    onSuccess: () => {
      setMessageDraft("");
      queryClient.invalidateQueries({ queryKey: ["provider", "job-messages", requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider", "job-typing", requestId] });
    },
  });

  return {
    messageDraft,
    setMessageDraft,
    messagesQuery,
    typingQuery,
    sendMessageMutation,
  };
}
