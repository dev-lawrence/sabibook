# Extraction eval

`eval/cases.json` holds 40 spoken-style transcripts (25 English, 10 Pidgin, 5 mixed with Yoruba, Hausa or Igbo words) with the ledger entry the pipeline should produce.

## Case format

```json
{
  "id": "en-02",
  "lang": "en",
  "today": "2026-10-13",
  "customers": ["Mrs Adeyemi", "Chidi"],
  "text": "what the trader said",
  "expected": {
    "type": "sale",
    "occurredOn": "2026-10-13",
    "customerName": "Chidi",
    "total": 45000,
    "paid": 30000,
    "balance": 15000,
    "items": [{ "name": "palm oil", "qty": 10, "amount": 45000 }],
    "flags": []
  }
}
```

`lang` is `en`, `pcm` or `mixed` (mixed is sent to the model as English). `expected.flags` lists the codes the deterministic layer should raise on a perfect model output: `missing`, `items_mismatch`, `overpaid`, `credit_without_customer`, `amount_not_heard`. Clean cases have an empty list. Conventions follow the system prompt: paid in full when credit is not mentioned, item amount is the line total, `payment_received` has no items and `total = paid`, balance 0.

Hard cases: en-18 (no amount), en-19 and pcm-07 (credit sale, no name), en-20 (items do not add up), en-21 (payment, no name), en-22 (overpaid).

## Run

```
pnpm eval:extract
pnpm eval:extract --models gemma4:e4b,qwen3:8b --only pcm --limit 5
```

Needs `LLM_BASE_URL` (from `.env.local` or `.env`). Models come from `--models`, else `EVAL_LLM_MODELS` (comma separated), else `LLM_MODEL`.

Output: a table on stdout, the `extract` section of `eval/results.md`, and raw per-case JSON in `eval/results/extract-<model>.json`.

## Scoring

One pass/fail per field, plus an exact match (all eight fields right).

- `type`, `occurredOn`, `total`, `paid`, `balance`: exact equality; null only equals null.
- `customerName`: case-insensitive, trimmed.
- `items`: same count, and expected item amounts match predicted amounts (each used once, null matches null). Names and qty are not scored.
- `flags`: every expected code is raised, and no `credit_without_customer` or `items_mismatch` is raised that was not expected. Other extra codes are not penalised.

A call that throws counts as every field wrong and is recorded as an error. Latency (median and p90) covers successful calls only.
