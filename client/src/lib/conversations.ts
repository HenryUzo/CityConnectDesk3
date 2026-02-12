import { apiRequest } from "@/lib/queryClient";

export type Conversation = {
  id: string;
  category: string;
  status: "active" | "closed";
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  type: "text" | "image";
  content: string;
  meta?: any;
  createdAt?: string | null;
};

export async function fetchConversations(category?: string) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await apiRequest("GET", `/api/app/conversations/mine${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load conversations");
  }
  return res.json() as Promise<Conversation[]>;
}

export async function getOrCreateConversation(category: string, forceNew?: boolean) {
  const res = await apiRequest("POST", "/api/app/conversations", { category, forceNew });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create conversation");
  }
  return res.json() as Promise<Conversation>;
}

export async function fetchMessages(conversationId: string) {
  const res = await apiRequest("GET", `/api/app/conversations/${conversationId}/messages`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load messages");
  }
  return res.json() as Promise<ConversationMessage[]>;
}

export async function appendMessage(
  conversationId: string,
  payload: {
    role: "user" | "assistant";
    type?: "text" | "image";
    content: string;
    meta?: any;
  },
) {
  const res = await apiRequest("POST", `/api/app/conversations/${conversationId}/messages`, payload);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to save message");
  }
  return res.json() as Promise<ConversationMessage>;
}
