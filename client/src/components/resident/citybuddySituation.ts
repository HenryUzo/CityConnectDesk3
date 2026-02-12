import type { CityBuddySituation } from "@/lib/citybuddy-types";

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

export function classifyCityBuddySituation({
  categoryId,
  description,
}: {
  categoryId: string;
  description: string;
}): CityBuddySituation {
  const text = `${categoryId} ${description}`.toLowerCase();

  const highRiskSignals = [
    "gas",
    "smell gas",
    "leak",
    "sparks",
    "spark",
    "shock",
    "electroc",
    "fire",
    "smoke",
    "burn",
    "burning",
    "flood",
    "burst",
    "collapsed",
    "collapse",
    "structural",
    "crack",
    "ceiling",
  ];

  const mediumRiskSignals = [
    "tripping",
    "breaker",
    "mold",
    "mould",
    "sewage",
    "overflow",
    "short circuit",
    "overheating",
  ];

  const riskyCategories = [
    "electric",
    "electrical",
    "gas",
    "plumbing",
    "water",
  ];

  let risk: CityBuddySituation["risk"] = "low";
  if (includesAny(text, highRiskSignals)) risk = "high";
  else if (includesAny(text, mediumRiskSignals) || includesAny(text, riskyCategories)) risk = "medium";

  const length = description.trim().length;
  let clarity: CityBuddySituation["clarity"] = "low";
  if (length >= 80) clarity = "high";
  else if (length >= 35) clarity = "medium";

  const diySafe = risk === "low";
  return { clarity, risk, diySafe };
}
