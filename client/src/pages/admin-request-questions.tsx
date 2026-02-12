import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { adminApiRequest } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";

type RequestConversationSettings = {
  id?: string;
  mode?: "ai" | "ordinary";
  aiProvider?: "gemini" | "ollama" | "openai";
  aiModel?: string | null;
  aiTemperature?: number | null;
  aiSystemPrompt?: string | null;
  ordinaryPresentation?: "chat" | "form";
  adminWaitThresholdMs?: number | null;
};

type RequestQuestion = {
  id: string;
  mode: "ai" | "ordinary";
  scope: "global" | "category";
  categoryKey?: string | null;
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "date"
    | "datetime"
    | "estate"
    | "urgency"
    | "image"
    | "multi_image";
  required: boolean;
  options?: any;
  order: number;
  isEnabled: boolean;
};

type ResidentUser = {
  id?: string;
  _id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  globalRole?: string | null;
};

const QUESTION_TYPES: RequestQuestion["type"][] = [
  "text",
  "textarea",
  "select",
  "date",
  "datetime",
  "estate",
  "urgency",
  "image",
  "multi_image",
];

const MODEL_OPTIONS: Record<NonNullable<RequestConversationSettings["aiProvider"]>, string[]> = {
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  ollama: ["qwen2.5:7b", "mistral:7b", "llama3.1:8b"],
};

type AdminRequestQuestionsProps = {
  user?: {
    globalRole?: string | null;
  } | null;
};

export default function AdminRequestQuestions({ user }: AdminRequestQuestionsProps) {
  const { toast } = useToast();

  const { data: settings, refetch: refetchSettings, isLoading: settingsLoading } = useQuery<RequestConversationSettings | null>({
    queryKey: ["/api/admin/request-config/settings"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/request-config/settings"),
  });

  const { data: ordinaryQuestions = [], refetch: refetchOrdinary } = useQuery<RequestQuestion[]>({
    queryKey: ["/api/admin/request-config/questions", "ordinary"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/request-config/questions?mode=ordinary"),
  });

  const { data: aiQuestions = [], refetch: refetchAi } = useQuery<RequestQuestion[]>({
    queryKey: ["/api/admin/request-config/questions", "ai"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/request-config/questions?mode=ai"),
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/categories"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/categories"),
  });

  const [settingsForm, setSettingsForm] = useState<RequestConversationSettings>({
    mode: "ai",
    aiProvider: "gemini",
    aiModel: "",
    aiTemperature: null,
    aiSystemPrompt: "",
    ordinaryPresentation: "chat",
    adminWaitThresholdMs: 300000,
  });

  useEffect(() => {
    if (!settings) return;
    setSettingsForm({
      mode: settings.mode ?? "ai",
      aiProvider: settings.aiProvider ?? "gemini",
      aiModel: settings.aiModel ?? "",
      aiTemperature: settings.aiTemperature ?? null,
      aiSystemPrompt: settings.aiSystemPrompt ?? "",
      ordinaryPresentation: settings.ordinaryPresentation ?? "chat",
      adminWaitThresholdMs: settings.adminWaitThresholdMs ?? 300000,
    });
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: RequestConversationSettings) =>
      adminApiRequest("PATCH", "/api/admin/request-config/settings", payload),
    onSuccess: async () => {
      await refetchSettings();
      toast({ title: "Settings saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const testModelMutation = useMutation({
    mutationFn: (payload: { provider: "gemini" | "ollama" | "openai"; model: string }) =>
      adminApiRequest("POST", "/api/admin/request-config/test-model", payload),
    onSuccess: (data: any) => {
      const sample = data?.sample ? ` Sample: ${data.sample}` : "";
      toast({
        title: "Model OK",
        description: `Provider: ${data?.provider || ""} • Model: ${data?.model || ""} • ${data?.elapsedMs ?? ""}ms.${sample}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Model test failed",
        description: error?.message || "Unable to reach the provider.",
        variant: "destructive",
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: Partial<RequestQuestion> & { id: string }) =>
      adminApiRequest("PATCH", `/api/admin/request-config/questions/${payload.id}`, payload),
    onSuccess: async () => {
      await Promise.all([refetchOrdinary(), refetchAi()]);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => adminApiRequest("DELETE", `/api/admin/request-config/questions/${id}`),
    onSuccess: async () => {
      await Promise.all([refetchOrdinary(), refetchAi()]);
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: (payload: Partial<RequestQuestion>) =>
      adminApiRequest("POST", "/api/admin/request-config/questions", payload),
    onSuccess: async () => {
      await Promise.all([refetchOrdinary(), refetchAi()]);
      toast({ title: "Question added" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      adminApiRequest("POST", "/api/admin/request-config/questions/reorder", { orderedIds }),
    onSuccess: async () => {
      await Promise.all([refetchOrdinary(), refetchAi()]);
    },
  });

  const [newQuestion, setNewQuestion] = useState<Partial<RequestQuestion>>({
    mode: "ordinary",
    scope: "global",
    key: "",
    label: "",
    type: "text",
    required: false,
    isEnabled: true,
  });

  const [residentSearch, setResidentSearch] = useState("");
  const [previewResidentId, setPreviewResidentId] = useState("");

  const { data: residentUsers = [], isLoading: residentsLoading } = useQuery<ResidentUser[]>({
    queryKey: ["/api/admin/users/all", "resident-preview", residentSearch],
    queryFn: async () =>
      adminApiRequest("GET", "/api/admin/users/all", {
        role: "resident",
        search: residentSearch || undefined,
      }),
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => adminApiRequest("POST", `/api/admin/impersonate/${userId}`),
    onSuccess: () => {
      toast({
        title: "Preview started",
        description: "You are now viewing the resident experience.",
      });
      window.location.href = "/resident/requests/new";
    },
    onError: (error: any) => {
      toast({
        title: "Preview failed",
        description: error?.message || "Unable to impersonate user.",
        variant: "destructive",
      });
    },
  });

  const handleMove = (mode: "ai" | "ordinary", index: number, direction: "up" | "down") => {
    const list = mode === "ordinary" ? [...ordinaryQuestions] : [...aiQuestions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(targetIndex, 0, item);
    reorderMutation.mutate(list.map((q) => q.id));
  };

  const saveQuestion = (question: RequestQuestion) => {
    updateQuestionMutation.mutate({
      id: question.id,
      label: question.label,
      key: question.key,
      type: question.type,
      required: question.required,
      isEnabled: question.isEnabled,
      scope: question.scope,
      categoryKey: question.categoryKey ?? null,
      options: question.options ?? null,
    });
  };

  const questionsByMode = useMemo(
    () => ({
      ordinary: ordinaryQuestions,
      ai: aiQuestions,
    }),
    [ordinaryQuestions, aiQuestions],
  );

  const isSuperAdmin = String(user?.globalRole ?? "").toLowerCase() === "super_admin";

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
      </Card>
    );
  }

  const handleProviderChange = (value: "gemini" | "ollama" | "openai") => {
    const options = MODEL_OPTIONS[value] ?? [];
    const currentModel = settingsForm.aiModel ?? "";
    const shouldKeep = currentModel && options.includes(currentModel);
    const nextModel = shouldKeep ? currentModel : options[0] ?? "";
    const next = { ...settingsForm, aiProvider: value, aiModel: nextModel };
    setSettingsForm(next);
    updateSettingsMutation.mutate(next);
  };

  const renderQuestionsCard = (mode: "ordinary" | "ai") => (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "ordinary" ? "Ordinary Questions" : "AI Questions"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {questionsByMode[mode].map((question, index) => (
            <div
              key={question.id}
              className="border rounded-lg p-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  Question {index + 1}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={question.isEnabled}
                    onCheckedChange={(checked) =>
                      updateQuestionMutation.mutate({ id: question.id, isEnabled: checked })
                    }
                  />
                  <span className="text-sm">Enabled</span>
                  <Button variant="ghost" size="icon" onClick={() => handleMove(mode, index, "up")}>
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleMove(mode, index, "down")}>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Question label</label>
                  <Textarea
                    value={question.label}
                    onChange={(event) =>
                      updateQuestionMutation.mutate({ id: question.id, label: event.target.value })
                    }
                    placeholder="What should we ask the user?"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Internal key</label>
                  <Input
                    value={question.key}
                    onChange={(event) =>
                      updateQuestionMutation.mutate({ id: question.id, key: event.target.value })
                    }
                    placeholder="Short identifier, e.g. issue_details"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Answer type</label>
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestionMutation.mutate({ id: question.id, type: value as RequestQuestion["type"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Scope</label>
                  <Select
                    value={question.scope}
                    onValueChange={(value) =>
                      updateQuestionMutation.mutate({ id: question.id, scope: value as RequestQuestion["scope"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Global applies to all categories.
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Category</label>
                  {question.scope === "category" ? (
                    <Select
                      value={question.categoryKey ?? ""}
                      onValueChange={(value) =>
                        updateQuestionMutation.mutate({ id: question.id, categoryKey: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.key}>
                            {cat.emoji && <span>{cat.emoji} </span>}
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-muted-foreground flex items-center h-10">
                      Select "Category" scope to choose a category.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Options</label>
                  {question.type === "select" ? (
                    <div className="space-y-2 border rounded p-3 bg-gray-50">
                      {Array.isArray(question.options) && question.options.length > 0 ? (
                        question.options.map((option: string, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOpts = [...question.options];
                                newOpts[idx] = e.target.value;
                                updateQuestionMutation.mutate({ id: question.id, options: newOpts });
                              }}
                              placeholder={`Option ${idx + 1}`}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                const newOpts = question.options.filter((_: string, i: number) => i !== idx);
                                updateQuestionMutation.mutate({ id: question.id, options: newOpts });
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No options yet</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOpts = Array.isArray(question.options) ? [...question.options, ""] : [""];
                          updateQuestionMutation.mutate({ id: question.id, options: newOpts });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Option
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground flex items-center h-10">
                      Only needed for select questions.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestionMutation.mutate({ id: question.id, required: checked })
                    }
                  />
                  <span className="text-sm">Required</span>
                </div>
                <Button variant="outline" onClick={() => saveQuestion(question)}>
                  Save
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteQuestionMutation.mutate(question.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="w-4 h-4" />
            Add question
          </div>
          <div className="grid gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Question label</label>
              <Textarea
                value={newQuestion.label ?? ""}
                onChange={(event) => setNewQuestion((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="What should we ask the user?"
                rows={3}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Internal key</label>
              <Input
                value={newQuestion.key ?? ""}
                onChange={(event) => setNewQuestion((prev) => ({ ...prev, key: event.target.value }))}
                placeholder="Short identifier, e.g. issue_details"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Answer type</label>
              <Select
                value={newQuestion.type as string}
                onValueChange={(value) => setNewQuestion((prev) => ({ ...prev, type: value as RequestQuestion["type"] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Scope</label>
              <Select
                value={newQuestion.scope as string}
                onValueChange={(value) => setNewQuestion((prev) => ({ ...prev, scope: value as RequestQuestion["scope"] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Global applies to all categories.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              {newQuestion.scope === "category" ? (
                <Select
                  value={newQuestion.categoryKey ?? ""}
                  onValueChange={(value) =>
                    setNewQuestion((prev) => ({ ...prev, categoryKey: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.key}>
                        {cat.emoji && <span>{cat.emoji} </span>}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center h-10">
                  Select "Category" scope to choose a category.
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Options</label>
              {newQuestion.type === "select" ? (
                <div className="space-y-2 border rounded p-3 bg-gray-50">
                  {Array.isArray(newQuestion.options) && newQuestion.options.length > 0 ? (
                    newQuestion.options.map((option: string, idx: number) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOpts = [...newQuestion.options];
                            newOpts[idx] = e.target.value;
                            setNewQuestion((prev) => ({ ...prev, options: newOpts }));
                          }}
                          placeholder={`Option ${idx + 1}`}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const newOpts = newQuestion.options.filter((_: string, i: number) => i !== idx);
                            setNewQuestion((prev) => ({ ...prev, options: newOpts }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No options yet</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOpts = Array.isArray(newQuestion.options) ? [...newQuestion.options, ""] : [""];
                      setNewQuestion((prev) => ({ ...prev, options: newOpts }));
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center h-10">
                  Only needed for select questions.
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={newQuestion.required ?? false}
                onCheckedChange={(checked) => setNewQuestion((prev) => ({ ...prev, required: checked }))}
              />
              <span className="text-sm">Required</span>
            </div>
          </div>
          <Button
            onClick={() =>
              createQuestionMutation.mutate({
                ...newQuestion,
                mode,
              })
            }
          >
            Add question
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ai-questions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-11">
          <TabsTrigger value="ai-questions">AI Questions</TabsTrigger>
          <TabsTrigger value="ordinary-questions">Ordinary Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Resident Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-questions" className="space-y-6">
          {renderQuestionsCard("ai")}
        </TabsContent>
        <TabsContent value="ordinary-questions" className="space-y-6">
          {renderQuestionsCard("ordinary")}
        </TabsContent>
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div>Loading settings...</div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mode</label>
                      <Select
                        value={settingsForm.mode}
                        onValueChange={(value) => setSettingsForm((prev) => ({ ...prev, mode: value as "ai" | "ordinary" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai">AI</SelectItem>
                          <SelectItem value="ordinary">Ordinary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ordinary Presentation</label>
                      <Select
                        value={settingsForm.ordinaryPresentation}
                        onValueChange={(value) =>
                          setSettingsForm((prev) => ({ ...prev, ordinaryPresentation: value as "chat" | "form" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select presentation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chat">Chat</SelectItem>
                          <SelectItem value="form">Form</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">AI Provider</label>
                      <Select
                        value={settingsForm.aiProvider}
                        onValueChange={(value) => handleProviderChange(value as "gemini" | "ollama" | "openai")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="ollama">Ollama</SelectItem>
                          <SelectItem value="openai">ChatGPT (OpenAI)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground">
                        Provider changes apply immediately.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">AI Model</label>
                      {(() => {
                        const provider = settingsForm.aiProvider ?? "gemini";
                        const options = MODEL_OPTIONS[provider] ?? [];
                        const currentModel = settingsForm.aiModel ?? "";
                        const isCustom = currentModel !== "" && !options.includes(currentModel);
                        const selectValue = isCustom ? "__custom__" : (currentModel || options[0] || "");

                        return (
                          <div className="space-y-2">
                            <Select
                              value={selectValue}
                              onValueChange={(value) => {
                                if (value === "__custom__") {
                                  setSettingsForm((prev) => ({ ...prev, aiModel: "" }));
                                  return;
                                }
                                setSettingsForm((prev) => ({ ...prev, aiModel: value }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__custom__">Custom model…</SelectItem>
                              </SelectContent>
                            </Select>

                            {(selectValue === "__custom__" || isCustom) ? (
                              <Input
                                value={settingsForm.aiModel ?? ""}
                                onChange={(event) =>
                                  setSettingsForm((prev) => ({ ...prev, aiModel: event.target.value }))
                                }
                                placeholder="Enter custom model id"
                              />
                            ) : null}

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const provider = settingsForm.aiProvider ?? "gemini";
                                  const model = (settingsForm.aiModel || "").trim();
                                  if (!model) {
                                    toast({ title: "Select a model first", variant: "destructive" });
                                    return;
                                  }
                                  testModelMutation.mutate({ provider, model });
                                }}
                                disabled={testModelMutation.isPending}
                              >
                                Test model
                              </Button>
                              {testModelMutation.isPending ? (
                                <span className="text-xs text-muted-foreground">Testing…</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">System Prompt Override</label>
                    <Textarea
                      value={settingsForm.aiSystemPrompt ?? ""}
                      onChange={(event) => setSettingsForm((prev) => ({ ...prev, aiSystemPrompt: event.target.value }))}
                      placeholder="Optional override for the AI system prompt"
                      rows={4}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Temperature</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={settingsForm.aiTemperature ?? ""}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          aiTemperature: event.target.value === "" ? null : Number(event.target.value),
                        }))
                      }
                      className="w-28"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Wait Threshold (milliseconds)</label>
                    <Input
                      type="number"
                      min="0"
                      max="600000"
                      step="10000"
                      value={settingsForm.adminWaitThresholdMs ?? 300000}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          adminWaitThresholdMs: Number(event.target.value) || 300000,
                        }))
                      }
                      placeholder="300000"
                    />
                    <div className="text-xs text-muted-foreground">
                      How long to wait (in ms) before escalating to super admin. Default: 300000ms (5 minutes). Max: 600000ms (10 minutes).
                    </div>
                  </div>

                  <Button
                    onClick={() => updateSettingsMutation.mutate(settingsForm)}
                    disabled={updateSettingsMutation.isPending}
                  >
                    Save Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview Resident Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Test the current questions by impersonating a resident. You will see the resident chat flow
                exactly as users do. Use the banner at the top of the page to stop impersonating when you’re done.
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Find a resident</label>
                  <Input
                    value={residentSearch}
                    onChange={(event) => setResidentSearch(event.target.value)}
                    placeholder="Search by name, email, or phone"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Select resident</label>
                  <Select
                    value={previewResidentId}
                    onValueChange={(value) => setPreviewResidentId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={residentsLoading ? "Loading..." : "Choose a resident"} />
                    </SelectTrigger>
                    <SelectContent>
                      {residentUsers.map((u) => {
                        const id = String(u.id || u._id || "");
                        const label = u.name || u.email || u.phone || "Unnamed resident";
                        return (
                          <SelectItem key={id} value={id}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => previewResidentId && impersonateMutation.mutate(previewResidentId)}
                  disabled={!previewResidentId || impersonateMutation.isPending}
                >
                  Open resident preview
                </Button>
                <div className="text-xs text-muted-foreground">
                  This will switch your session to the selected resident until you stop impersonating.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
