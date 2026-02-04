import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AiConversationFlowSetting {
  id: string;
  categoryKey: string;
  categoryName: string;
  isEnabled: boolean;
  displayOrder: number;
  emoji: string | null;
  description: string | null;
  initialMessage: string | null;
  followUpSteps: any[] | null;
  confidenceThreshold: string | null;
  visualsHelpful: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useAiConversationFlowSettings() {
  const query = useQuery<AiConversationFlowSetting[]>({
    queryKey: ["ai-conversation-flow-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/app/categories");
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    settings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper to build category mappings from settings
export function buildCategoryMappings(settings: AiConversationFlowSetting[]) {
  const titleToKey: Record<string, string> = {};
  const confidenceThresholds: Record<string, number> = {};
  const visualsHelpful: Record<string, boolean> = {};
  const initialMessages: Record<string, string | null> = {};
  const followUpSteps: Record<string, any[] | null> = {};

  for (const setting of settings) {
    if (!setting.isEnabled) continue;
    
    titleToKey[setting.categoryName] = setting.categoryKey;
    confidenceThresholds[setting.categoryKey] = setting.confidenceThreshold 
      ? Math.round(parseFloat(setting.confidenceThreshold) * 100) 
      : 70;
    visualsHelpful[setting.categoryKey] = setting.visualsHelpful;
    initialMessages[setting.categoryKey] = setting.initialMessage;
    followUpSteps[setting.categoryKey] = setting.followUpSteps;
  }

  return {
    titleToKey,
    confidenceThresholds,
    visualsHelpful,
    initialMessages,
    followUpSteps,
  };
}
