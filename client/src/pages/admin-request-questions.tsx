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
import {
  buildEditableLegacyQuestions,
  normalizeCategoryKey,
  type EditableLegacyQuestion,
} from "@/lib/ordinaryLegacyFlow";

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

type OrdinaryFlowDefinition = {
  id: string;
  categoryKey: string;
  scope: "global" | "estate";
  estateId?: string | null;
  name: string;
  version: number;
  status: "draft" | "published" | "archived";
  isDefault: boolean;
  publishedAt?: string | null;
  updatedAt?: string | null;
  questionCount?: number;
};

type OrdinaryFlowQuestion = {
  id: string;
  flowId: string;
  questionKey: string;
  prompt: string;
  description?: string | null;
  inputType:
    | "single_select"
    | "multi_select"
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "location"
    | "file"
    | "yes_no"
    | "urgency"
    | "estate";
  isRequired: boolean;
  isTerminal: boolean;
  orderIndex: number;
  validation?: any;
  uiMeta?: any;
  defaultNextQuestionId?: string | null;
};

type OrdinaryFlowOption = {
  id: string;
  questionId: string;
  optionKey: string;
  label: string;
  value: string;
  icon?: string | null;
  orderIndex: number;
  nextQuestionId?: string | null;
  meta?: any;
};

type OrdinaryFlowRule = {
  id: string;
  flowId: string;
  fromQuestionId: string;
  priority: number;
  conditionJson?: any;
  action: "goto_question" | "terminate" | "set_value" | "skip";
  nextQuestionId?: string | null;
  actionPayload?: any;
  isActive: boolean;
};

type OrdinaryFlowDetail = {
  definition: OrdinaryFlowDefinition;
  questions: OrdinaryFlowQuestion[];
  options: OrdinaryFlowOption[];
  rules: OrdinaryFlowRule[];
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

  const { data: residentCategorySettings = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/ai-conversation-flow", "resident-categories"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/ai-conversation-flow"),
  });

  const flowCategoryOptions = useMemo(
    () =>
      (Array.isArray(residentCategorySettings) ? residentCategorySettings : [])
        .filter((category: any) => category?.isEnabled !== false)
        .map((category: any) => {
          const key = normalizeCategoryKey(String(category?.categoryKey ?? category?.key ?? ""));
          const name = String(category?.categoryName ?? category?.name ?? category?.categoryKey ?? "").trim();
          if (!key || !name) return null;
          return { key, name };
        })
        .filter((category): category is { key: string; name: string } => Boolean(category))
        .filter((category, index, all) => all.findIndex((item) => item.key === category.key) === index)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [residentCategorySettings],
  );

  const [flowCategoryFilter, setFlowCategoryFilter] = useState("all");
  const [flowStatusFilter, setFlowStatusFilter] = useState("published");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [questionsJson, setQuestionsJson] = useState("[]");
  const [optionsJson, setOptionsJson] = useState("[]");
  const [rulesJson, setRulesJson] = useState("[]");
  const [flowQuestionsDraft, setFlowQuestionsDraft] = useState<OrdinaryFlowQuestion[]>([]);
  const [flowOptionsDraft, setFlowOptionsDraft] = useState<OrdinaryFlowOption[]>([]);
  const [flowRulesDraft, setFlowRulesDraft] = useState<OrdinaryFlowRule[]>([]);
  const [legacyFallbackDraft, setLegacyFallbackDraft] = useState<EditableLegacyQuestion[]>([]);
  const [expandedLegacyQuestionKey, setExpandedLegacyQuestionKey] = useState("");
  const [expandedFlowQuestionId, setExpandedFlowQuestionId] = useState("");

  const { data: ordinaryFlows = [], refetch: refetchOrdinaryFlows } = useQuery<OrdinaryFlowDefinition[]>({
    queryKey: ["/api/admin/ordinary-flows", flowCategoryFilter, flowStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (flowCategoryFilter !== "all") params.set("categoryKey", flowCategoryFilter);
      if (flowStatusFilter !== "all") params.set("status", flowStatusFilter);
      return await adminApiRequest("GET", `/api/admin/ordinary-flows?${params.toString()}`);
    },
  });

  const { data: selectedFlowDetail, refetch: refetchSelectedFlowDetail, isLoading: selectedFlowLoading } =
    useQuery<OrdinaryFlowDetail | null>({
      queryKey: ["/api/admin/ordinary-flows/:id", selectedFlowId],
      enabled: Boolean(selectedFlowId),
      queryFn: async () => await adminApiRequest("GET", `/api/admin/ordinary-flows/${selectedFlowId}`),
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

  useEffect(() => {
    if (!selectedFlowDetail) return;
    setQuestionsJson(JSON.stringify(selectedFlowDetail.questions ?? [], null, 2));
    setOptionsJson(JSON.stringify(selectedFlowDetail.options ?? [], null, 2));
    setRulesJson(JSON.stringify(selectedFlowDetail.rules ?? [], null, 2));
    setFlowQuestionsDraft(selectedFlowDetail.questions ?? []);
    setFlowOptionsDraft(selectedFlowDetail.options ?? []);
    setFlowRulesDraft(selectedFlowDetail.rules ?? []);
  }, [selectedFlowDetail]);

  useEffect(() => {
    if (!ordinaryFlows.length) {
      if (selectedFlowId) setSelectedFlowId("");
      return;
    }
    if (!selectedFlowId || !ordinaryFlows.some((flow) => String(flow.id) === String(selectedFlowId))) {
      setSelectedFlowId(String(ordinaryFlows[0].id));
    }
  }, [ordinaryFlows, selectedFlowId]);

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

  const createFlowMutation = useMutation({
    mutationFn: (payload: { categoryKey: string; name: string; scope?: "global" | "estate" }) =>
      adminApiRequest("POST", "/api/admin/ordinary-flows", payload),
    onSuccess: async (created: OrdinaryFlowDefinition) => {
      await refetchOrdinaryFlows();
      setSelectedFlowId(String(created.id));
      toast({ title: "Draft flow created" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create flow",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const saveFlowQuestionsMutation = useMutation({
    mutationFn: (payload: { flowId: string; questions: any[] }) =>
      adminApiRequest("PUT", `/api/admin/ordinary-flows/${payload.flowId}/questions`, {
        questions: payload.questions,
      }),
    onSuccess: async () => {
      await Promise.all([refetchSelectedFlowDetail(), refetchOrdinaryFlows()]);
      toast({ title: "Questions saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save questions",
        description: error?.message || "Check your JSON payload.",
        variant: "destructive",
      });
    },
  });

  const saveFlowOptionsMutation = useMutation({
    mutationFn: (payload: { flowId: string; options: any[] }) =>
      adminApiRequest("PUT", `/api/admin/ordinary-flows/${payload.flowId}/options`, {
        options: payload.options,
      }),
    onSuccess: async () => {
      await refetchSelectedFlowDetail();
      toast({ title: "Options saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save options",
        description: error?.message || "Check question ids and option payload.",
        variant: "destructive",
      });
    },
  });

  const saveFlowRulesMutation = useMutation({
    mutationFn: (payload: { flowId: string; rules: any[] }) =>
      adminApiRequest("PUT", `/api/admin/ordinary-flows/${payload.flowId}/rules`, {
        rules: payload.rules,
      }),
    onSuccess: async () => {
      await refetchSelectedFlowDetail();
      toast({ title: "Rules saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save rules",
        description: error?.message || "Check rule payload.",
        variant: "destructive",
      });
    },
  });

  const validateFlowMutation = useMutation({
    mutationFn: (flowId: string) => adminApiRequest("POST", `/api/admin/ordinary-flows/${flowId}/validate`),
    onSuccess: (result: any) => {
      const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
      toast({
        title: "Flow validated",
        description: warningCount ? `${warningCount} warnings found.` : "No validation issues.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Validation failed",
        description: error?.message || "Please fix flow graph errors.",
        variant: "destructive",
      });
    },
  });

  const publishFlowMutation = useMutation({
    mutationFn: (flowId: string) => adminApiRequest("POST", `/api/admin/ordinary-flows/${flowId}/publish`),
    onSuccess: async () => {
      await Promise.all([refetchOrdinaryFlows(), refetchSelectedFlowDetail()]);
      toast({ title: "Flow published" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not publish flow",
        description: error?.message || "Fix validation issues first.",
        variant: "destructive",
      });
    },
  });

  const cloneFlowMutation = useMutation({
    mutationFn: (flowId: string) => adminApiRequest("POST", `/api/admin/ordinary-flows/${flowId}/clone`),
    onSuccess: async (flow: OrdinaryFlowDefinition) => {
      await refetchOrdinaryFlows();
      setSelectedFlowId(String(flow.id));
      toast({ title: "Flow cloned as draft" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not clone flow",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
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
  const [newFlowCategoryKey, setNewFlowCategoryKey] = useState("");
  const [newFlowName, setNewFlowName] = useState("Ordinary Flow Draft");
  const currentResidentCategoryKey = flowCategoryFilter !== "all" ? flowCategoryFilter : newFlowCategoryKey;
  const currentResidentCategoryLabel =
    flowCategoryOptions.find((category) => category.key === currentResidentCategoryKey)?.name ||
    currentResidentCategoryKey ||
    "selected category";

  useEffect(() => {
    if (!flowCategoryOptions.length) {
      if (newFlowCategoryKey) setNewFlowCategoryKey("");
      return;
    }
    if (!newFlowCategoryKey || !flowCategoryOptions.some((option) => option.key === newFlowCategoryKey)) {
      setNewFlowCategoryKey(flowCategoryOptions[0].key);
    }
  }, [flowCategoryOptions, newFlowCategoryKey]);

  useEffect(() => {
    if (!currentResidentCategoryKey) {
      setLegacyFallbackDraft([]);
      return;
    }
    setLegacyFallbackDraft(
      buildEditableLegacyQuestions({
        categoryKey: currentResidentCategoryKey,
        categoryName: currentResidentCategoryLabel,
        ordinaryQuestions,
      }),
    );
  }, [currentResidentCategoryKey, currentResidentCategoryLabel, ordinaryQuestions]);

  useEffect(() => {
    const firstQuestionKey =
      legacyFallbackDraft
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0]?.key ?? "";
    if (!firstQuestionKey) {
      setExpandedLegacyQuestionKey("");
      return;
    }
    if (!expandedLegacyQuestionKey || !legacyFallbackDraft.some((question) => question.key === expandedLegacyQuestionKey)) {
      setExpandedLegacyQuestionKey(firstQuestionKey);
    }
  }, [expandedLegacyQuestionKey, legacyFallbackDraft]);

  useEffect(() => {
    const firstQuestionId =
      flowQuestionsDraft
        .slice()
        .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0))[0]?.id ?? "";
    if (!firstQuestionId) {
      setExpandedFlowQuestionId("");
      return;
    }
    if (!expandedFlowQuestionId || !flowQuestionsDraft.some((question) => question.id === expandedFlowQuestionId)) {
      setExpandedFlowQuestionId(firstQuestionId);
    }
  }, [expandedFlowQuestionId, flowQuestionsDraft]);

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
        {mode === "ordinary" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            These are legacy fallback questions. If a category has a published dynamic flow, residents will see the
            questions in the <span className="font-semibold">Ordinary Dynamic Flows</span> tab instead.
          </div>
        ) : null}
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
                        {flowCategoryOptions.map((cat) => (
                          <SelectItem key={cat.key} value={cat.key}>
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
                    {flowCategoryOptions.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
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

  const parseJsonArray = (raw: string, label: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Payload must be an array.");
      return parsed;
    } catch (error: any) {
      toast({
        title: `${label} JSON is invalid`,
        description: error?.message || "Check syntax and try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSaveFlowQuestions = () => {
    if (!selectedFlowId) return;
    const parsed = parseJsonArray(questionsJson, "Questions");
    if (!parsed) return;
    saveFlowQuestionsMutation.mutate({ flowId: selectedFlowId, questions: parsed });
  };

  const handleSaveFlowOptions = () => {
    if (!selectedFlowId) return;
    const parsed = parseJsonArray(optionsJson, "Options");
    if (!parsed) return;
    saveFlowOptionsMutation.mutate({ flowId: selectedFlowId, options: parsed });
  };

  const handleSaveFlowRules = () => {
    if (!selectedFlowId) return;
    const parsed = parseJsonArray(rulesJson, "Rules");
    if (!parsed) return;
    saveFlowRulesMutation.mutate({ flowId: selectedFlowId, rules: parsed });
  };

  const selectedFlowCategoryLabel =
    flowCategoryOptions.find((category) => category.key === selectedFlowDetail?.definition.categoryKey)?.name ||
    selectedFlowDetail?.definition.categoryKey ||
    "Unknown category";

  const flowOptionsByQuestionId = useMemo(() => {
    const grouped = new Map<string, OrdinaryFlowOption[]>();
    flowOptionsDraft.forEach((option) => {
      const key = String(option.questionId || "");
      const existing = grouped.get(key) ?? [];
      existing.push(option);
      grouped.set(key, existing);
    });
    for (const [key, options] of grouped.entries()) {
      grouped.set(
        key,
        [...options].sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0)),
      );
    }
    return grouped;
  }, [flowOptionsDraft]);

  const sortedLegacyFallbackQuestions = useMemo(
    () =>
      legacyFallbackDraft
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [legacyFallbackDraft],
  );

  const sortedFlowQuestions = useMemo(
    () =>
      flowQuestionsDraft
        .slice()
        .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0)),
    [flowQuestionsDraft],
  );

  const updateFlowQuestionDraft = (questionId: string, patch: Partial<OrdinaryFlowQuestion>) => {
    setFlowQuestionsDraft((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              ...patch,
            }
          : question,
      ),
    );
  };

  const updateFlowOptionDraft = (optionId: string, patch: Partial<OrdinaryFlowOption>) => {
    setFlowOptionsDraft((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...patch,
            }
          : option,
      ),
    );
  };

  const addLegacyFallbackQuestion = () => {
    const existingKeys = new Set(legacyFallbackDraft.map((question) => question.key));
    let suffix = legacyFallbackDraft.length + 1;
    let key = `custom_question_${suffix}`;
    while (existingKeys.has(key)) {
      suffix += 1;
      key = `custom_question_${suffix}`;
    }
    const order =
      legacyFallbackDraft.reduce((max, question) => Math.max(max, Number(question.order || 0)), 0) + 1;
    setLegacyFallbackDraft((current) => [
      ...current,
      {
        key,
        label: "New question",
        type: "textarea",
        required: false,
        options: undefined,
        order,
        kind: "text",
        helperText: undefined,
        placeholder: "Type the resident response.",
        conditionalValue: undefined,
        persistedId: null,
        inheritedId: null,
        isEnabled: true,
        source: "category",
      },
    ]);
    setExpandedLegacyQuestionKey(key);
  };

  const addFlowQuestionDraft = () => {
    const id = `new-question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order =
      flowQuestionsDraft.reduce((max, question) => Math.max(max, Number(question.orderIndex || 0)), 0) + 1;
    const nextIndex = flowQuestionsDraft.length + 1;
    setFlowQuestionsDraft((current) => [
      ...current,
      {
        id,
        flowId: selectedFlowId,
        questionKey: `question_${nextIndex}`,
        prompt: "New question",
        description: "",
        inputType: "text",
        isRequired: false,
        isTerminal: false,
        orderIndex: order,
        validation: {},
        uiMeta: {},
        defaultNextQuestionId: null,
      },
    ]);
    setExpandedFlowQuestionId(id);
  };

  const addFlowOptionDraft = (questionId: string) => {
    const currentOptions = flowOptionsByQuestionId.get(questionId) ?? [];
    const order =
      currentOptions.reduce((max, option) => Math.max(max, Number(option.orderIndex || 0)), 0) + 1;
    const id = `new-option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFlowOptionsDraft((current) => [
      ...current,
      {
        id,
        questionId,
        optionKey: `option_${order}`,
        label: `Option ${order}`,
        value: `option_${order}`,
        icon: null,
        orderIndex: order,
        nextQuestionId: null,
        meta: {},
      },
    ]);
  };

  const handleSaveVisualFlowQuestions = () => {
    if (!selectedFlowId) return;
    saveFlowQuestionsMutation.mutate({
      flowId: selectedFlowId,
      questions: flowQuestionsDraft.map((question) => ({
        id: question.id,
        questionKey: question.questionKey,
        prompt: question.prompt,
        description: question.description ?? null,
        inputType: question.inputType,
        isRequired: question.isRequired,
        isTerminal: question.isTerminal,
        orderIndex: Number(question.orderIndex || 0),
        validation: question.validation ?? {},
        uiMeta: question.uiMeta ?? {},
        defaultNextQuestionId: question.defaultNextQuestionId ?? null,
      })),
    });
  };

  const handleSaveVisualFlowOptions = () => {
    if (!selectedFlowId) return;
    saveFlowOptionsMutation.mutate({
      flowId: selectedFlowId,
      options: flowOptionsDraft.map((option) => ({
        id: option.id,
        questionId: option.questionId,
        optionKey: option.optionKey,
        label: option.label,
        value: option.value,
        icon: option.icon ?? null,
        orderIndex: Number(option.orderIndex || 0),
        nextQuestionId: option.nextQuestionId ?? null,
        meta: option.meta ?? {},
      })),
    });
  };

  const updateLegacyFallbackDraft = (questionKey: string, patch: Partial<EditableLegacyQuestion>) => {
    setLegacyFallbackDraft((current) =>
      current.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              ...patch,
            }
          : question,
      ),
    );
  };

  const saveLegacyFallbackQuestion = (question: EditableLegacyQuestion) => {
    const payload: Partial<RequestQuestion> = {
      mode: "ordinary",
      scope: "category",
      categoryKey: normalizeCategoryKey(currentResidentCategoryKey),
      key: question.key,
      label: question.label,
      type: question.type as RequestQuestion["type"],
      required: question.required,
      options: question.options ?? null,
      order: question.order,
      isEnabled: question.isEnabled,
    };

    if (question.persistedId) {
      updateQuestionMutation.mutate({
        id: question.persistedId,
        ...payload,
      });
      return;
    }

    createQuestionMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ordinary-dynamic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-11">
          <TabsTrigger value="ai-questions">AI Questions</TabsTrigger>
          <TabsTrigger value="ordinary-questions">Legacy Fallback Questions</TabsTrigger>
          <TabsTrigger value="ordinary-dynamic">Live Resident Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Resident Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-questions" className="space-y-6">
          {renderQuestionsCard("ai")}
        </TabsContent>
        <TabsContent value="ordinary-questions" className="space-y-6">
          {renderQuestionsCard("ordinary")}
        </TabsContent>
        <TabsContent value="ordinary-dynamic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Resident Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr,0.75fr,0.75fr]">
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Live editor
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-slate-900">
                    Edit the exact questions residents currently see.
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    Use this screen to review the active flow for a category, update wording, and manage answer options
                    without guessing which question powers the resident experience.
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Current category
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-slate-900">{currentResidentCategoryLabel}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Source: {selectedFlowId ? "Dynamic flow" : "Legacy fallback"}
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Resident-visible questions
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-slate-900">
                    {selectedFlowId ? sortedFlowQuestions.length : sortedLegacyFallbackQuestions.length}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    {selectedFlowId
                      ? `${flowOptionsDraft.length} selectable options configured`
                      : `${sortedLegacyFallbackQuestions.filter((question) => question.type === "select").length} selection steps in fallback flow`}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50/80 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">Choose what you want to work on</div>
                <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Category filter</label>
                  <Select value={flowCategoryFilter} onValueChange={setFlowCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {flowCategoryOptions.map((category) => (
                        <SelectItem key={category.key} value={category.key}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status filter</label>
                  <Select value={flowStatusFilter} onValueChange={setFlowStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">New flow category</label>
                  <Select value={newFlowCategoryKey} onValueChange={setNewFlowCategoryKey}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {flowCategoryOptions.length ? (
                        flowCategoryOptions.map((category) => (
                          <SelectItem key={category.key} value={category.key}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>
                          No categories available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">New flow name</label>
                  <Input
                    value={newFlowName}
                    onChange={(event) => setNewFlowName(event.target.value)}
                    placeholder="Ordinary Flow Draft"
                  />
                </div>
              </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    createFlowMutation.mutate({
                      categoryKey: newFlowCategoryKey,
                      name: newFlowName.trim() || `Ordinary Flow Draft (${newFlowCategoryKey})`,
                      scope: "global",
                    })
                  }
                  disabled={createFlowMutation.isPending || !newFlowCategoryKey}
                >
                  Create draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedFlowId && validateFlowMutation.mutate(selectedFlowId)}
                  disabled={!selectedFlowId || validateFlowMutation.isPending}
                >
                  Validate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedFlowId && cloneFlowMutation.mutate(selectedFlowId)}
                  disabled={!selectedFlowId || cloneFlowMutation.isPending}
                >
                  Clone
                </Button>
                <Button
                  onClick={() => selectedFlowId && publishFlowMutation.mutate(selectedFlowId)}
                  disabled={!selectedFlowId || publishFlowMutation.isPending}
                >
                  Publish
                </Button>
              </div>
              <div className="grid gap-4 xl:grid-cols-[300px,1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Available flows</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Choose a dynamic flow to edit, or leave this unselected to work on the current fallback questions.
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-white p-3 space-y-2 max-h-[420px] overflow-auto shadow-sm">
                  {ordinaryFlows.length ? (
                    ordinaryFlows.map((flow) => (
                      <button
                        key={flow.id}
                        type="button"
                        className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                          selectedFlowId === flow.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedFlowId(flow.id)}
                      >
                        <div className="text-sm font-semibold text-slate-900">{flow.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {flow.categoryKey} • v{flow.version} • {flow.status}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Questions: {flow.questionCount ?? 0}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No dynamic flow is published for {currentResidentCategoryLabel} yet.
                    </div>
                  )}
                  </div>
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Question map</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Review the resident sequence here before editing the detailed cards on the right.
                    </p>
                    <div className="mt-3 space-y-2 max-h-[420px] overflow-auto">
                      {(selectedFlowId ? sortedFlowQuestions : sortedLegacyFallbackQuestions).map((question: any, index) => {
                        const title = selectedFlowId ? question.prompt : question.label;
                        const subtitle = selectedFlowId
                          ? `${question.questionKey} • ${question.inputType}`
                          : `${question.key} • ${question.type}`;
                        return (
                          <div
                            key={selectedFlowId ? question.id : question.key}
                            className="rounded-xl border px-3 py-3"
                          >
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Question {index + 1}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{title}</div>
                            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {!selectedFlowId ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Current resident questions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {currentResidentCategoryLabel} is currently using the legacy fallback question set. Edit these
                          questions here, or create and publish a dynamic flow to replace them.
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" onClick={addLegacyFallbackQuestion}>
                            Add question
                          </Button>
                        </div>
                        {sortedLegacyFallbackQuestions.length ? (
                          <div className="space-y-3">
                            {sortedLegacyFallbackQuestions.map((question, index) => (
                              <div key={question.key} className="rounded-2xl border bg-white p-4 space-y-4 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">Question {index + 1}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {question.key} • {question.type} • {question.source}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm">
                                      <Switch
                                        checked={question.isEnabled}
                                        onCheckedChange={(checked) =>
                                          updateLegacyFallbackDraft(question.key, { isEnabled: checked })
                                        }
                                      />
                                      Enabled
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <Switch
                                        checked={question.required}
                                        onCheckedChange={(checked) =>
                                          updateLegacyFallbackDraft(question.key, { required: checked })
                                        }
                                      />
                                      Required
                                    </label>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">Prompt shown to resident</label>
                                  <Textarea
                                    value={question.label}
                                    onChange={(event) =>
                                      updateLegacyFallbackDraft(question.key, { label: event.target.value })
                                    }
                                    rows={2}
                                  />
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Question key</label>
                                    <Input
                                      value={question.key}
                                      onChange={(event) =>
                                        updateLegacyFallbackDraft(question.key, { key: event.target.value })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Answer type</label>
                                    <Select
                                      value={question.type}
                                      onValueChange={(value) =>
                                        updateLegacyFallbackDraft(question.key, {
                                          type: value as EditableLegacyQuestion["type"],
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {QUESTION_TYPES.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Order</label>
                                    <Input
                                      type="number"
                                      value={String(question.order ?? 0)}
                                      onChange={(event) =>
                                        updateLegacyFallbackDraft(question.key, {
                                          order: Number(event.target.value || 0),
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                {question.type === "select" ? (
                                  <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
                                    <div className="text-sm font-medium text-slate-900">Options</div>
                                    {Array.isArray(question.options) && question.options.length ? (
                                      question.options.map((option: string, optionIndex: number) => (
                                        <div key={`${question.key}-${optionIndex}`} className="flex items-center gap-2">
                                          <Input
                                            value={option}
                                            onChange={(event) => {
                                              const nextOptions = Array.isArray(question.options)
                                                ? [...question.options]
                                                : [];
                                              nextOptions[optionIndex] = event.target.value;
                                              updateLegacyFallbackDraft(question.key, {
                                                options: nextOptions,
                                              });
                                            }}
                                          />
                                          <Button
                                            variant="outline"
                                            onClick={() => {
                                              const nextOptions = Array.isArray(question.options)
                                                ? question.options.filter((_: string, idx: number) => idx !== optionIndex)
                                                : [];
                                              updateLegacyFallbackDraft(question.key, {
                                                options: nextOptions,
                                              });
                                            }}
                                          >
                                            Remove
                                          </Button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-sm text-muted-foreground">No options configured.</div>
                                    )}
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        updateLegacyFallbackDraft(question.key, {
                                          options: [...(Array.isArray(question.options) ? question.options : []), ""],
                                        })
                                      }
                                    >
                                      Add option
                                    </Button>
                                  </div>
                                ) : null}
                                <div className="flex justify-end">
                                  <Button variant="outline" onClick={() => saveLegacyFallbackQuestion(question)}>
                                    Save question
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                            No current fallback questions were found for {currentResidentCategoryLabel}.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : selectedFlowLoading ? (
                    <Card>
                      <CardContent className="p-4 text-sm text-muted-foreground">Loading flow…</CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Current resident questions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">{selectedFlowCategoryLabel}</span>
                            {" "}
                            is currently using
                            {" "}
                            <span className="font-semibold text-slate-900">
                              {selectedFlowDetail?.definition.status}
                            </span>
                            {" "}
                            flow
                            {" "}
                            <span className="font-semibold text-slate-900">
                              v{selectedFlowDetail?.definition.version}
                            </span>
                            .
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={handleSaveVisualFlowQuestions} disabled={saveFlowQuestionsMutation.isPending}>
                              Save visible questions
                            </Button>
                            <Button variant="outline" onClick={addFlowQuestionDraft}>
                              Add question
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleSaveVisualFlowOptions}
                              disabled={saveFlowOptionsMutation.isPending}
                            >
                              Save visible options
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {sortedFlowQuestions.length ? (
                              sortedFlowQuestions.map((question, index) => {
                                  const options = flowOptionsByQuestionId.get(question.id) ?? [];
                                  return (
                                    <div key={question.id} className="rounded-2xl border bg-white p-4 space-y-4 shadow-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-semibold text-slate-900">
                                            Question {index + 1}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {question.questionKey} • {question.inputType}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <label className="flex items-center gap-2 text-sm">
                                            <Switch
                                              checked={question.isRequired}
                                              onCheckedChange={(checked) =>
                                                updateFlowQuestionDraft(question.id, { isRequired: checked })
                                              }
                                            />
                                            Required
                                          </label>
                                          <label className="flex items-center gap-2 text-sm">
                                            <Switch
                                              checked={question.isTerminal}
                                              onCheckedChange={(checked) =>
                                                updateFlowQuestionDraft(question.id, { isTerminal: checked })
                                              }
                                            />
                                            Terminal
                                          </label>
                                        </div>
                                      </div>
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-1 md:col-span-2">
                                          <label className="text-xs text-muted-foreground">Prompt shown to resident</label>
                                          <Textarea
                                            value={question.prompt}
                                            onChange={(event) =>
                                              updateFlowQuestionDraft(question.id, { prompt: event.target.value })
                                            }
                                            rows={2}
                                          />
                                        </div>
                                        <div className="space-y-1 md:col-span-3">
                                          <label className="text-xs text-muted-foreground">Helper description</label>
                                          <Input
                                            value={question.description ?? ""}
                                            onChange={(event) =>
                                              updateFlowQuestionDraft(question.id, { description: event.target.value })
                                            }
                                            placeholder="Optional guidance shown under the question"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-xs text-muted-foreground">Question key</label>
                                          <Input
                                            value={question.questionKey}
                                            onChange={(event) =>
                                              updateFlowQuestionDraft(question.id, { questionKey: event.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-xs text-muted-foreground">Input type</label>
                                          <Select
                                            value={question.inputType}
                                            onValueChange={(value) =>
                                              updateFlowQuestionDraft(question.id, {
                                                inputType: value as OrdinaryFlowQuestion["inputType"],
                                              })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="single_select">single_select</SelectItem>
                                              <SelectItem value="multi_select">multi_select</SelectItem>
                                              <SelectItem value="text">text</SelectItem>
                                              <SelectItem value="number">number</SelectItem>
                                              <SelectItem value="date">date</SelectItem>
                                              <SelectItem value="time">time</SelectItem>
                                              <SelectItem value="datetime">datetime</SelectItem>
                                              <SelectItem value="location">location</SelectItem>
                                              <SelectItem value="file">file</SelectItem>
                                              <SelectItem value="yes_no">yes_no</SelectItem>
                                              <SelectItem value="urgency">urgency</SelectItem>
                                              <SelectItem value="estate">estate</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-xs text-muted-foreground">Order</label>
                                          <Input
                                            type="number"
                                            value={String(question.orderIndex ?? 0)}
                                            onChange={(event) =>
                                              updateFlowQuestionDraft(question.id, {
                                                orderIndex: Number(event.target.value || 0),
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                      {["single_select", "multi_select", "yes_no"].includes(question.inputType) ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-medium text-slate-900">Selectable options</div>
                                            <Button variant="outline" onClick={() => addFlowOptionDraft(question.id)}>
                                              Add option
                                            </Button>
                                          </div>
                                          {options.length ? (
                                            options.map((option) => (
                                              <div key={option.id} className="grid gap-3 md:grid-cols-4 rounded-xl border p-3">
                                                <div className="space-y-1">
                                                  <label className="text-xs text-muted-foreground">Option label</label>
                                                  <Input
                                                    value={option.label}
                                                    onChange={(event) =>
                                                      updateFlowOptionDraft(option.id, { label: event.target.value })
                                                    }
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-xs text-muted-foreground">Stored value</label>
                                                  <Input
                                                    value={option.value}
                                                    onChange={(event) =>
                                                      updateFlowOptionDraft(option.id, { value: event.target.value })
                                                    }
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-xs text-muted-foreground">Option key</label>
                                                  <Input
                                                    value={option.optionKey}
                                                    onChange={(event) =>
                                                      updateFlowOptionDraft(option.id, { optionKey: event.target.value })
                                                    }
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-xs text-muted-foreground">Order</label>
                                                  <Input
                                                    type="number"
                                                    value={String(option.orderIndex ?? 0)}
                                                    onChange={(event) =>
                                                      updateFlowOptionDraft(option.id, {
                                                        orderIndex: Number(event.target.value || 0),
                                                      })
                                                    }
                                                  />
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                                              No options yet. Add the first option for this question.
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                            ) : (
                              <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                                No questions found in this flow yet.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Advanced JSON editor</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            Use this only for advanced graph edits. The visual editor above is now the primary way to
                            edit the live resident questions.
                          </div>
                          <Textarea
                            value={questionsJson}
                            onChange={(event) => setQuestionsJson(event.target.value)}
                            className="min-h-[220px] font-mono text-xs"
                          />
                          <Button onClick={handleSaveFlowQuestions} disabled={saveFlowQuestionsMutation.isPending}>
                            Save questions
                          </Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Options JSON</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea
                            value={optionsJson}
                            onChange={(event) => setOptionsJson(event.target.value)}
                            className="min-h-[220px] font-mono text-xs"
                          />
                          <Button onClick={handleSaveFlowOptions} disabled={saveFlowOptionsMutation.isPending}>
                            Save options
                          </Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Rules JSON</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea
                            value={rulesJson}
                            onChange={(event) => setRulesJson(event.target.value)}
                            className="min-h-[220px] font-mono text-xs"
                          />
                          <Button onClick={handleSaveFlowRules} disabled={saveFlowRulesMutation.isPending}>
                            Save rules
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
