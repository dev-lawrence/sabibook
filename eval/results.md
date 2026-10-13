# Eval results

<!-- extract:start -->
## Extraction eval

- Date: 2026-10-13T22:58:25.748Z
- Endpoint host: localhost:11434
- Models: gemma4:e4b
- Cases: 40

| Model | type | occurredOn | customerName | total | paid | balance | items | flags | exact | en | pcm | mixed | median | p90 | errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemma4:e4b | 100.0% | 97.5% | 100.0% | 97.5% | 90.0% | 95.0% | 100.0% | 92.5% | 87.5% | 84.0% (21/25) | 100.0% (10/10) | 80.0% (4/5) | 2506ms | 10002ms | 0 |

### Failing cases: gemma4:e4b (5/40)

- en-14: paid 0 vs null; balance 36000 vs null; flags missing missing
- en-18: paid 0 vs null
- en-20: total 80000 vs 60000; paid 80000 vs 60000; flags missing items_mismatch
- en-22: paid 12000 vs 15000; balance 0 vs -3000; flags missing overpaid
- mix-01: date 2026-10-13 vs 2026-10-12

<!-- extract:end -->

<!-- asr:start --><!-- asr:end -->
