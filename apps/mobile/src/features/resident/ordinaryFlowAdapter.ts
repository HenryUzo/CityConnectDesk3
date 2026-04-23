import { DynamicFlowQuestion, DynamicFlowSession, RequestConfigQuestion } from "../../api/contracts";
import { summarizeQuestionAnswer } from "./requestPresentation";

export type OrdinaryFlowStage = "intake" | "wizard" | "summary" | "live";

export type OrdinaryFlowThreadItem = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  caption?: string;
  tone?: "default" | "success" | "danger";
};

export type OrdinaryFlowSummaryItem = {
  id: string;
  label: string;
  value: string;
  stage: "intake" | "wizard";
};

export type IntakeDraft = {
  description: string;
  location: string;
  urgency: string;
};

export type QuestionDraft = {
  text: string;
  multiSelectKeys: string[];
  location: {
    address: string;
    estateName: string;
    state: string;
    lga: string;
    unit: string;
  };
  schedule: {
    date: string;
    time: string;
    dateTime: string;
  };
  fileNote: string;
};

export const EMPTY_QUESTION_DRAFT: QuestionDraft = {
  text: "",
  multiSelectKeys: [],
  location: {
    address: "",
    estateName: "",
    state: "",
    lga: "",
    unit: "",
  },
  schedule: {
    date: "",
    time: "",
    dateTime: "",
  },
  fileNote: "",
};

export function normalizeSession(payload: DynamicFlowSession | { session: DynamicFlowSession }) {
  return "session" in payload ? payload.session : payload;
}

function inferLegacyInputType(question: RequestConfigQuestion): DynamicFlowQuestion["inputType"] {
  const prompt = String(question.question || "").toLowerCase();
  if (Array.isArray(question.options) && question.options.length) return "single_select";
  if (/location|address|estate|where/.test(prompt)) return "location";
  if (/urgency|priority|how soon/.test(prompt)) return "urgency";
  if (/date/.test(prompt) && /time/.test(prompt)) return "datetime";
  if (/date/.test(prompt)) return "date";
  if (/time/.test(prompt)) return "time";
  if (/upload|image|photo|picture|attachment|file/.test(prompt)) return "file";
  if (/yes or no|yes\/no/.test(prompt)) return "yes_no";
  if (/how many|quantity|count|number/.test(prompt)) return "number";
  return "text";
}

export function buildLegacyFallbackQuestions(questions: RequestConfigQuestion[]) {
  return questions.map<DynamicFlowQuestion>((question, index) => ({
    id: question.id || `legacy-${index}`,
    questionKey: `legacy_${index}`,
    prompt: question.question,
    description: question.mode ? `Legacy ${question.mode} flow question` : "Legacy configured flow question",
    inputType: inferLegacyInputType(question),
    isRequired: true,
    isTerminal: index === questions.length - 1,
    options: (question.options || []).map((option, optionIndex) => ({
      id: `${question.id || index}-${optionIndex}`,
      optionKey: String(option).toLowerCase().replace(/\s+/g, "_"),
      label: option,
      value: option,
    })),
  }));
}

export function buildOrdinaryFlowThreadItems(params: {
  categoryLabel: string;
  stage: OrdinaryFlowStage;
  intake: IntakeDraft;
  session?: DynamicFlowSession | null;
  fallbackQuestions?: DynamicFlowQuestion[];
  fallbackAnswers?: Record<string, unknown>;
  currentFallbackIndex?: number;
  requestId?: string;
  feedback?: string;
}) {
  const items: OrdinaryFlowThreadItem[] = [
    {
      id: "assistant-intro",
      role: "assistant",
      text: `You're starting a ${params.categoryLabel} request. We'll guide you through the same ordinary flow used on the web app.`,
    },
  ];

  if (params.intake.description.trim()) {
    items.push({
      id: "user-intake-description",
      role: "user",
      text: params.intake.description.trim(),
    });
  }

  if (params.intake.location.trim() || params.intake.urgency.trim()) {
    const details = [
      params.intake.location.trim() ? `Location: ${params.intake.location.trim()}` : null,
      params.intake.urgency.trim() ? `Urgency: ${params.intake.urgency.trim()}` : null,
    ].filter(Boolean).join("\n");
    if (details) {
      items.push({
        id: "system-intake-details",
        role: "system",
        text: details,
      });
    }
  }

  if (params.requestId && params.stage === "live") {
    items.push({
      id: "system-request-created",
      role: "system",
      text: "Request created. This thread now follows the live request lifecycle.",
      tone: "success",
    });
  }

  if (params.session?.history?.length) {
    params.session.history.forEach((question) => {
      items.push({
        id: `assistant-${question.id}`,
        role: "assistant",
        text: question.prompt,
        caption: question.description || undefined,
      });
      items.push({
        id: `user-${question.id}`,
        role: "user",
        text: summarizeQuestionAnswer(question, params.session?.answers),
      });
    });
  } else if (params.fallbackQuestions?.length) {
    params.fallbackQuestions.forEach((question, index) => {
      const answer = params.fallbackAnswers?.[question.questionKey];
      if (index < Number(params.currentFallbackIndex || 0)) {
        items.push({
          id: `assistant-fallback-${question.id}`,
          role: "assistant",
          text: question.prompt,
          caption: question.description || undefined,
        });
        items.push({
          id: `user-fallback-${question.id}`,
          role: "user",
          text: summarizeQuestionAnswer(question, params.fallbackAnswers),
        });
      }
    });
  }

  if (params.session?.currentQuestion && params.stage === "wizard") {
    items.push({
      id: `assistant-current-${params.session.currentQuestion.id}`,
      role: "assistant",
      text: params.session.currentQuestion.prompt,
      caption: params.session.currentQuestion.description || undefined,
    });
  } else if (params.fallbackQuestions?.length && params.stage === "wizard") {
    const currentFallbackQuestion = params.fallbackQuestions[Number(params.currentFallbackIndex || 0)] || null;
    if (currentFallbackQuestion) {
      items.push({
        id: `assistant-current-fallback-${currentFallbackQuestion.id}`,
        role: "assistant",
        text: currentFallbackQuestion.prompt,
        caption: currentFallbackQuestion.description || undefined,
      });
    }
  }

  if (params.feedback) {
    items.push({
      id: `system-feedback-${params.feedback}`,
      role: "system",
      text: params.feedback,
      tone: /failed|error|invalid/i.test(params.feedback) ? "danger" : "default",
    });
  }

  return items;
}

export function serializeDraftAnswer(question: DynamicFlowQuestion, draft: QuestionDraft) {
  if (question.inputType === "location" || question.inputType === "estate") {
    return {
      address: draft.location.address.trim(),
      estateName: draft.location.estateName.trim() || undefined,
      state: draft.location.state.trim() || undefined,
      lga: draft.location.lga.trim() || undefined,
      unit: draft.location.unit.trim() || undefined,
      text: [
        draft.location.address.trim(),
        draft.location.estateName.trim(),
        draft.location.state.trim(),
        draft.location.lga.trim(),
        draft.location.unit.trim() ? `Unit ${draft.location.unit.trim()}` : "",
      ].filter(Boolean).join(", "),
    };
  }

  if (question.inputType === "date") {
    return { text: draft.schedule.date.trim(), date: draft.schedule.date.trim() };
  }

  if (question.inputType === "time") {
    return { text: draft.schedule.time.trim(), time: draft.schedule.time.trim() };
  }

  if (question.inputType === "datetime") {
    return {
      text: draft.schedule.dateTime.trim(),
      datetime: draft.schedule.dateTime.trim(),
    };
  }

  if (question.inputType === "file") {
    return {
      files: [],
      text: draft.fileNote.trim() || "Skipped file upload on mobile",
    };
  }

  if (question.inputType === "multi_select") {
    return question.options
      .filter((option) => draft.multiSelectKeys.includes(option.optionKey))
      .map((option) => ({ optionKey: option.optionKey, value: option.value, text: option.label }));
  }

  if (question.inputType === "number") {
    return { text: draft.text.trim(), value: Number(draft.text.trim()) };
  }

  return { text: draft.text.trim() };
}

export function buildSummaryItems(params: {
  intake: IntakeDraft;
  session?: DynamicFlowSession | null;
  fallbackQuestions?: DynamicFlowQuestion[];
  fallbackAnswers?: Record<string, unknown>;
}) {
  const items: OrdinaryFlowSummaryItem[] = [
    {
      id: "summary-description",
      label: "Issue summary",
      value: params.intake.description.trim() || "Not provided",
      stage: "intake",
    },
    {
      id: "summary-location",
      label: "Location",
      value: params.intake.location.trim() || "Not provided",
      stage: "intake",
    },
    {
      id: "summary-urgency",
      label: "Urgency",
      value: params.intake.urgency.trim() || "Not provided",
      stage: "intake",
    },
  ];

  if (params.session?.history?.length) {
    params.session.history.forEach((question) => {
      items.push({
        id: `summary-${question.id}`,
        label: question.prompt,
        value: summarizeQuestionAnswer(question, params.session?.answers),
        stage: "wizard",
      });
    });
  } else if (params.fallbackQuestions?.length) {
    params.fallbackQuestions.forEach((question) => {
      const answer = summarizeQuestionAnswer(question, params.fallbackAnswers);
      if (!answer || answer === "No answer recorded") return;
      items.push({
        id: `summary-fallback-${question.id}`,
        label: question.prompt,
        value: answer,
        stage: "wizard",
      });
    });
  }

  return items;
}

export function buildRequestDescription(params: {
  categoryLabel: string;
  intake: IntakeDraft;
  session?: DynamicFlowSession | null;
  fallbackQuestions?: DynamicFlowQuestion[];
  fallbackAnswers?: Record<string, unknown>;
}) {
  const parts = [
    params.intake.description.trim() ? `Issue: ${params.intake.description.trim()}` : null,
    params.intake.location.trim() ? `Location: ${params.intake.location.trim()}` : null,
    params.intake.urgency.trim() ? `Urgency: ${params.intake.urgency.trim()}` : null,
  ];

  if (params.session?.history?.length) {
    params.session.history.forEach((question) => {
      parts.push(`${question.prompt}: ${summarizeQuestionAnswer(question, params.session?.answers)}`);
    });
  } else if (params.fallbackQuestions?.length) {
    params.fallbackQuestions.forEach((question) => {
      const answer = summarizeQuestionAnswer(question, params.fallbackAnswers);
      if (!answer || answer === "No answer recorded") return;
      parts.push(`${question.prompt}: ${answer}`);
    });
  }

  return parts.filter(Boolean).join("\n");
}

export function buildPreferredTime(params: {
  session?: DynamicFlowSession | null;
  fallbackQuestions?: DynamicFlowQuestion[];
  fallbackAnswers?: Record<string, unknown>;
}) {
  const answers = params.session?.answers || params.fallbackAnswers || {};
  const candidateKeys = ["time", "preferred_time", "datetime", "preferred_datetime", "date"];

  for (const key of candidateKeys) {
    const raw = answers[key];
    if (!raw) continue;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      const value = String(record.datetime || record.time || record.date || record.text || "").trim();
      if (value) return value;
    }
  }

  return undefined;
}
