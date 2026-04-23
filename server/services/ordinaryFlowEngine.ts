import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ordinaryFlowAnswers,
  ordinaryFlowDefinitions,
  ordinaryFlowOptions,
  ordinaryFlowQuestions,
  ordinaryFlowRules,
  ordinaryFlowSessions,
} from "@shared/schema";
import { db } from "../db";

export type FlowValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  startQuestionId: string | null;
};

type FlowBundle = {
  definition: any;
  questions: any[];
  questionsById: Map<string, any>;
  questionByKey: Map<string, any>;
  optionsByQuestionId: Map<string, any[]>;
  rulesByFromQuestionId: Map<string, any[]>;
  startQuestionId: string | null;
};

type FlowPathState = {
  pathQuestionIds: string[];
  currentQuestionId: string | null;
  isComplete: boolean;
};

function normalizeCategoryKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}

function answerHasValue(answer: any): boolean {
  if (answer === undefined || answer === null) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (typeof answer === "number") return Number.isFinite(answer);
  if (typeof answer === "boolean") return true;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") {
    const entries = Object.entries(answer);
    if (!entries.length) return false;
    return entries.some(([, value]) => {
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return value !== null && value !== undefined;
    });
  }
  return false;
}

function getSelectedOptionKeys(answer: any): string[] {
  if (!answer || typeof answer !== "object") return [];
  const single = String((answer as any).optionKey || "").trim();
  if (single) return [single];
  const many = Array.isArray((answer as any).optionKeys)
    ? ((answer as any).optionKeys as any[])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  return many;
}

function isObjectRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertAnswerPayload(question: any, answer: any, options: any[]) {
  const inputType = String(question?.inputType || "text").toLowerCase();
  const isRequired = Boolean(question?.isRequired);
  const answerPresent = answerHasValue(answer);
  if (!answerPresent) {
    if (isRequired) {
      const err = new Error(`Answer is required for question "${String(question?.questionKey || "")}".`);
      (err as any).status = 400;
      throw err;
    }
    return;
  }

  if (inputType === "single_select" || inputType === "yes_no") {
    if (!isObjectRecord(answer) || !String(answer.optionKey || "").trim()) {
      const err = new Error("Single-select answer must be { optionKey }.");
      (err as any).status = 400;
      throw err;
    }
    const optionKey = String(answer.optionKey).trim();
    const validOptionKeys = new Set((options || []).map((row) => String(row.optionKey || "")));
    if (validOptionKeys.size && !validOptionKeys.has(optionKey)) {
      const err = new Error(`Invalid optionKey "${optionKey}" for question "${String(question?.questionKey || "")}".`);
      (err as any).status = 400;
      throw err;
    }
    return;
  }

  if (inputType === "urgency") {
    if (!isObjectRecord(answer) || !String(answer.value || "").trim()) {
      const err = new Error("Urgency answer must be { value }.");
      (err as any).status = 400;
      throw err;
    }
    const value = String(answer.value || "").trim().toLowerCase();
    if (!["emergency", "high", "medium", "low"].includes(value)) {
      const err = new Error(`Invalid urgency value "${value}".`);
      (err as any).status = 400;
      throw err;
    }
    return;
  }

  if (inputType === "multi_select") {
    if (
      !isObjectRecord(answer) ||
      !Array.isArray(answer.optionKeys) ||
      !answer.optionKeys.length
    ) {
      const err = new Error("Multi-select answer must be { optionKeys: string[] }.");
      (err as any).status = 400;
      throw err;
    }
    const validOptionKeys = new Set((options || []).map((row) => String(row.optionKey || "")));
    for (const item of answer.optionKeys) {
      const optionKey = String(item || "").trim();
      if (!optionKey) continue;
      if (validOptionKeys.size && !validOptionKeys.has(optionKey)) {
        const err = new Error(`Invalid optionKey "${optionKey}" for multi-select question.`);
        (err as any).status = 400;
        throw err;
      }
    }
    return;
  }

  if (inputType === "text") {
    if (typeof answer === "string") return;
    if (isObjectRecord(answer) && String(answer.text || "").trim()) return;
    const err = new Error("Text answer must be a string or { text }.");
    (err as any).status = 400;
    throw err;
  }

  if (inputType === "number") {
    if (typeof answer === "number" && Number.isFinite(answer)) return;
    if (isObjectRecord(answer) && Number.isFinite(Number(answer.value))) return;
    const err = new Error("Number answer must be a finite number or { value }.");
    (err as any).status = 400;
    throw err;
  }

  if (inputType === "location") {
    if (!isObjectRecord(answer)) {
      const err = new Error("Location answer must be an object.");
      (err as any).status = 400;
      throw err;
    }
    const estateMode = String(answer.estateMode || "").trim().toLowerCase();
    if (!["estate", "outside"].includes(estateMode)) {
      const err = new Error("Location answer requires estateMode: 'estate' | 'outside'.");
      (err as any).status = 400;
      throw err;
    }
    const address = String(answer.address || "").trim();
    if (!address) {
      const err = new Error("Location answer requires address.");
      (err as any).status = 400;
      throw err;
    }
    if (estateMode === "estate" && !String(answer.estateName || "").trim() && !String(answer.estateId || "").trim()) {
      const err = new Error("Estate mode location requires estateName or estateId.");
      (err as any).status = 400;
      throw err;
    }
    if (estateMode === "outside" && !String(answer.state || "").trim()) {
      const err = new Error("Outside mode location requires state.");
      (err as any).status = 400;
      throw err;
    }
    return;
  }

  if (inputType === "file") {
    if (!isObjectRecord(answer) || !Array.isArray(answer.files)) {
      const err = new Error("File answer must be { files: [] }.");
      (err as any).status = 400;
      throw err;
    }
    for (const file of answer.files) {
      if (!isObjectRecord(file)) continue;
      const dataUrl = String(file.dataUrl || "").trim();
      if (!dataUrl.startsWith("data:")) {
        const err = new Error("File entries must include a valid dataUrl.");
        (err as any).status = 400;
        throw err;
      }
    }
    return;
  }

  if (inputType === "date" || inputType === "time" || inputType === "datetime" || inputType === "estate") {
    if (typeof answer === "string") return;
    if (isObjectRecord(answer) && (String(answer.value || "").trim() || String(answer.text || "").trim())) return;
    const err = new Error(`Answer format is invalid for input type "${inputType}".`);
    (err as any).status = 400;
    throw err;
  }
}

function evaluateCondition(condition: any, answerMap: Record<string, any>): boolean {
  if (!condition || typeof condition !== "object" || !Object.keys(condition).length) {
    return true;
  }

  if (Array.isArray(condition.all)) {
    return condition.all.every((entry: any) => evaluateCondition(entry, answerMap));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry: any) => evaluateCondition(entry, answerMap));
  }
  if (condition.not) {
    return !evaluateCondition(condition.not, answerMap);
  }

  if (condition.equals && typeof condition.equals === "object") {
    const questionKey = String(condition.equals.questionKey || "").trim();
    if (!questionKey) return false;
    const currentValue = answerMap[questionKey];
    return stableStringify(currentValue) === stableStringify(condition.equals.value);
  }

  if (condition.optionKeyEquals && typeof condition.optionKeyEquals === "object") {
    const questionKey = String(condition.optionKeyEquals.questionKey || "").trim();
    const optionKey = String(condition.optionKeyEquals.optionKey || "").trim();
    if (!questionKey || !optionKey) return false;
    const selectedKeys = getSelectedOptionKeys(answerMap[questionKey]);
    return selectedKeys.includes(optionKey);
  }

  return false;
}

function conditionMatchesOptionKeyForQuestion(
  condition: any,
  questionKey: string,
  optionKey: string,
): boolean {
  if (!condition || typeof condition !== "object") return false;

  if (Array.isArray(condition.all)) {
    return condition.all.some((entry: any) =>
      conditionMatchesOptionKeyForQuestion(entry, questionKey, optionKey),
    );
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry: any) =>
      conditionMatchesOptionKeyForQuestion(entry, questionKey, optionKey),
    );
  }
  if (condition.not) {
    return conditionMatchesOptionKeyForQuestion(condition.not, questionKey, optionKey);
  }

  if (condition.optionKeyEquals && typeof condition.optionKeyEquals === "object") {
    const condQuestionKey = String(condition.optionKeyEquals.questionKey || "").trim();
    const condOptionKey = String(condition.optionKeyEquals.optionKey || "").trim();
    return condQuestionKey === questionKey && condOptionKey === optionKey;
  }

  return false;
}

function buildStartQuestionId(
  questions: any[],
  optionsByQuestionId: Map<string, any[]>,
  rulesByFromQuestionId: Map<string, any[]>,
): string | null {
  if (!questions.length) return null;
  const inbound = new Set<string>();
  for (const question of questions) {
    if (question.defaultNextQuestionId) inbound.add(String(question.defaultNextQuestionId));
    const opts = optionsByQuestionId.get(String(question.id)) || [];
    for (const option of opts) {
      if (option.nextQuestionId) inbound.add(String(option.nextQuestionId));
    }
    const rules = rulesByFromQuestionId.get(String(question.id)) || [];
    for (const rule of rules) {
      if (rule.nextQuestionId) inbound.add(String(rule.nextQuestionId));
    }
  }
  const starts = questions.filter((question) => !inbound.has(String(question.id)));
  const orderedStarts = starts.sort(
    (a, b) =>
      Number(a.orderIndex || 0) - Number(b.orderIndex || 0) ||
      String(a.questionKey || "").localeCompare(String(b.questionKey || "")),
  );
  return String((orderedStarts[0] || questions[0]).id);
}

function resolveNextQuestionId(
  bundle: FlowBundle,
  question: any,
  answer: any,
  answerMap: Record<string, any>,
): string | null {
  const questionId = String(question.id || "");
  const optionRows = bundle.optionsByQuestionId.get(questionId) || [];
  const selectedOptionKeys = getSelectedOptionKeys(answer);
  if (selectedOptionKeys.length) {
    for (const optionKey of selectedOptionKeys) {
      const matched = optionRows.find((row) => String(row.optionKey) === optionKey);
      if (matched?.nextQuestionId) {
        return String(matched.nextQuestionId);
      }
    }
  }

  const rules = (bundle.rulesByFromQuestionId.get(questionId) || []).filter((row) => row.isActive !== false);
  for (const rule of rules) {
    if (!evaluateCondition(rule.conditionJson, answerMap)) continue;
    const action = String(rule.action || "").toLowerCase();
    if (action === "terminate") return null;
    if ((action === "goto_question" || action === "set_value" || action === "skip") && rule.nextQuestionId) {
      return String(rule.nextQuestionId);
    }
  }

  if (question.defaultNextQuestionId) {
    return String(question.defaultNextQuestionId);
  }

  return null;
}

function computeFlowPath(bundle: FlowBundle, answerMap: Record<string, any>): FlowPathState {
  const pathQuestionIds: string[] = [];
  const visited = new Set<string>();
  let currentQuestionId: string | null = bundle.startQuestionId;

  while (currentQuestionId) {
    const question = bundle.questionsById.get(currentQuestionId);
    if (!question || visited.has(currentQuestionId)) break;

    visited.add(currentQuestionId);
    pathQuestionIds.push(currentQuestionId);
    const answer = answerMap[String(question.questionKey || "")];
    if (!answerHasValue(answer)) {
      if (question.isRequired) {
        return { pathQuestionIds, currentQuestionId, isComplete: false };
      }
      const nextQuestionId = resolveNextQuestionId(bundle, question, answer, answerMap);
      if (!nextQuestionId) {
        return { pathQuestionIds, currentQuestionId: null, isComplete: true };
      }
      currentQuestionId = nextQuestionId;
      continue;
    }

    const nextQuestionId = resolveNextQuestionId(bundle, question, answer, answerMap);
    if (!nextQuestionId) {
      return { pathQuestionIds, currentQuestionId: null, isComplete: true };
    }
    currentQuestionId = nextQuestionId;
  }

  return { pathQuestionIds, currentQuestionId: null, isComplete: true };
}

function buildProgress(bundle: FlowBundle, pathQuestionIds: string[], answerMap: Record<string, any>) {
  let totalRequired = 0;
  let answeredRequired = 0;
  for (const questionId of pathQuestionIds) {
    const question = bundle.questionsById.get(questionId);
    if (!question) continue;
    if (!question.isRequired) continue;
    totalRequired += 1;
    if (answerHasValue(answerMap[String(question.questionKey || "")])) {
      answeredRequired += 1;
    }
  }
  const percent = totalRequired ? Math.round((answeredRequired / totalRequired) * 100) : 100;
  return { totalRequired, answeredRequired, percent };
}

async function loadPublishedFlowDefinition(categoryKey: string, estateId?: string | null) {
  const normalized = normalizeCategoryKey(categoryKey);
  const rows = await db
    .select()
    .from(ordinaryFlowDefinitions)
    .where(
      and(
        eq(ordinaryFlowDefinitions.categoryKey, normalized),
        eq(ordinaryFlowDefinitions.status, "published"),
      ),
    )
    .orderBy(
      asc(ordinaryFlowDefinitions.scope),
      desc(ordinaryFlowDefinitions.isDefault),
      desc(ordinaryFlowDefinitions.version),
      desc(ordinaryFlowDefinitions.publishedAt),
    );

  if (!rows.length) return null;
  if (!estateId) {
    return rows.find((row: any) => String(row.scope) === "global") || rows[0];
  }

  const estateSpecific = rows.find(
    (row: any) => String(row.scope) === "estate" && String(row.estateId || "") === String(estateId),
  );
  return estateSpecific || rows.find((row: any) => String(row.scope) === "global") || rows[0];
}

async function loadFlowBundle(flowId: string): Promise<FlowBundle | null> {
  const [definition] = await db
    .select()
    .from(ordinaryFlowDefinitions)
    .where(eq(ordinaryFlowDefinitions.id, flowId))
    .limit(1);
  if (!definition) return null;

  const questions = await db
    .select()
    .from(ordinaryFlowQuestions)
    .where(eq(ordinaryFlowQuestions.flowId, flowId))
    .orderBy(asc(ordinaryFlowQuestions.orderIndex), asc(ordinaryFlowQuestions.questionKey));
  if (!questions.length) {
    return {
      definition,
      questions: [],
      questionsById: new Map(),
      questionByKey: new Map(),
      optionsByQuestionId: new Map(),
      rulesByFromQuestionId: new Map(),
      startQuestionId: null,
    };
  }

  const questionIds = questions.map((q: any) => String(q.id));
  const options = questionIds.length
    ? await db
        .select()
        .from(ordinaryFlowOptions)
        .where(inArray(ordinaryFlowOptions.questionId, questionIds as any))
        .orderBy(asc(ordinaryFlowOptions.orderIndex), asc(ordinaryFlowOptions.optionKey))
    : [];
  const rules = await db
    .select()
    .from(ordinaryFlowRules)
    .where(eq(ordinaryFlowRules.flowId, flowId))
    .orderBy(asc(ordinaryFlowRules.priority), asc(ordinaryFlowRules.createdAt));

  const questionsById = new Map<string, any>();
  const questionByKey = new Map<string, any>();
  const optionsByQuestionId = new Map<string, any[]>();
  const rulesByFromQuestionId = new Map<string, any[]>();

  for (const question of questions) {
    const id = String(question.id);
    questionsById.set(id, question);
    questionByKey.set(String(question.questionKey), question);
    optionsByQuestionId.set(id, []);
    rulesByFromQuestionId.set(id, []);
  }

  for (const option of options) {
    const questionId = String(option.questionId);
    const bucket = optionsByQuestionId.get(questionId) || [];
    bucket.push(option);
    optionsByQuestionId.set(questionId, bucket);
  }
  for (const rule of rules) {
    const questionId = String(rule.fromQuestionId);
    const bucket = rulesByFromQuestionId.get(questionId) || [];
    bucket.push(rule);
    rulesByFromQuestionId.set(questionId, bucket);
  }

  const startQuestionId = buildStartQuestionId(questions, optionsByQuestionId, rulesByFromQuestionId);
  return {
    definition,
    questions,
    questionsById,
    questionByKey,
    optionsByQuestionId,
    rulesByFromQuestionId,
    startQuestionId,
  };
}

async function loadAnswerMapForSession(sessionId: string): Promise<Record<string, any>> {
  const rows = await db
    .select()
    .from(ordinaryFlowAnswers)
    .where(eq(ordinaryFlowAnswers.sessionId, sessionId));
  const answerMap: Record<string, any> = {};
  for (const row of rows) {
    answerMap[String(row.questionKey || "")] = row.answerJson ?? null;
  }
  return answerMap;
}

function buildQuestionPayload(bundle: FlowBundle, question: any, answerMap: Record<string, any>) {
  const options = (bundle.optionsByQuestionId.get(String(question.id)) || []).map((option: any) => ({
    id: option.id,
    optionKey: option.optionKey,
    label: option.label,
    value: option.value,
    icon: option.icon,
    orderIndex: option.orderIndex,
    meta: option.meta ?? {},
  }));
  return {
    id: question.id,
    questionKey: question.questionKey,
    prompt: question.prompt,
    description: question.description,
    inputType: question.inputType,
    isRequired: question.isRequired,
    isTerminal: question.isTerminal,
    orderIndex: question.orderIndex,
    validation: question.validation ?? {},
    uiMeta: question.uiMeta ?? {},
    defaultNextQuestionId: question.defaultNextQuestionId ?? null,
    answer: answerMap[String(question.questionKey || "")] ?? null,
    options,
  };
}

async function hydrateSession(session: any, bundle?: FlowBundle | null) {
  const flowBundle = bundle || (await loadFlowBundle(String(session.flowId)));
  if (!flowBundle) throw new Error("Flow not found for session");
  const answerMap = await loadAnswerMapForSession(String(session.id));
  const pathState = computeFlowPath(flowBundle, answerMap);
  const pathSet = new Set(pathState.pathQuestionIds);
  const prunedAnswerMap: Record<string, any> = {};
  for (const questionId of pathState.pathQuestionIds) {
    const question = flowBundle.questionsById.get(questionId);
    if (!question) continue;
    const key = String(question.questionKey || "");
    if (answerHasValue(answerMap[key])) {
      prunedAnswerMap[key] = answerMap[key];
    }
  }

  const history = pathState.pathQuestionIds
    .map((questionId) => flowBundle.questionsById.get(questionId))
    .filter(Boolean)
    .filter((question) => answerHasValue(prunedAnswerMap[String(question.questionKey || "")]))
    .map((question) => ({
      ...buildQuestionPayload(flowBundle, question, prunedAnswerMap),
      answer: prunedAnswerMap[String(question.questionKey || "")],
    }));

  const currentQuestion = pathState.currentQuestionId
    ? flowBundle.questionsById.get(pathState.currentQuestionId)
    : null;
  const currentQuestionPayload = currentQuestion
    ? buildQuestionPayload(flowBundle, currentQuestion, prunedAnswerMap)
    : null;

  const progress = buildProgress(flowBundle, pathState.pathQuestionIds, prunedAnswerMap);

  return {
    sessionId: session.id,
    requestId: session.requestId,
    residentId: session.residentId,
    categoryKey: session.categoryKey,
    flowId: session.flowId,
    flowVersion: session.flowVersion,
    status: session.status,
    stateRevision: Number(session.stateRevision || 0),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    currentQuestion: currentQuestionPayload,
    history,
    activePath: pathState.pathQuestionIds.map((questionId) => {
      const question = flowBundle.questionsById.get(questionId);
      return question ? buildQuestionPayload(flowBundle, question, prunedAnswerMap) : null;
    }).filter(Boolean),
    answers: prunedAnswerMap,
    progress,
    isComplete: pathState.isComplete,
  };
}

export async function startOrGetOrdinaryFlowSession(input: {
  requestId: string;
  residentId: string;
  categoryKey: string;
  estateId?: string | null;
}) {
  const normalizedCategoryKey = normalizeCategoryKey(input.categoryKey);
  const flowDefinition = await loadPublishedFlowDefinition(normalizedCategoryKey, input.estateId);
  if (!flowDefinition) {
    return {
      fallback: true,
      reason: "no_published_flow",
      categoryKey: normalizedCategoryKey,
    };
  }

  const existingRows = await db
    .select()
    .from(ordinaryFlowSessions)
    .where(eq(ordinaryFlowSessions.requestId, input.requestId))
    .limit(1);
  if (existingRows.length) {
    const existing = existingRows[0];
    if (String(existing.residentId) !== String(input.residentId)) {
      const err = new Error("Session belongs to another user.");
      (err as any).status = 403;
      throw err;
    }
    const hydrated = await hydrateSession(existing);
    return { fallback: false, session: hydrated };
  }

  const bundle = await loadFlowBundle(String(flowDefinition.id));
  if (!bundle) {
    return {
      fallback: true,
      reason: "flow_missing",
      categoryKey: normalizedCategoryKey,
    };
  }

  const pathState = computeFlowPath(bundle, {});
  const [created] = await db
    .insert(ordinaryFlowSessions)
    .values({
      requestId: input.requestId,
      residentId: input.residentId,
      categoryKey: normalizedCategoryKey,
      flowId: flowDefinition.id,
      flowVersion: Number(flowDefinition.version || 1),
      status: "active",
      currentQuestionId: pathState.currentQuestionId,
      answersSnapshot: {},
      activePath: pathState.pathQuestionIds,
      stateRevision: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const hydrated = await hydrateSession(created, bundle);
  return { fallback: false, session: hydrated };
}

export async function getOrdinaryFlowSessionById(sessionId: string, residentId: string) {
  const [session] = await db
    .select()
    .from(ordinaryFlowSessions)
    .where(eq(ordinaryFlowSessions.id, sessionId))
    .limit(1);
  if (!session) return null;
  if (String(session.residentId) !== String(residentId)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
  return hydrateSession(session);
}

export async function writeOrdinaryFlowAnswer(input: {
  sessionId: string;
  residentId: string;
  questionKey: string;
  answer: any;
  expectedRevision: number;
  answeredBy?: "resident" | "admin" | "system";
}) {
  const [session] = await db
    .select()
    .from(ordinaryFlowSessions)
    .where(eq(ordinaryFlowSessions.id, input.sessionId))
    .limit(1);
  if (!session) {
    const err = new Error("Session not found.");
    (err as any).status = 404;
    throw err;
  }
  if (String(session.residentId) !== String(input.residentId)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  const currentRevision = Number(session.stateRevision || 0);
  if (Number(input.expectedRevision) !== currentRevision) {
    const hydrated = await hydrateSession(session);
    return {
      stale: true as const,
      stateRevision: hydrated.stateRevision,
      currentQuestion: hydrated.currentQuestion,
      session: hydrated,
    };
  }

  const bundle = await loadFlowBundle(String(session.flowId));
  if (!bundle) {
    const err = new Error("Flow not found.");
    (err as any).status = 404;
    throw err;
  }
  const question = bundle.questionByKey.get(String(input.questionKey || ""));
  if (!question) {
    const err = new Error("Question not found in this flow.");
    (err as any).status = 400;
    throw err;
  }
  const optionRows = bundle.optionsByQuestionId.get(String(question.id)) || [];
  assertAnswerPayload(question, input.answer, optionRows);

  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      INSERT INTO ordinary_flow_answers (
        session_id,
        question_id,
        question_key,
        answer_json,
        answered_by,
        revision,
        answered_at
      )
      VALUES (
        ${input.sessionId},
        ${question.id},
        ${String(question.questionKey)},
        ${JSON.stringify(input.answer ?? {})}::jsonb,
        ${String(input.answeredBy || "resident")},
        1,
        now()
      )
      ON CONFLICT (session_id, question_id)
      DO UPDATE SET
        answer_json = EXCLUDED.answer_json,
        answered_by = EXCLUDED.answered_by,
        revision = ordinary_flow_answers.revision + 1,
        answered_at = now();
    `);

    const answerRows = await tx
      .select()
      .from(ordinaryFlowAnswers)
      .where(eq(ordinaryFlowAnswers.sessionId, input.sessionId));

    const answerMap: Record<string, any> = {};
    for (const row of answerRows) {
      answerMap[String(row.questionKey || "")] = row.answerJson ?? null;
    }

    const pathState = computeFlowPath(bundle, answerMap);
    const questionIdsToKeep = [...pathState.pathQuestionIds];

    if (questionIdsToKeep.length) {
      await tx.execute(sql`
        DELETE FROM ordinary_flow_answers
        WHERE session_id = ${input.sessionId}
          AND question_id NOT IN (
            ${sql.join(
              questionIdsToKeep.map((questionId) => sql`${questionId}`),
              sql`, `,
            )}
          );
      `);
    } else {
      await tx.delete(ordinaryFlowAnswers).where(eq(ordinaryFlowAnswers.sessionId, input.sessionId));
    }

    const filteredAnswerSnapshot: Record<string, any> = {};
    for (const questionId of questionIdsToKeep) {
      const q = bundle.questionsById.get(questionId);
      if (!q) continue;
      const key = String(q.questionKey || "");
      if (answerHasValue(answerMap[key])) {
        filteredAnswerSnapshot[key] = answerMap[key];
      }
    }

    const nextRevision = currentRevision + 1;
    await tx
      .update(ordinaryFlowSessions)
      .set({
        currentQuestionId: pathState.currentQuestionId,
        answersSnapshot: filteredAnswerSnapshot,
        activePath: questionIdsToKeep,
        stateRevision: nextRevision,
        status: pathState.isComplete ? "completed" : "active",
        completedAt: pathState.isComplete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(ordinaryFlowSessions.id, input.sessionId));
  });

  const [updatedSession] = await db
    .select()
    .from(ordinaryFlowSessions)
    .where(eq(ordinaryFlowSessions.id, input.sessionId))
    .limit(1);
  const hydrated = await hydrateSession(updatedSession, bundle);
  return { stale: false as const, session: hydrated };
}

export async function completeOrdinaryFlowSession(input: {
  sessionId: string;
  residentId: string;
}) {
  const [session] = await db
    .select()
    .from(ordinaryFlowSessions)
    .where(eq(ordinaryFlowSessions.id, input.sessionId))
    .limit(1);
  if (!session) {
    const err = new Error("Session not found.");
    (err as any).status = 404;
    throw err;
  }
  if (String(session.residentId) !== String(input.residentId)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  const hydrated = await hydrateSession(session);
  if (!hydrated.isComplete) {
    return {
      ok: false,
      error: "Flow is not complete.",
      stateRevision: hydrated.stateRevision,
      currentQuestion: hydrated.currentQuestion,
      progress: hydrated.progress,
    };
  }

  await db
    .update(ordinaryFlowSessions)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ordinaryFlowSessions.id, input.sessionId));

  const summary = {
    categoryKey: hydrated.categoryKey,
    flowId: hydrated.flowId,
    flowVersion: hydrated.flowVersion,
    answers: hydrated.answers,
    issueType: hydrated.answers.issue_type || null,
    urgency: hydrated.answers.urgency || null,
    quantity: hydrated.answers.quantity || null,
    timeWindow: hydrated.answers.time_window || null,
    location: hydrated.answers.location || null,
    notes: hydrated.answers.notes || null,
    attachments: hydrated.answers.photos || null,
  };

  return {
    ok: true,
    session: hydrated,
    normalizedIntake: summary,
  };
}

export async function validateOrdinaryFlow(flowId: string): Promise<FlowValidationResult> {
  const bundle = await loadFlowBundle(flowId);
  if (!bundle) {
    return {
      ok: false,
      errors: ["Flow not found."],
      warnings: [],
      startQuestionId: null,
    };
  }
  if (!bundle.questions.length) {
    return {
      ok: false,
      errors: ["Flow has no questions."],
      warnings: [],
      startQuestionId: null,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const questionIds = new Set(bundle.questions.map((question) => String(question.id)));

  const inboundCounts = new Map<string, number>();
  for (const question of bundle.questions) {
    inboundCounts.set(String(question.id), 0);
  }

  for (const question of bundle.questions) {
    if (question.defaultNextQuestionId) {
      const nextId = String(question.defaultNextQuestionId);
      if (!questionIds.has(nextId)) {
        errors.push(`Question "${question.questionKey}" has invalid default_next_question_id.`);
      } else {
        inboundCounts.set(nextId, Number(inboundCounts.get(nextId) || 0) + 1);
      }
    }
    const options = bundle.optionsByQuestionId.get(String(question.id)) || [];
    const optionKeys = new Set<string>();
    for (const option of options) {
      const optionKey = String(option.optionKey || "");
      if (optionKeys.has(optionKey)) {
        errors.push(`Question "${question.questionKey}" has duplicate option key "${optionKey}".`);
      }
      optionKeys.add(optionKey);
      if (option.nextQuestionId) {
        const nextId = String(option.nextQuestionId);
        if (!questionIds.has(nextId)) {
          errors.push(`Option "${option.optionKey}" has invalid next_question_id.`);
        } else {
          inboundCounts.set(nextId, Number(inboundCounts.get(nextId) || 0) + 1);
        }
      }
    }
    const rules = bundle.rulesByFromQuestionId.get(String(question.id)) || [];
    for (const rule of rules) {
      if (rule.nextQuestionId) {
        const nextId = String(rule.nextQuestionId);
        if (!questionIds.has(nextId)) {
          errors.push(`Rule "${rule.id}" has invalid next_question_id.`);
        } else {
          inboundCounts.set(nextId, Number(inboundCounts.get(nextId) || 0) + 1);
        }
      }
    }

    const inputType = String(question.inputType || "").toLowerCase();
    const selectableInput =
      inputType === "single_select" ||
      inputType === "multi_select" ||
      inputType === "yes_no" ||
      inputType === "urgency";
    if (selectableInput && options.length) {
      const activeRules = rules.filter((rule) => rule.isActive !== false);
      const hasAlwaysRule = activeRules.some((rule) => {
        const condition = rule.conditionJson;
        return !condition || (typeof condition === "object" && !Object.keys(condition).length);
      });

      for (const option of options) {
        if (option.nextQuestionId) continue;
        if (question.defaultNextQuestionId) continue;
        if (hasAlwaysRule) continue;

        const optionKey = String(option.optionKey || "");
        const hasOptionSpecificRule = activeRules.some((rule) =>
          conditionMatchesOptionKeyForQuestion(
            rule.conditionJson,
            String(question.questionKey || ""),
            optionKey,
          ),
        );
        if (!hasOptionSpecificRule) {
          errors.push(
            `Question "${question.questionKey}" option "${optionKey}" has no branch (next/default/rule).`,
          );
        }
      }
    }
  }

  const starts = bundle.questions.filter((question) => Number(inboundCounts.get(String(question.id)) || 0) === 0);
  if (starts.length !== 1) {
    errors.push(`Flow must have exactly one start node; found ${starts.length}.`);
  }
  const startQuestionId = starts.length ? String(starts[0].id) : bundle.startQuestionId;

  const adjacency = new Map<string, string[]>();
  for (const question of bundle.questions) {
    const edges: string[] = [];
    if (question.defaultNextQuestionId) edges.push(String(question.defaultNextQuestionId));
    const options = bundle.optionsByQuestionId.get(String(question.id)) || [];
    for (const option of options) {
      if (option.nextQuestionId) edges.push(String(option.nextQuestionId));
    }
    const rules = bundle.rulesByFromQuestionId.get(String(question.id)) || [];
    for (const rule of rules) {
      if (String(rule.action) === "terminate") continue;
      if (rule.nextQuestionId) edges.push(String(rule.nextQuestionId));
    }
    adjacency.set(String(question.id), edges.filter((id) => questionIds.has(id)));
  }

  const reachable = new Set<string>();
  if (startQuestionId) {
    const queue = [startQuestionId];
    while (queue.length) {
      const current = String(queue.shift() || "");
      if (!current || reachable.has(current)) continue;
      reachable.add(current);
      for (const next of adjacency.get(current) || []) {
        if (!reachable.has(next)) queue.push(next);
      }
    }
  }

  for (const question of bundle.questions) {
    const id = String(question.id);
    if (question.isRequired && !reachable.has(id)) {
      errors.push(`Required question "${question.questionKey}" is unreachable from start.`);
    }
    const outgoing = adjacency.get(id) || [];
    const hasTerminateRule = (bundle.rulesByFromQuestionId.get(id) || []).some(
      (rule) => String(rule.action) === "terminate",
    );
    if (!question.isTerminal && !outgoing.length && !hasTerminateRule) {
      errors.push(`Question "${question.questionKey}" has no outgoing branch and is not terminal.`);
    }
    if (question.isTerminal && outgoing.length) {
      warnings.push(`Terminal question "${question.questionKey}" has outgoing branches configured.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    startQuestionId: startQuestionId || null,
  };
}

export async function publishOrdinaryFlow(flowId: string, actorUserId?: string | null) {
  const [target] = await db
    .select()
    .from(ordinaryFlowDefinitions)
    .where(eq(ordinaryFlowDefinitions.id, flowId))
    .limit(1);
  if (!target) {
    const err = new Error("Flow not found.");
    (err as any).status = 404;
    throw err;
  }

  const validation = await validateOrdinaryFlow(flowId);
  if (!validation.ok) {
    const err = new Error("Flow validation failed.");
    (err as any).status = 422;
    (err as any).details = validation;
    throw err;
  }

  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      UPDATE ordinary_flow_definitions
      SET status = 'archived', updated_at = now()
      WHERE category_key = ${target.categoryKey}
        AND scope = ${target.scope}
        AND COALESCE(estate_id, '') = COALESCE(${target.estateId}, '')
        AND status = 'published'
        AND id <> ${flowId}
    `);

    await tx
      .update(ordinaryFlowDefinitions)
      .set({
        status: "published",
        publishedAt: new Date(),
        publishedBy: actorUserId || target.publishedBy || null,
        updatedAt: new Date(),
      })
      .where(eq(ordinaryFlowDefinitions.id, flowId));
  });

  const [published] = await db
    .select()
    .from(ordinaryFlowDefinitions)
    .where(eq(ordinaryFlowDefinitions.id, flowId))
    .limit(1);
  return {
    flow: published,
    validation,
  };
}
