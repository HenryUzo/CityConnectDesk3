export type ChatHistoryItem =
  | { id: string; type: "user_text"; text: string; ts: number }
  | { id: string; type: "ai_message"; text: string; meta?: any; ts: number }
  | { id: string; type: "image"; dataUrl: string; ts: number };

export type ChatEngineState = {
  history: ChatHistoryItem[];
  payload: Record<string, any>;
  isComplete: boolean;
};

export type ChatEngine = {
  init(): Promise<void>;
  onUserSend(input: { text?: string; images?: string[] }): Promise<void>;
  getState(): ChatEngineState;
};
