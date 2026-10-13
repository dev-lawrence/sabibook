// Extraction eval: runs every case in eval/cases.json through extractEntry()
// for each model and scores it field by field. See eval/README.md.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { extractEntry, type ExtractedEntry } from "../convex/model/extraction";
import type { LlmConfig } from "../convex/model/llm";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

type Lang = "en" | "pcm" | "mixed";
type EvalCase = {
  id: string;
  lang: Lang;
  today: string;
  customers: string[];
  text: string;
  expected: {
    type: string;
    occurredOn: string;
    customerName: string | null;
    total: number | null;
    paid: number | null;
    balance: number | null;
    items: { name: string; qty: number | null; amount: number | null }[];
    flags: string[];
  };
};

const FIELDS = ["type", "occurredOn", "customerName", "total", "paid", "balance", "items", "flags"] as const;
type Field = (typeof FIELDS)[number];
type CaseResult = {
  id: string;
  lang: Lang;
  ok: Record<Field, boolean>;
  exact: boolean;
  ms: number | null;
  error: string | null;
  diffs: string[];
  predicted: ExtractedEntry | null;
};

function parseArgs(argv: string[]) {
  const out: { models?: string; limit?: number; only?: Lang } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--models") out.models = argv[++i];
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--only") {
      const v = argv[++i];
      if (v !== "en" && v !== "pcm" && v !== "mixed") throw new Error("--only must be en, pcm or mixed");
      out.only = v;
    } else throw new Error(`Unknown flag ${a}`);
  }
  return out;
}

const norm = (s: string | null) => (s === null ? null : s.trim().toLowerCase());
const show = (v: unknown) => (v === null || v === undefined ? "null" : typeof v === "string" ? `"${v}"` : String(v));

/**
 * Scoring rules (one boolean per field):
 * - type, occurredOn, total, paid, balance: exact equality (null equals null only).
 * - customerName: case-insensitive, trimmed; null equals null only.
 * - items: same count, and the expected item amounts match the predicted item
 *   amounts as a multiset (each predicted amount used once; null matches null).
 *   Names and qty are not scored.
 * - flags: the set of expected codes must be a subset of the predicted codes,
 *   and the model must not raise a 'credit_without_customer' or
 *   'items_mismatch' that was not expected. Other extra codes (for example
 *   amount_not_heard) are not penalised.
 */
function score(c: EvalCase, p: ExtractedEntry): { ok: Record<Field, boolean>; diffs: string[] } {
  const e = c.expected;
  const diffs: string[] = [];

  const predAmounts = p.items.map((i) => i.amount);
  const pool = [...predAmounts];
  let itemsOk = e.items.length === p.items.length;
  if (itemsOk) {
    for (const it of e.items) {
      const idx = pool.indexOf(it.amount);
      if (idx === -1) { itemsOk = false; break; }
      pool.splice(idx, 1);
    }
  }

  const predCodes = new Set(p.flags.map((f) => f.code));
  const expCodes = new Set(e.flags);
  const missingCodes = [...expCodes].filter((x) => !predCodes.has(x));
  const falseAlarms = ["credit_without_customer", "items_mismatch"].filter((x) => predCodes.has(x) && !expCodes.has(x));
  const flagsOk = missingCodes.length === 0 && falseAlarms.length === 0;

  const ok: Record<Field, boolean> = {
    type: p.type === e.type,
    occurredOn: p.occurredOn === e.occurredOn,
    customerName: norm(p.customerName) === norm(e.customerName),
    total: p.total === e.total,
    paid: p.paid === e.paid,
    balance: p.balance === e.balance,
    items: itemsOk,
    flags: flagsOk,
  };
  if (!ok.type) diffs.push(`type ${show(p.type)} vs ${show(e.type)}`);
  if (!ok.occurredOn) diffs.push(`date ${p.occurredOn} vs ${e.occurredOn}`);
  if (!ok.customerName) diffs.push(`customer ${show(p.customerName)} vs ${show(e.customerName)}`);
  if (!ok.total) diffs.push(`total ${show(p.total)} vs ${show(e.total)}`);
  if (!ok.paid) diffs.push(`paid ${show(p.paid)} vs ${show(e.paid)}`);
  if (!ok.balance) diffs.push(`balance ${show(p.balance)} vs ${show(e.balance)}`);
  if (!ok.items) diffs.push(`items [${predAmounts.map(show).join(",")}] vs [${e.items.map((i) => show(i.amount)).join(",")}]`);
  if (!ok.flags) {
    const bits = [];
    if (missingCodes.length) bits.push(`missing ${missingCodes.join("+")}`);
    if (falseAlarms.length) bits.push(`false alarm ${falseAlarms.join("+")}`);
    diffs.push(`flags ${bits.join(", ")}`);
  }
  return { ok, diffs };
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
const fmtMs = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)}ms`);

type ModelReport = {
  model: string;
  results: CaseResult[];
  fieldAcc: Record<Field, string>;
  exactRate: string;
  exactByLang: Record<Lang, string>;
  median: number | null;
  p90: number | null;
  errors: number;
};

function summarise(model: string, results: CaseResult[]): ModelReport {
  const n = results.length;
  const fieldAcc = {} as Record<Field, string>;
  for (const f of FIELDS) fieldAcc[f] = pct(results.filter((r) => r.ok[f]).length, n);
  const exactByLang = {} as Record<Lang, string>;
  for (const l of ["en", "pcm", "mixed"] as const) {
    const sub = results.filter((r) => r.lang === l);
    exactByLang[l] = sub.length ? `${pct(sub.filter((r) => r.exact).length, sub.length)} (${sub.filter((r) => r.exact).length}/${sub.length})` : "n/a";
  }
  const ms = results.filter((r) => r.ms !== null).map((r) => r.ms as number).sort((a, b) => a - b);
  return {
    model,
    results,
    fieldAcc,
    exactRate: pct(results.filter((r) => r.exact).length, n),
    exactByLang,
    median: quantile(ms, 0.5),
    p90: quantile(ms, 0.9),
    errors: results.filter((r) => r.error).length,
  };
}

function renderMarkdown(reports: ModelReport[], meta: { date: string; host: string; cases: number; filter: string }) {
  const lines: string[] = [];
  lines.push("## Extraction eval", "");
  lines.push(`- Date: ${meta.date}`);
  lines.push(`- Endpoint host: ${meta.host}`);
  lines.push(`- Models: ${reports.map((r) => r.model).join(", ")}`);
  lines.push(`- Cases: ${meta.cases}${meta.filter ? ` (${meta.filter})` : ""}`, "");
  const header = ["Model", ...FIELDS, "exact", "en", "pcm", "mixed", "median", "p90", "errors"];
  lines.push(`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`);
  for (const r of reports) {
    lines.push(
      `| ${[r.model, ...FIELDS.map((f) => r.fieldAcc[f]), r.exactRate, r.exactByLang.en, r.exactByLang.pcm, r.exactByLang.mixed, fmtMs(r.median), fmtMs(r.p90), r.errors].join(" | ")} |`,
    );
  }
  lines.push("");
  for (const r of reports) {
    const failing = r.results.filter((x) => !x.exact);
    lines.push(`### Failing cases: ${r.model} (${failing.length}/${r.results.length})`, "");
    if (!failing.length) lines.push("None.");
    for (const f of failing) lines.push(`- ${f.id}: ${f.error ? `ERROR ${f.error}` : f.diffs.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

function writeSection(file: string, name: "extract" | "asr", body: string) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const block = `${start}\n${body}\n${end}`;
  if (!fs.existsSync(file)) {
    const extract = name === "extract" ? block : "<!-- extract:start --><!-- extract:end -->";
    const asr = name === "asr" ? block : "<!-- asr:start --><!-- asr:end -->";
    fs.writeFileSync(file, `# Eval results\n\n${extract}\n\n${asr}\n`);
    return;
  }
  let text = fs.readFileSync(file, "utf8");
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e < s) {
    text = `${text.replace(/\s*$/, "")}\n\n${block}\n`;
  } else {
    text = text.slice(0, s) + block + text.slice(e + end.length);
  }
  fs.writeFileSync(file, text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawBase = process.env.LLM_BASE_URL;
  if (!rawBase) throw new Error("LLM_BASE_URL is required");
  const baseUrl = rawBase.replace(/\/$/, "");
  const modelList = (args.models ?? process.env.EVAL_LLM_MODELS ?? process.env.LLM_MODEL ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!modelList.length) throw new Error("No models: set EVAL_LLM_MODELS or LLM_MODEL, or pass --models");

  let cases = JSON.parse(fs.readFileSync("eval/cases.json", "utf8")) as EvalCase[];
  if (args.only) cases = cases.filter((c) => c.lang === args.only);
  if (args.limit !== undefined && !Number.isNaN(args.limit)) cases = cases.slice(0, args.limit);

  const reports: ModelReport[] = [];
  fs.mkdirSync("eval/results", { recursive: true });

  for (const model of modelList) {
    const config: LlmConfig = { baseUrl, model, apiKey: process.env.LLM_API_KEY };
    const results: CaseResult[] = [];
    console.error(`Running ${cases.length} cases on ${model}`);
    for (const c of cases) {
      const input = { transcript: c.text, customers: c.customers, language: c.lang === "pcm" ? ("pcm" as const) : ("en" as const), today: c.today };
      try {
        const { entry, ms } = await extractEntry(config, input);
        const { ok, diffs } = score(c, entry);
        results.push({ id: c.id, lang: c.lang, ok, exact: FIELDS.every((f) => ok[f]), ms, error: null, diffs, predicted: entry });
      } catch (err) {
        const msg = err instanceof Error ? (err.cause instanceof Error ? `${err.message} (${err.cause.message})` : err.message) : String(err);
        const ok = Object.fromEntries(FIELDS.map((f) => [f, false])) as Record<Field, boolean>;
        results.push({ id: c.id, lang: c.lang, ok, exact: false, ms: null, error: msg.replace(/\s+/g, " ").slice(0, 160), diffs: [], predicted: null });
      }
    }
    const report = summarise(model, results);
    reports.push(report);
    const safe = model.replace(/[^a-zA-Z0-9._-]+/g, "_");
    fs.writeFileSync(
      path.join("eval/results", `extract-${safe}.json`),
      JSON.stringify({ date: new Date().toISOString(), baseUrlHost: new URL(baseUrl).host, ...report }, null, 2) + "\n",
    );
  }

  const filter = [args.only ? `only ${args.only}` : "", args.limit !== undefined ? `limit ${args.limit}` : ""].filter(Boolean).join(", ");
  const meta = { date: new Date().toISOString(), host: new URL(baseUrl).host, cases: cases.length, filter };
  writeSection("eval/results.md", "extract", renderMarkdown(reports, meta));

  // Compact stdout table.
  const cols = ["model", "exact", "type", "date", "cust", "total", "paid", "bal", "items", "flags", "med", "p90", "err"];
  const rows = reports.map((r) => [
    r.model, r.exactRate, r.fieldAcc.type, r.fieldAcc.occurredOn, r.fieldAcc.customerName, r.fieldAcc.total, r.fieldAcc.paid,
    r.fieldAcc.balance, r.fieldAcc.items, r.fieldAcc.flags, fmtMs(r.median), fmtMs(r.p90), String(r.errors),
  ]);
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(cols));
  for (const row of rows) console.log(line(row));
  console.log(`\nWrote eval/results.md and ${reports.length} JSON file(s) in eval/results/`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
