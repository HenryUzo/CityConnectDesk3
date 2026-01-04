import { useState, useEffect } from "react";
import askImg from "@/assets/citybuddy/ask.png";
import thinkImg from "@/assets/citybuddy/think.png";
import answerImg from "@/assets/citybuddy/answer.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { RequestsSidebar } from "@/components/resident/RequestsSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle, AlertTriangle, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConversationState = "ask" | "think" | "answer";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiDiagnosis {
  summary: string;
  suggestedChecks: string[];
  whenToCallPro: string[];
}

export default function RequestConversation() {
  const { category } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [conversationState, setConversationState] = useState<ConversationState>("ask");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Tell us what you need?",
      timestamp: new Date(),
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);

  // Fetch categories to get category name
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/categories?scope=global");
        if (!res.ok) throw new Error("Failed to fetch categories");
        return res.json();
      } catch (error) {
        return [];
      }
    },
  });

  const categoryData = categories.find((cat: any) =>
    cat.id === category || cat.name?.toLowerCase().replace(/\s+/g, '-') === category
  );
  const categoryName = categoryData?.name || category?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Spend coins mutation
  const spendCoinsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/app/wallet/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, reason: "service_request_conversation" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to spend coins");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  // AI diagnose mutation
  const diagnoseMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: categoryName,
          description,
          urgency: "medium",
          specialInstructions: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to get AI diagnosis");
      return res.json();
    },
  });

  // Create service request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const res = await fetch("/api/app/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: categoryName,
          description: data.description,
          urgency: "medium",
          specialInstructions: null,
          title: data.title,
        }),
      });
      if (!res.ok) throw new Error("Failed to create service request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] });
    },
  });

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setUserInput("");

    // Start thinking
    setConversationState("think");

    try {
      // Spend coins first
      await spendCoinsMutation.mutateAsync();

      // Get AI diagnosis
      const diagnosisResult = await diagnoseMutation.mutateAsync(userInput);

      // Create service request
      const title = `${categoryName}: ${userInput.slice(0, 40)}${userInput.length > 40 ? '...' : ''}`;
      await createRequestMutation.mutateAsync({
        title,
        description: userInput,
      });

      // Show diagnosis
      setDiagnosis(diagnosisResult);
      setConversationState("answer");

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: diagnosisResult.summary,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      toast({
        title: "Request Submitted",
        description: "Your service request has been created successfully.",
      });

    } catch (error: any) {
      console.error("Error processing request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process your request",
        variant: "destructive",
      });
      setConversationState("ask");
    }
  };

  const handleChangeCategory = () => {
    setLocation("/resident/requests/new");
  };

  const getMascotImage = () => {
    switch (conversationState) {
      case "ask":
        return askImg;
      case "think":
        return thinkImg;
      case "answer":
        return answerImg;
      default:
        return askImg;
    }
  };

  return (
    <ResidentLayout title="Service Requests">
      <div className="flex">
        <RequestsSidebar />

        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/resident/requests/new")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    You selected {categoryName} category
                  </h1>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-emerald-600"
                    onClick={handleChangeCategory}
                  >
                    Change category
                  </Button>
                </div>
              </div>
            </div>

            {/* Conversation Area */}
            <Card className="mb-6">
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <img
                      src={getMascotImage()}
                      alt="CityBuddy"
                      className="w-16 h-16 rounded-full"
                      onError={(e) => {
                        // Fallback to emoji if image fails
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = 'none';
                        const next = img.nextElementSibling as HTMLElement | null;
                        if (next) next.style.display = 'flex';
                      }}
                    />
                    <div
                      className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl hidden"
                    >
                      🤖
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-md px-4 py-2 rounded-lg ${
                              message.type === "user"
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ))}

                      {diagnosis && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <Wrench className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium text-blue-900 mb-2">AI Diagnosis</h4>

                              {diagnosis.suggestedChecks && diagnosis.suggestedChecks.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-sm font-medium text-blue-800 mb-1">Suggested Checks:</p>
                                  <ul className="text-sm text-blue-700 space-y-1">
                                    {diagnosis.suggestedChecks.map((check, i) => (
                                      <li key={i} className="flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-2 text-green-600" />
                                        {check}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {diagnosis.whenToCallPro && diagnosis.whenToCallPro.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-blue-800 mb-1">When to Call a Pro:</p>
                                  <ul className="text-sm text-blue-700 space-y-1">
                                    {diagnosis.whenToCallPro.map((item, i) => (
                                      <li key={i} className="flex items-center">
                                        <AlertTriangle className="w-3 h-3 mr-2 text-orange-600" />
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input Area */}
                    <div className="mt-6 flex space-x-3">
                      <Textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Describe what services you need rendered..."
                        className="flex-1 min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!userInput.trim() || conversationState === "think"}
                        className="self-end bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {diagnosis && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/service-requests")}
                >
                  View Request
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ResidentLayout>
  );
}