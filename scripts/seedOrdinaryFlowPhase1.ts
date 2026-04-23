import { db, dbReady } from "../server/db";
import { sql, eq, and } from "drizzle-orm";
import {
  ordinaryFlowDefinitions,
  ordinaryFlowOptions,
  ordinaryFlowQuestions,
  ordinaryFlowRules,
} from "../shared/schema";

type SeedQuestion = {
  questionKey: string;
  prompt: string;
  description?: string;
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
  isRequired?: boolean;
  isTerminal?: boolean;
  orderIndex: number;
  defaultNextKey?: string | null;
  validation?: Record<string, unknown>;
  uiMeta?: Record<string, unknown>;
  options?: Array<{
    optionKey: string;
    label: string;
    value: string;
    icon?: string;
    orderIndex?: number;
    nextQuestionKey?: string | null;
    meta?: Record<string, unknown>;
  }>;
};

type SeedFlow = {
  categoryKey: "plumber" | "electrician" | "locksmith";
  name: string;
  questions: SeedQuestion[];
};

const baseTailQuestions: SeedQuestion[] = [
  {
    questionKey: "quantity",
    prompt: "How many units or areas are affected?",
    inputType: "single_select",
    isRequired: true,
    orderIndex: 90,
    defaultNextKey: "time_window",
    options: [
      { optionKey: "one", label: "1", value: "1", orderIndex: 0 },
      { optionKey: "two_three", label: "2-3", value: "2-3", orderIndex: 1 },
      { optionKey: "four_six", label: "4-6", value: "4-6", orderIndex: 2 },
      { optionKey: "seven_plus", label: "7+", value: "7+", orderIndex: 3 },
    ],
  },
  {
    questionKey: "time_window",
    prompt: "When should we come?",
    inputType: "single_select",
    isRequired: true,
    orderIndex: 100,
    defaultNextKey: "photos",
    options: [
      { optionKey: "today", label: "Today", value: "Today", orderIndex: 0 },
      { optionKey: "within_3_days", label: "Within 3 days", value: "Within 3 days", orderIndex: 1 },
      { optionKey: "this_week", label: "This week", value: "This week", orderIndex: 2 },
      { optionKey: "flexible", label: "Flexible", value: "Flexible", orderIndex: 3 },
    ],
  },
  {
    questionKey: "photos",
    prompt: "Upload photo evidence (optional).",
    description: "Photos help the provider prepare tools before arrival.",
    inputType: "file",
    isRequired: false,
    orderIndex: 110,
    defaultNextKey: "notes",
    validation: { maxFiles: 3, acceptedMimePrefix: "image/" },
  },
  {
    questionKey: "notes",
    prompt: "Anything else we should know?",
    inputType: "text",
    isRequired: false,
    isTerminal: true,
    orderIndex: 120,
    validation: { maxLength: 1000 },
  },
];

const flows: SeedFlow[] = [
  {
    categoryKey: "plumber",
    name: "Ordinary Flow - Plumber (Phase 1)",
    questions: [
      {
        questionKey: "location",
        prompt: "Share your location and estate details.",
        description: "Estate decision + address are captured in a single structured answer.",
        inputType: "location",
        isRequired: true,
        orderIndex: 10,
        defaultNextKey: "urgency",
      },
      {
        questionKey: "urgency",
        prompt: "How urgent is this?",
        inputType: "urgency",
        isRequired: true,
        orderIndex: 20,
        defaultNextKey: "issue_type",
      },
      {
        questionKey: "issue_type",
        prompt: "Pick the closest plumbing issue type.",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 30,
        options: [
          { optionKey: "blocked_drain", label: "Blocked drain", value: "Blocked drain", nextQuestionKey: "plumber_blocked_drain_scope" },
          { optionKey: "leak", label: "Leak", value: "Leak", nextQuestionKey: "plumber_leak_state" },
          { optionKey: "low_pressure", label: "Low pressure", value: "Low pressure", nextQuestionKey: "plumber_low_pressure_scope" },
          { optionKey: "install_fixture", label: "Install fixture", value: "Install fixture", nextQuestionKey: "plumber_install_fixture_type" },
          { optionKey: "replace_fixture", label: "Replace fixture", value: "Replace fixture", nextQuestionKey: "plumber_replace_fixture_type" },
          { optionKey: "other", label: "Other", value: "Other", nextQuestionKey: "plumber_other_clarifier" },
        ],
      },
      {
        questionKey: "plumber_blocked_drain_scope",
        prompt: "Where is the blocked drain located?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 40,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "kitchen", label: "Kitchen", value: "Kitchen" },
          { optionKey: "bathroom", label: "Bathroom", value: "Bathroom" },
          { optionKey: "outdoor", label: "Outdoor", value: "Outdoor" },
          { optionKey: "multiple", label: "Multiple areas", value: "Multiple areas" },
        ],
      },
      {
        questionKey: "plumber_leak_state",
        prompt: "Is the leak currently active?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 41,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "active", label: "Yes, actively leaking", value: "Yes, actively leaking" },
          { optionKey: "intermittent", label: "Intermittent", value: "Intermittent" },
          { optionKey: "stopped", label: "No, currently stopped", value: "No, currently stopped" },
        ],
      },
      {
        questionKey: "plumber_low_pressure_scope",
        prompt: "Where is low pressure observed?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 42,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "single_tap", label: "Single tap", value: "Single tap" },
          { optionKey: "multiple_taps", label: "Multiple taps", value: "Multiple taps" },
          { optionKey: "entire_home", label: "Entire home", value: "Entire home" },
        ],
      },
      {
        questionKey: "plumber_install_fixture_type",
        prompt: "What fixture are you installing?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 43,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "sink", label: "Sink", value: "Sink" },
          { optionKey: "toilet", label: "Toilet", value: "Toilet" },
          { optionKey: "shower", label: "Shower", value: "Shower" },
          { optionKey: "water_heater", label: "Water heater", value: "Water heater" },
          { optionKey: "other_fixture", label: "Other fixture", value: "Other fixture" },
        ],
      },
      {
        questionKey: "plumber_replace_fixture_type",
        prompt: "What fixture should be replaced?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 44,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "tap", label: "Tap", value: "Tap" },
          { optionKey: "pipe", label: "Pipe", value: "Pipe" },
          { optionKey: "wc", label: "Toilet/WC", value: "Toilet/WC" },
          { optionKey: "valve", label: "Valve", value: "Valve" },
          { optionKey: "other_replace", label: "Other", value: "Other" },
        ],
      },
      {
        questionKey: "plumber_other_clarifier",
        prompt: "Please describe the plumbing issue.",
        inputType: "text",
        isRequired: true,
        orderIndex: 45,
        defaultNextKey: "quantity",
        validation: { minLength: 5, maxLength: 400 },
      },
      ...baseTailQuestions,
    ],
  },
  {
    categoryKey: "electrician",
    name: "Ordinary Flow - Electrician (Phase 1)",
    questions: [
      {
        questionKey: "location",
        prompt: "Share your location and estate details.",
        inputType: "location",
        isRequired: true,
        orderIndex: 10,
        defaultNextKey: "urgency",
      },
      {
        questionKey: "urgency",
        prompt: "How urgent is this?",
        inputType: "urgency",
        isRequired: true,
        orderIndex: 20,
        defaultNextKey: "issue_type",
      },
      {
        questionKey: "issue_type",
        prompt: "Pick the closest electrical issue type.",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 30,
        options: [
          { optionKey: "no_power", label: "No power", value: "No power", nextQuestionKey: "electric_no_power_scope" },
          { optionKey: "breaker_trips", label: "Breaker trips", value: "Breaker trips", nextQuestionKey: "electric_breaker_scope" },
          { optionKey: "socket_sparking", label: "Socket sparking", value: "Socket sparking", nextQuestionKey: "electric_sparking_safety" },
          { optionKey: "install_fitting", label: "Install fitting", value: "Install fitting", nextQuestionKey: "electric_install_fitting_type" },
          { optionKey: "replace_fitting", label: "Replace fitting", value: "Replace fitting", nextQuestionKey: "electric_replace_fitting_type" },
          { optionKey: "other", label: "Other", value: "Other", nextQuestionKey: "electric_other_clarifier" },
        ],
      },
      {
        questionKey: "electric_no_power_scope",
        prompt: "Is power out in one area or the whole property?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 40,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "single_room", label: "Single room", value: "Single room" },
          { optionKey: "multiple_rooms", label: "Multiple rooms", value: "Multiple rooms" },
          { optionKey: "entire_property", label: "Entire property", value: "Entire property" },
        ],
      },
      {
        questionKey: "electric_breaker_scope",
        prompt: "How often does the breaker trip?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 41,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "once_daily", label: "Once daily", value: "Once daily" },
          { optionKey: "many_times_daily", label: "Multiple times daily", value: "Multiple times daily" },
          { optionKey: "immediately", label: "Immediately after reset", value: "Immediately after reset" },
        ],
      },
      {
        questionKey: "electric_sparking_safety",
        prompt: "Safety check: do you smell burning, see smoke, or feel heat?",
        description: "Critical branch for sparking sockets.",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 42,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "yes_critical", label: "Yes - immediate danger", value: "Yes - immediate danger" },
          { optionKey: "minor_sparks", label: "Minor sparks only", value: "Minor sparks only" },
          { optionKey: "no_signs", label: "No additional danger signs", value: "No additional danger signs" },
        ],
      },
      {
        questionKey: "electric_install_fitting_type",
        prompt: "What fitting should be installed?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 43,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "socket", label: "Socket", value: "Socket" },
          { optionKey: "light", label: "Light fitting", value: "Light fitting" },
          { optionKey: "switch", label: "Switch", value: "Switch" },
          { optionKey: "db", label: "Distribution board", value: "Distribution board" },
        ],
      },
      {
        questionKey: "electric_replace_fitting_type",
        prompt: "What fitting should be replaced?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 44,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "socket", label: "Socket", value: "Socket" },
          { optionKey: "light", label: "Light fitting", value: "Light fitting" },
          { optionKey: "switch", label: "Switch", value: "Switch" },
          { optionKey: "breaker", label: "Breaker", value: "Breaker" },
        ],
      },
      {
        questionKey: "electric_other_clarifier",
        prompt: "Please describe the electrical issue.",
        inputType: "text",
        isRequired: true,
        orderIndex: 45,
        defaultNextKey: "quantity",
        validation: { minLength: 5, maxLength: 400 },
      },
      ...baseTailQuestions,
    ],
  },
  {
    categoryKey: "locksmith",
    name: "Ordinary Flow - Locksmith (Phase 1)",
    questions: [
      {
        questionKey: "location",
        prompt: "Share your location and estate details.",
        inputType: "location",
        isRequired: true,
        orderIndex: 10,
        defaultNextKey: "urgency",
      },
      {
        questionKey: "urgency",
        prompt: "How urgent is this?",
        inputType: "urgency",
        isRequired: true,
        orderIndex: 20,
        defaultNextKey: "issue_type",
      },
      {
        questionKey: "issue_type",
        prompt: "Pick the closest locksmith issue type.",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 30,
        options: [
          { optionKey: "lockout", label: "Lockout", value: "Lockout", nextQuestionKey: "locksmith_lockout_position" },
          { optionKey: "key_broken", label: "Key broken", value: "Key broken", nextQuestionKey: "locksmith_key_broken_location" },
          { optionKey: "lock_replacement", label: "Lock replacement", value: "Lock replacement", nextQuestionKey: "locksmith_replacement_type" },
          { optionKey: "smart_lock_install", label: "Smart lock install", value: "Smart lock install", nextQuestionKey: "locksmith_smart_lock_type" },
          { optionKey: "other", label: "Other", value: "Other", nextQuestionKey: "locksmith_other_clarifier" },
        ],
      },
      {
        questionKey: "locksmith_lockout_position",
        prompt: "Are you currently inside or outside the property?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 40,
        defaultNextKey: "locksmith_lockout_emergency_context",
        options: [
          { optionKey: "outside", label: "Outside", value: "Outside" },
          { optionKey: "inside", label: "Inside", value: "Inside" },
        ],
      },
      {
        questionKey: "locksmith_lockout_emergency_context",
        prompt: "Is there any emergency context we should know?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 41,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "none", label: "No emergency", value: "No emergency" },
          { optionKey: "child_elderly", label: "Child/Elderly inside", value: "Child/Elderly inside" },
          { optionKey: "medical", label: "Medical urgency", value: "Medical urgency" },
        ],
      },
      {
        questionKey: "locksmith_key_broken_location",
        prompt: "Where is the key broken?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 42,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "door_lock", label: "Door lock", value: "Door lock" },
          { optionKey: "gate_lock", label: "Gate lock", value: "Gate lock" },
          { optionKey: "padlock", label: "Padlock", value: "Padlock" },
          { optionKey: "car_lock", label: "Car lock", value: "Car lock" },
        ],
      },
      {
        questionKey: "locksmith_replacement_type",
        prompt: "What lock type should be replaced?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 43,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "mortise", label: "Mortise lock", value: "Mortise lock" },
          { optionKey: "deadbolt", label: "Deadbolt", value: "Deadbolt" },
          { optionKey: "cylinder", label: "Cylinder lock", value: "Cylinder lock" },
        ],
      },
      {
        questionKey: "locksmith_smart_lock_type",
        prompt: "What smart lock type do you want installed?",
        inputType: "single_select",
        isRequired: true,
        orderIndex: 44,
        defaultNextKey: "quantity",
        options: [
          { optionKey: "keypad", label: "Keypad lock", value: "Keypad lock" },
          { optionKey: "fingerprint", label: "Fingerprint lock", value: "Fingerprint lock" },
          { optionKey: "wifi", label: "Wi-Fi smart lock", value: "Wi-Fi smart lock" },
        ],
      },
      {
        questionKey: "locksmith_other_clarifier",
        prompt: "Please describe the locksmith issue.",
        inputType: "text",
        isRequired: true,
        orderIndex: 45,
        defaultNextKey: "quantity",
        validation: { minLength: 5, maxLength: 400 },
      },
      ...baseTailQuestions,
    ],
  },
];

async function ensureFlowTablesForSeed() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_scope') THEN
        CREATE TYPE ordinary_flow_scope AS ENUM ('global', 'estate');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_definition_status') THEN
        CREATE TYPE ordinary_flow_definition_status AS ENUM ('draft', 'published', 'archived');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_input_type') THEN
        CREATE TYPE ordinary_flow_input_type AS ENUM (
          'single_select','multi_select','text','number','date','time','datetime',
          'location','file','yes_no','urgency','estate'
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_rule_action') THEN
        CREATE TYPE ordinary_flow_rule_action AS ENUM ('goto_question', 'terminate', 'set_value', 'skip');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_session_status') THEN
        CREATE TYPE ordinary_flow_session_status AS ENUM ('active', 'completed', 'cancelled');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_answered_by') THEN
        CREATE TYPE ordinary_flow_answered_by AS ENUM ('resident', 'admin', 'system');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_definitions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      category_key text NOT NULL,
      scope ordinary_flow_scope NOT NULL DEFAULT 'global',
      estate_id varchar,
      name text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      status ordinary_flow_definition_status NOT NULL DEFAULT 'draft',
      published_at timestamp,
      published_by varchar,
      created_by varchar,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ordinary_flow_questions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      question_key text NOT NULL,
      prompt text NOT NULL,
      description text,
      input_type ordinary_flow_input_type NOT NULL DEFAULT 'text',
      is_required boolean NOT NULL DEFAULT true,
      is_terminal boolean NOT NULL DEFAULT false,
      order_index integer NOT NULL DEFAULT 0,
      validation jsonb NOT NULL DEFAULT '{}',
      ui_meta jsonb NOT NULL DEFAULT '{}',
      default_next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ordinary_flow_options (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      option_key text NOT NULL,
      label text NOT NULL,
      value text NOT NULL,
      icon text,
      order_index integer NOT NULL DEFAULT 0,
      next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      meta jsonb NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ordinary_flow_rules (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      from_question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      priority integer NOT NULL DEFAULT 100,
      condition_json jsonb NOT NULL DEFAULT '{}',
      action ordinary_flow_rule_action NOT NULL DEFAULT 'goto_question',
      next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      action_payload jsonb NOT NULL DEFAULT '{}',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_definitions_unique_version
      ON ordinary_flow_definitions(category_key, scope, COALESCE(estate_id, ''), version);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_questions_unique_key
      ON ordinary_flow_questions(flow_id, question_key);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_options_unique_key
      ON ordinary_flow_options(question_id, option_key);
  `);
}

async function upsertFlow(flow: SeedFlow) {
  const [existing] = await db
    .select()
    .from(ordinaryFlowDefinitions)
    .where(
      and(
        eq(ordinaryFlowDefinitions.categoryKey, flow.categoryKey),
        eq(ordinaryFlowDefinitions.scope, "global"),
        eq(ordinaryFlowDefinitions.version, 1),
      ),
    )
    .limit(1);

  const [definition] = existing
    ? await db
        .update(ordinaryFlowDefinitions)
        .set({
          name: flow.name,
          status: "published",
          isDefault: true,
          publishedAt: new Date(),
          publishedBy: "ordinary_flow_seed",
          updatedAt: new Date(),
        })
        .where(eq(ordinaryFlowDefinitions.id, existing.id))
        .returning()
    : await db
        .insert(ordinaryFlowDefinitions)
        .values({
          categoryKey: flow.categoryKey,
          scope: "global",
          estateId: null,
          name: flow.name,
          version: 1,
          status: "published",
          publishedAt: new Date(),
          publishedBy: "ordinary_flow_seed",
          createdBy: "ordinary_flow_seed",
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

  await db
    .update(ordinaryFlowDefinitions)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ordinaryFlowDefinitions.categoryKey, flow.categoryKey),
        eq(ordinaryFlowDefinitions.scope, "global"),
        sql`${ordinaryFlowDefinitions.id} <> ${definition.id}`,
        eq(ordinaryFlowDefinitions.status, "published"),
      ),
    );

  for (const question of flow.questions) {
    const [existingQuestion] = await db
      .select({ id: ordinaryFlowQuestions.id })
      .from(ordinaryFlowQuestions)
      .where(
        and(
          eq(ordinaryFlowQuestions.flowId, definition.id),
          eq(ordinaryFlowQuestions.questionKey, question.questionKey),
        ),
      )
      .limit(1);

    if (existingQuestion) {
      await db
        .update(ordinaryFlowQuestions)
        .set({
          prompt: question.prompt,
          description: question.description ?? null,
          inputType: question.inputType as any,
          isRequired: question.isRequired ?? true,
          isTerminal: question.isTerminal ?? false,
          orderIndex: question.orderIndex,
          validation: question.validation ?? {},
          uiMeta: question.uiMeta ?? {},
          defaultNextQuestionId: null,
          updatedAt: new Date(),
        })
        .where(eq(ordinaryFlowQuestions.id, existingQuestion.id));
    } else {
      await db.insert(ordinaryFlowQuestions).values({
        flowId: definition.id,
        questionKey: question.questionKey,
        prompt: question.prompt,
        description: question.description ?? null,
        inputType: question.inputType as any,
        isRequired: question.isRequired ?? true,
        isTerminal: question.isTerminal ?? false,
        orderIndex: question.orderIndex,
        validation: question.validation ?? {},
        uiMeta: question.uiMeta ?? {},
        defaultNextQuestionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const questionRows = await db
    .select()
    .from(ordinaryFlowQuestions)
    .where(eq(ordinaryFlowQuestions.flowId, definition.id));
  const questionByKey = new Map<string, any>();
  for (const row of questionRows) {
    questionByKey.set(String(row.questionKey), row);
  }

  for (const question of flow.questions) {
    const row = questionByKey.get(question.questionKey);
    if (!row) continue;
    const nextId = question.defaultNextKey
      ? questionByKey.get(question.defaultNextKey)?.id || null
      : null;
    await db
      .update(ordinaryFlowQuestions)
      .set({
        defaultNextQuestionId: nextId,
        updatedAt: new Date(),
      })
      .where(eq(ordinaryFlowQuestions.id, row.id));
  }

  const questionIds = questionRows.map((row) => String(row.id));
  if (questionIds.length) {
    await db.execute(sql`
      DELETE FROM ordinary_flow_options
      WHERE question_id IN (${sql.join(
        questionIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
  }

  const optionValues: any[] = [];
  for (const question of flow.questions) {
    const q = questionByKey.get(question.questionKey);
    if (!q || !question.options?.length) continue;
    question.options.forEach((option, index) => {
      optionValues.push({
        questionId: q.id,
        optionKey: option.optionKey,
        label: option.label,
        value: option.value,
        icon: option.icon ?? null,
        orderIndex: option.orderIndex ?? index,
        nextQuestionId: option.nextQuestionKey
          ? questionByKey.get(option.nextQuestionKey)?.id || null
          : null,
        meta: option.meta ?? {},
      });
    });
  }
  if (optionValues.length) {
    await db.insert(ordinaryFlowOptions).values(optionValues as any);
  }

  await db.delete(ordinaryFlowRules).where(eq(ordinaryFlowRules.flowId, definition.id));

  console.log(`[seed] upserted ${flow.categoryKey} flow (v1 published)`);
}

async function main() {
  await dbReady;
  await ensureFlowTablesForSeed();
  for (const flow of flows) {
    await upsertFlow(flow);
  }
  console.log("[seed] ordinary flow phase1 completed");
}

main()
  .catch((error) => {
    console.error("[seed] ordinary flow phase1 failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const maybePool = (await import("../server/db")).pool as any;
      if (maybePool?.end) await maybePool.end();
    } catch {
      // ignore shutdown issues
    }
  });

