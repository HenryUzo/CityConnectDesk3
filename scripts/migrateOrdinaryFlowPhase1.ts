import { sql } from "drizzle-orm";
import { db, dbReady } from "../server/db";

async function ensureOrdinaryFlowEnums() {
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
}

async function ensureOrdinaryFlowTables() {
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
  `);

  await db.execute(sql`
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
  `);

  await db.execute(sql`
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
  `);

  await db.execute(sql`
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
    CREATE TABLE IF NOT EXISTS ordinary_flow_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id varchar NOT NULL UNIQUE,
      resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_key text NOT NULL,
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      flow_version integer NOT NULL,
      status ordinary_flow_session_status NOT NULL DEFAULT 'active',
      current_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      answers_snapshot jsonb NOT NULL DEFAULT '{}',
      active_path jsonb NOT NULL DEFAULT '[]',
      state_revision integer NOT NULL DEFAULT 0,
      started_at timestamp DEFAULT now(),
      completed_at timestamp,
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_answers (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id varchar NOT NULL REFERENCES ordinary_flow_sessions(id) ON DELETE CASCADE,
      question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      question_key text NOT NULL,
      answer_json jsonb NOT NULL DEFAULT '{}',
      answered_by ordinary_flow_answered_by NOT NULL DEFAULT 'resident',
      revision integer NOT NULL DEFAULT 1,
      answered_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_definitions_unique_version
      ON ordinary_flow_definitions(category_key, scope, COALESCE(estate_id, ''), version);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_questions_unique_key
      ON ordinary_flow_questions(flow_id, question_key);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_options_unique_key
      ON ordinary_flow_options(question_id, option_key);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_answers_unique_question
      ON ordinary_flow_answers(session_id, question_id);
    CREATE INDEX IF NOT EXISTS ordinary_flow_rules_from_priority_idx
      ON ordinary_flow_rules(flow_id, from_question_id, priority);
    CREATE INDEX IF NOT EXISTS ordinary_flow_sessions_resident_status_updated_idx
      ON ordinary_flow_sessions(resident_id, status, updated_at DESC);
  `);
}

async function main() {
  await dbReady;
  await ensureOrdinaryFlowEnums();
  await ensureOrdinaryFlowTables();
  console.log("[ordinary-flow-migrate] Schema ensured.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[ordinary-flow-migrate] Failed:", error);
    process.exit(1);
  });
