# NumOracle

**A numeric oracle that agrees on a VALUE within a tolerance band, by GenLayer consensus.**

[![GenLayer](https://img.shields.io/badge/GenLayer-Bradbury-ff4d6d)](https://genlayer.com) [![chainId](https://img.shields.io/badge/chainId-4221-4dd0e1)](https://docs.genlayer.com) [![contract](https://img.shields.io/badge/contract-Python%20GenVM-8a63d2)](https://docs.genlayer.com) [![tests](https://img.shields.io/badge/tests-6%2F6%20passing-3fb950)](tests) [![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20genlayer--js-22a6f2)](app) [![live](https://img.shields.io/badge/live-numoracle.pages.dev-f59e0b)](https://numoracle.pages.dev) [![License](https://img.shields.io/badge/license-MIT-2dd4bf)](LICENSE)

Request a numeric fact (a price, a temperature, a statistic) with evidence sources and a tolerance in
basis points. `resolve` has every validator independently fetch the sources and read off the number;
the result settles only when the validators' numbers agree to **within the requested tolerance**
(comparative equivalence on the numeric value — a closeness test, not a string match). Consumer
contracts read the settled number via `read_value`.

The verb is **"agree on a number within tolerance"** — distinct from a boolean verdict; the validator
check is numeric closeness.

- **Live demo:** https://numoracle.pages.dev
- **Contract (Bradbury, chain 4221):** `0x8004CC0081817bdF0824D3fCfBD806a0572d44e8`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x8004CC0081817bdF0824D3fCfBD806a0572d44e8

---

## Why GenLayer is essential

A single price feed is a single point of trust/failure. GenLayer has many validators independently
fetch and read the number, accepting it only when they **converge within tolerance** — a decentralized,
tamper-resistant numeric feed a bare EVM can't produce (no web access, no fuzzy agreement).

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Request | `request(question, sources, tolerance_bps)` | Posts a numeric query + allowed spread. |
| Resolve | `resolve(id)` | Validators fetch + agree on a value within tolerance. |
| Read | `read_value(id)` / `get_request(id)` / `stats()` | Settled number + unit for consumers. |

### Correctness check

`_read` wraps `fetch_and_read` in **`gl.eq_principle.prompt_comparative`** with a principle that
interpolates the request's tolerance: *"the numeric 'value' fields must agree within X% — treat as
equivalent when the relative difference is at most X%."* `validate_reading` requires a float-parseable
value + non-empty note; `normalize_reading` cleans thousands separators and defaults the undeterminable
case conservatively. `clamp_tol` bounds tolerance to 1–5000 bps. Unit-tested incl. full request→resolve→read.

## Architecture

```
NumOracle/
├── contracts/num_oracle.py  ← GenLayer Intelligent Contract (numeric consensus within tolerance)
├── tests/                   ← pytest: clamp_tol, numeric parsing, reading guards, resolve flow
└── app/                     ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                               cyan data-feed theme, big settled-number cards + tolerance bands
```

## Tests

```bash
cd NumOracle
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `clamp_tol`, `_num_str`, `normalize_reading` / `validate_reading`, and a full **request → resolve →
read_value** integration run (shim auto-inits `TreeMap`). **On-chain smoke-tested:** `request` write +
`get_request` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/num_oracle.py
```
