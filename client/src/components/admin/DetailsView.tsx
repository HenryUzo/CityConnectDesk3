import React, { useMemo, useState } from "react";
import formatDate from "@/utils/formatDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function prettyKey(k: string) {
  return k
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

function isIsoDateString(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v);
}

const isPrimitive = (v: any) => {
  return v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v) || isIsoDateString(v);
};

function renderPrimitive(val: any) {
  if (val === null || typeof val === "undefined" || val === "") return <span className="text-muted-foreground">—</span>;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (isIsoDateString(val)) return formatDate(val);
  return String(val);
}

function renderObjectGrid(obj: Record<string, any>, parentKey?: string) {
  const entries = Object.entries(obj).filter(([k]) => k !== "submittedAt");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-3">
          <div className="text-xs text-muted-foreground w-36">{prettyKey(k)}</div>
          <div className="text-sm break-words">{isPrimitive(v) ? renderPrimitive(v) : Array.isArray(v) ? (
            <ul className="list-disc pl-5">
              {v.map((it: any, idx: number) => <li key={idx}>{isPrimitive(it) ? renderPrimitive(it) : JSON.stringify(it)}</li>)}
            </ul>
          ) : (
            <div className="space-y-1">
              {Object.entries(v).map(([kk, vv]) => (
                <div key={kk} className="flex gap-2">
                  <div className="text-xs text-muted-foreground w-28">{prettyKey(kk)}</div>
                  <div className="text-sm">{isPrimitive(vv) ? renderPrimitive(vv) : JSON.stringify(vv)}</div>
                </div>
              ))}
            </div>
          )}</div>
        </div>
      ))}
    </div>
  );
}

export default function DetailsView({ data }: { data: any }) {
  const [showRaw, setShowRaw] = useState(false);

  const entries = useMemo(() => {
    if (!data) return [] as Array<[string, any]>;
    let raw: Array<[string, any]> = [];
    if (typeof data === "string") {
      try {
        raw = Object.entries(JSON.parse(data));
      } catch {
        raw = [["value", data]];
      }
    } else if (typeof data === "object") raw = Object.entries(data);
    else raw = [["value", data]];

    return raw.filter(([k]) => k !== "submittedAt");
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Details</Label>
        <Button variant="ghost" size="sm" onClick={() => setShowRaw((s) => !s)}>
          {showRaw ? "Hide raw" : "View raw JSON"}
        </Button>
      </div>

      {showRaw ? (
        <pre className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-slate-800 p-3 rounded">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div className="space-y-2">
          {entries.length === 0 && <div className="text-sm text-muted-foreground">No details</div>}
          {entries.map(([k, v]) => (
            <div key={k}>
              {isPrimitive(v) || Array.isArray(v) ? (
                <div className="flex gap-3">
                  <div className="text-xs text-muted-foreground w-36">{prettyKey(k)}</div>
                  <div className="text-sm">{isPrimitive(v) ? renderPrimitive(v) : (
                    <ul className="list-disc pl-5">{v.map((it: any, i: number) => <li key={i}>{isPrimitive(it) ? renderPrimitive(it) : JSON.stringify(it)}</li>)}</ul>
                  )}</div>
                </div>
              ) : (
                <details className="group bg-white/50 dark:bg-slate-900 p-3 rounded">
                  <summary className="cursor-pointer list-none outline-none py-1 flex justify-between items-center">
                    <div className="text-sm font-medium">{prettyKey(k)}</div>
                    <div className="text-xs text-muted-foreground">{typeof v === 'object' && Object.keys(v).filter(k => k !== 'submittedAt').length} items</div>
                  </summary>
                  <div className="mt-2">
                    {renderObjectGrid(v, k)}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
