// Speech eval: transcribes every clip in eval/audio and scores the words against
// a reference transcript. See eval/audio/README.md and eval/README.md.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { transcribe, type AsrConfig } from "../convex/model/asr";
import { LANGUAGES, type Language } from "../convex/model/languages";
import { extractSpokenNumbers } from "../convex/model/numbers";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

type ClipLang = Language | "mixed";
const CLIP_LANGS: ClipLang[] = ["en", "pcm", "yo", "ha", "ig", "mixed"];
const AUDIO_DIR = "eval/audio";
const AUDIO_EXT = [".webm", ".wav", ".mp3", ".m4a", ".ogg"];
const MIME: Record<string, string> = {
  ".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
};
const GEMMA_PROMPT = "Transcribe this audio exactly. Output only the words spoken.";

type Clip = { id: string; file: string; ext: string; lang: ClipLang; reference: string; speaker?: string; note?: string };
type ClipResult = {
  id: string;
  lang: ClipLang;
  reference: string;
  hypothesis: string | null;
  skipped: boolean;
  error: string | null;
  edits: number;
  refWords: number;
  wer: number | null;
  numbersOk: boolean | null;
  ms: number | null;
  audioMs: number | null;
};

function parseArgs(argv: string[]) {
  const out: { models?: string; limit?: number; only?: ClipLang } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--models") out.models = argv[++i];
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--only") {
      const v = argv[++i] as ClipLang;
      if (!CLIP_LANGS.includes(v)) throw new Error(`--only must be one of ${CLIP_LANGS.join(", ")}`);
      out.only = v;
    } else throw new Error(`Unknown flag ${a}`);
  }
  return out;
}

// ---------- metrics ----------

/** Lowercase, naira signs to a space, punctuation removed, whitespace collapsed. Digits stay as written. */
export function normaliseText(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[₦]/g, " ")
    .replace(/(\d),(?=\d{3})/g, "$1") // 45,000 -> 45000
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Word level Levenshtein distance (substitutions, insertions, deletions each cost 1). */
export function wordEdits(ref: string[], hyp: string[]): number {
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hyp.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[hyp.length];
}

export function wer(reference: string, hypothesis: string): number {
  const r = normaliseText(reference);
  const h = normaliseText(hypothesis);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  return wordEdits(r, h) / r.length;
}

const numberSet = (s: string) => [...new Set(extractSpokenNumbers(s))].sort((a, b) => a - b).join(",");
export const sameNumbers = (a: string, b: string) => numberSet(a) === numberSet(b);

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1))];
}
const fmtMs = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)}ms`);

/** Cheap duration: only for PCM wav files with a standard header. */
function wavDurationMs(buf: Buffer): number | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let byteRate = 0;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(pos + 16);
    if (id === "data") return byteRate ? Math.round((Math.min(size, buf.length - pos - 8) / byteRate) * 1000) : null;
    pos += 8 + size + (size % 2);
  }
  return null;
}

// ---------- clips ----------

function loadClips(): Clip[] {
  if (!fs.existsSync(AUDIO_DIR)) return [];
  const manifestPath = path.join(AUDIO_DIR, "manifest.json");
  const manifest: Record<string, { lang?: ClipLang; speaker?: string; note?: string }> = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};
  const clips: Clip[] = [];
  for (const name of fs.readdirSync(AUDIO_DIR).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!AUDIO_EXT.includes(ext)) continue;
    const id = path.basename(name, path.extname(name));
    const txt = path.join(AUDIO_DIR, `${id}.txt`);
    if (!fs.existsSync(txt)) {
      console.error(`Skipping ${name}: no ${id}.txt reference transcript`);
      continue;
    }
    const m = manifest[id] ?? {};
    const prefix = id.split("-")[0] as ClipLang;
    const lang = m.lang ?? (CLIP_LANGS.includes(prefix) ? prefix : undefined);
    if (!lang) {
      console.error(`Skipping ${name}: cannot tell the language (use an en-/pcm-/yo-/ha-/ig-/mixed- prefix or manifest.json)`);
      continue;
    }
    clips.push({ id, file: path.join(AUDIO_DIR, name), ext, lang, reference: fs.readFileSync(txt, "utf8").trim(), speaker: m.speaker, note: m.note });
  }
  return clips;
}

// ---------- candidates ----------

type Candidate = {
  name: string;
  kind: "speaches" | "gemma";
  supports: (lang: ClipLang) => boolean;
  run: (clip: Clip, audio: Buffer) => Promise<{ text: string; ms: number }>;
};

function errMsg(err: unknown) {
  const msg = err instanceof Error ? (err.cause instanceof Error ? `${err.message} (${err.cause.message})` : err.message) : String(err);
  return msg.replace(/\s+/g, " ").slice(0, 160);
}

function speachesCandidate(baseUrl: string, model: string): Candidate {
  const config: AsrConfig = { baseUrl, model, apiKey: process.env.ASR_API_KEY };
  const englishOnly = /distil/i.test(model);
  return {
    name: model,
    kind: "speaches",
    supports: (lang) => !englishOnly || lang === "en",
    run: (clip, audio) => {
      const code = clip.lang === "mixed" ? undefined : LANGUAGES[clip.lang].asrCode;
      return transcribe(config, new Blob([new Uint8Array(audio)], { type: MIME[clip.ext] }), {
        language: code,
        filename: path.basename(clip.file),
      });
    },
  };
}

function gemmaCandidate(baseUrl: string, model: string): Candidate {
  return {
    name: `${model} (Gemma native audio, experimental)`,
    kind: "gemma",
    supports: () => true,
    run: async (clip, audio) => {
      const started = performance.now();
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(process.env.GEMMA_AUDIO_API_KEY ? { Authorization: `Bearer ${process.env.GEMMA_AUDIO_API_KEY}` } : {}) },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: GEMMA_PROMPT },
                  { type: "input_audio", input_audio: { data: audio.toString("base64"), format: clip.ext.slice(1) } },
                ],
              },
            ],
          }),
        });
      } catch {
        throw new Error("could not reach the Gemma audio server");
      }
      if (!res.ok) throw new Error(`Gemma audio request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { text: (data.choices?.[0]?.message?.content ?? "").trim(), ms: Math.round(performance.now() - started) };
    },
  };
}

// ---------- reporting ----------

type ModelReport = {
  model: string;
  notRun: string | null;
  results: ClipResult[];
  wer: string;
  numbers: string;
  werByLang: Record<string, string>;
  median: number | null;
  p90: number | null;
  rtf: string;
  errors: number;
  scored: number;
};

function corpusWer(rs: ClipResult[]) {
  const ok = rs.filter((r) => r.wer !== null);
  const words = ok.reduce((s, r) => s + r.refWords, 0);
  return words === 0 ? "n/a" : pct(ok.reduce((s, r) => s + r.edits, 0), words);
}

function summarise(model: string, results: ClipResult[], notRun: string | null): ModelReport {
  const scored = results.filter((r) => r.wer !== null);
  const werByLang: Record<string, string> = {};
  for (const l of CLIP_LANGS) {
    const sub = results.filter((r) => r.lang === l);
    if (!sub.length) continue;
    werByLang[l] = sub.every((r) => r.skipped) ? "n/a" : `${corpusWer(sub)} (${sub.filter((r) => r.wer !== null).length}/${sub.length})`;
  }
  const ms = scored.map((r) => r.ms as number).sort((a, b) => a - b);
  const withDur = scored.filter((r) => r.audioMs);
  const rtf = withDur.length
    ? (withDur.reduce((s, r) => s + (r.ms as number), 0) / withDur.reduce((s, r) => s + (r.audioMs as number), 0)).toFixed(2)
    : "n/a";
  return {
    model,
    notRun,
    results,
    wer: corpusWer(results),
    numbers: pct(scored.filter((r) => r.numbersOk).length, scored.length),
    werByLang,
    median: quantile(ms, 0.5),
    p90: quantile(ms, 0.9),
    rtf,
    errors: results.filter((r) => r.error).length,
    scored: scored.length,
  };
}

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ");

function renderMarkdown(reports: ModelReport[], meta: { date: string; host: string; clips: number; filter: string }) {
  const L: string[] = [];
  L.push("## Speech eval", "");
  L.push(`- Date: ${meta.date}`, `- Server host: ${meta.host}`);
  L.push(`- Clips: ${meta.clips}${meta.filter ? ` (${meta.filter})` : ""}`, "");
  L.push("WER is total word edits over total reference words, lowercased with punctuation removed. Numbers correct is the share of scored clips where the set of amounts found by the app's number reader is the same in the reference and the hypothesis. RTF is processing time over audio length, only where the length is known (wav files).", "");
  const h = ["Model", "WER", "Numbers correct", "Clips scored", "Median", "p90", "RTF", "Errors"];
  L.push(`| ${h.join(" | ")} |`, `| ${h.map(() => "---").join(" | ")} |`);
  for (const r of reports) {
    if (r.notRun) L.push(`| ${cell(r.model)} | ${cell(r.notRun)} | | | | | | |`);
    else L.push(`| ${[cell(r.model), r.wer, r.numbers, r.scored, fmtMs(r.median), fmtMs(r.p90), r.rtf, r.errors].join(" | ")} |`);
  }
  L.push("");
  const present = CLIP_LANGS.filter((l) => reports.some((r) => r.werByLang[l]));
  if (present.length) {
    L.push("### WER by language", "");
    L.push(`| Model | ${present.join(" | ")} |`, `| --- | ${present.map(() => "---").join(" | ")} |`);
    for (const r of reports.filter((x) => !x.notRun)) L.push(`| ${cell(r.model)} | ${present.map((l) => r.werByLang[l] ?? "n/a").join(" | ")} |`);
    L.push("", "Cells show WER and (clips scored/clips of that language). n/a means the model was not run on that language.", "");
  }
  for (const r of reports.filter((x) => !x.notRun)) {
    const worst = r.results.filter((x) => x.wer !== null).sort((a, b) => (b.wer as number) - (a.wer as number)).slice(0, 5);
    L.push(`### Worst clips: ${cell(r.model)}`, "");
    if (!worst.length) L.push("No clip was transcribed.");
    for (const w of worst) {
      L.push(`- ${w.id} (WER ${pct(w.edits, w.refWords)})`, `  - reference: ${cell(w.reference)}`, `  - hypothesis: ${cell(w.hypothesis ?? "")}`);
    }
    const errs = r.results.filter((x) => x.error);
    if (errs.length) L.push("", `Errors (${errs.length}): ${errs.slice(0, 3).map((e) => `${e.id}: ${e.error}`).join("; ")}`);
    L.push("");
  }
  return L.join("\n");
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
  if (s === -1 || e === -1 || e < s) text = `${text.replace(/\s*$/, "")}\n\n${block}\n`;
  else text = text.slice(0, s) + block + text.slice(e + end.length);
  fs.writeFileSync(file, text);
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let clips = loadClips();
  if (!clips.length) {
    console.log("No audio clips found in eval/audio, so there is nothing to score yet.");
    console.log("Record a few sentences on your phone, save each as eval/audio/<id>.m4a (or webm, wav, mp3, ogg)");
    console.log("and write what you said in eval/audio/<id>.txt. Start ids with en-, pcm-, yo-, ha-, ig- or mixed-.");
    console.log("See eval/audio/README.md for details. Then run pnpm eval:asr again.");
    return;
  }
  if (args.only) clips = clips.filter((c) => c.lang === args.only);
  if (args.limit !== undefined && !Number.isNaN(args.limit)) clips = clips.slice(0, args.limit);
  if (!clips.length) {
    console.log("No clips match those filters.");
    return;
  }

  const rawBase = process.env.ASR_BASE_URL;
  const gemmaBase = process.env.GEMMA_AUDIO_BASE_URL?.replace(/\/$/, "");
  const gemmaModel = process.env.GEMMA_AUDIO_MODEL;
  if (!rawBase) throw new Error("ASR_BASE_URL is required");
  const baseUrl = rawBase.replace(/\/$/, "");

  const modelList = (args.models ?? process.env.EVAL_ASR_MODELS ?? "deepdml/faster-whisper-large-v3-turbo-ct2,Systran/faster-distil-whisper-large-v3")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!args.models && process.env.ASR_MODEL_NAIJA && !modelList.includes(process.env.ASR_MODEL_NAIJA)) modelList.push(process.env.ASR_MODEL_NAIJA);

  const candidates: Candidate[] = modelList.map((m) => speachesCandidate(baseUrl, m));
  let gemma: Candidate | null = null;
  if (gemmaBase && gemmaModel) {
    gemma = gemmaCandidate(gemmaBase, gemmaModel);
    candidates.push(gemma);
  }

  const reports: ModelReport[] = [];
  fs.mkdirSync("eval/results", { recursive: true });
  const audioCache = new Map<string, Buffer>();
  const audioOf = (c: Clip) => {
    let b = audioCache.get(c.file);
    if (!b) { b = fs.readFileSync(c.file); audioCache.set(c.file, b); }
    return b;
  };

  for (const cand of candidates) {
    console.error(`Running ${clips.length} clips on ${cand.name}`);
    const results: ClipResult[] = [];
    for (const clip of clips) {
      const base = { id: clip.id, lang: clip.lang, reference: clip.reference };
      if (!cand.supports(clip.lang)) {
        results.push({ ...base, hypothesis: null, skipped: true, error: null, edits: 0, refWords: 0, wer: null, numbersOk: null, ms: null, audioMs: null });
        continue;
      }
      try {
        const audio = audioOf(clip);
        const { text, ms } = await cand.run(clip, audio);
        const ref = normaliseText(clip.reference);
        const edits = wordEdits(ref, normaliseText(text));
        results.push({
          ...base, hypothesis: text, skipped: false, error: null, edits, refWords: ref.length,
          wer: ref.length ? edits / ref.length : text ? 1 : 0,
          numbersOk: sameNumbers(clip.reference, text), ms, audioMs: clip.ext === ".wav" ? wavDurationMs(audio) : null,
        });
      } catch (err) {
        results.push({ ...base, hypothesis: null, skipped: false, error: errMsg(err), edits: 0, refWords: 0, wer: null, numbersOk: null, ms: null, audioMs: null });
      }
    }
    const report = summarise(cand.name, results, null);
    reports.push(report);
    const safe = cand.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    fs.writeFileSync(
      path.join("eval/results", `asr-${safe}.json`),
      JSON.stringify({ date: new Date().toISOString(), baseUrlHost: new URL(cand.kind === "gemma" ? gemmaBase! : baseUrl).host, ...report }, null, 2) + "\n",
    );
  }
  if (!gemma) {
    reports.push(summarise("Gemma 4 E4B native audio (experimental)", [], "not run: set GEMMA_AUDIO_BASE_URL (and GEMMA_AUDIO_MODEL)"));
  }

  const filter = [args.only ? `only ${args.only}` : "", args.limit !== undefined ? `limit ${args.limit}` : ""].filter(Boolean).join(", ");
  const meta = { date: new Date().toISOString(), host: new URL(baseUrl).host, clips: clips.length, filter };
  writeSection("eval/results.md", "asr", renderMarkdown(reports, meta));

  const cols = ["model", "WER", "numbers", "scored", "med", "p90", "rtf", "err"];
  const rows = reports.map((r) =>
    r.notRun ? [r.model, "not run", "", "", "", "", "", ""] : [r.model, r.wer, r.numbers, String(r.scored), fmtMs(r.median), fmtMs(r.p90), r.rtf, String(r.errors)],
  );
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(cols));
  for (const row of rows) console.log(line(row));
  for (const r of reports) if (r.notRun) console.log(`\n${r.model}: ${r.notRun}`);
  console.log(`\nWrote eval/results.md and ${candidates.length} JSON file(s) in eval/results/`);
}

// Only run when executed directly, so the metric functions can be imported in checks.
if (process.argv[1] && /eval-asr\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
