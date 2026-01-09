export type IntakeSlots = {
  location?: string;
  symptomOrNeed?: string;
  timingOrUrgency?: string;
};

export type IntakeState = {
  categoryId?: string;
  step: "ASK_DESCRIPTION" | "ASK_FOLLOWUP" | "ASK_IMAGE" | "THINKING";
  slots: IntakeSlots;
  lastQuestion?: keyof IntakeSlots;
};

export function isUrgentOrDistressed(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;

  return (
    /\b(urgent|asap|emergency|help|breakdown|break\s*down|stranded|stuck)\b/i.test(t) ||
    /\b(can\s*['’]?t\s+move|cannot\s+move)\b/i.test(t)
  );
}

export function isGreetingOrRandom(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;

  // Greetings / pleasantries
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|yo)\b/.test(t)) return true;
  if (/^(thanks|thank you|ok|okay|cool|alright|sure)\b/.test(t)) return true;

  // Very short and no meaningful nouns/verbs
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc <= 2 && !/(leak|broken|repair|clean|noise|smell|install|fix|problem|issue)/.test(t)) {
    return true;
  }

  return false;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export function extractSlotsFromText(text: string): IntakeSlots {
  const raw = text.trim();
  const t = raw.toLowerCase();

  const location =
    firstMatch(raw, [
      /\b(?:in|at|inside|around|near)\s+the\s+([^.,;\n]+)\b/i,
      /\b(?:in|at|inside|around|near)\s+([^.,;\n]+)\b/i,
    ]) ||
    (/(kitchen|bathroom|toilet|bedroom|living\s*room|office|garage|balcony|gate|door|window|ceiling|wall|roof|stairs|compound|outside)/i.exec(raw)?.[0]);

  const timingOrUrgency =
    firstMatch(raw, [
      /\b(since\s+[^.,;\n]+)\b/i,
      /\b(for\s+the\s+past\s+[^.,;\n]+)\b/i,
      /\b(today|yesterday|tonight|this\s+morning|this\s+afternoon|this\s+evening|last\s+night|last\s+week|last\s+month)\b/i,
    ]) ||
    (/(urgent|asap|immediately|emergency|critical|not\s+urgent)/i.exec(raw)?.[0]);

  // Symptom / need: keep it simple, but avoid treating pure greetings as symptom
  // If the text is long enough, treat the full message as symptom/need.
  let symptomOrNeed: string | undefined;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if ((wordCount >= 4 || isUrgentOrDistressed(raw)) && !isGreetingOrRandom(raw)) {
    symptomOrNeed = raw;
  }

  return {
    ...(location ? { location } : {}),
    ...(symptomOrNeed ? { symptomOrNeed } : {}),
    ...(timingOrUrgency ? { timingOrUrgency } : {}),
  };
}

export function nextMissingSlot(slots: IntakeSlots): keyof IntakeSlots | null {
  if (!slots.location) return "location";
  if (!slots.symptomOrNeed) return "symptomOrNeed";
  if (!slots.timingOrUrgency) return "timingOrUrgency";
  return null;
}

export function followupQuestionFor(slot: keyof IntakeSlots, categoryId?: string): string {
  switch (slot) {
    case "location":
      return "Which area is this happening?";
    case "symptomOrNeed":
      // Keep it short, but lightly contextualize “cleaning” for those categories.
      if (categoryId && /(clean|janitorial)/i.test(categoryId)) {
        return "What exactly needs cleaning?";
      }
      return "What exactly is the problem?";
    case "timingOrUrgency":
      return "When did it start / how urgent is it?";
  }
}

export function mergeSlots(existing: IntakeSlots, incoming: IntakeSlots): IntakeSlots {
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => Boolean(v))),
  } as IntakeSlots;
}
