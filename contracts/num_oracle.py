# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
NumOracle — a numeric oracle that agrees on a VALUE within a tolerance band.

Request a numeric fact (a price, a temperature, a statistic) with evidence
sources and a tolerance (in basis points). `resolve` has every validator
independently fetch the sources and read off the number; the result is accepted
only when the validators' numbers agree to within the requested tolerance
(comparative equivalence on the numeric value — not on the JSON shape). Consumer
contracts read the settled number via `read_value`.

The verb is "agree on a number within tolerance" — distinct from a boolean
verdict; the validator check is a numeric closeness test, not a string match.
"""
import json
from genlayer import *

DEFAULT_TOL_BPS = 100      # 1%
MIN_TOL_BPS = 1
MAX_TOL_BPS = 5000         # 50%


def clamp_tol(bps) -> int:
    if not isinstance(bps, int) or isinstance(bps, bool):
        try:
            bps = int(bps)
        except Exception:
            bps = DEFAULT_TOL_BPS
    return max(MIN_TOL_BPS, min(MAX_TOL_BPS, bps))


def _num_str(v) -> str:
    if isinstance(v, bool):
        return ""
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v).strip().replace(",", "")
    try:
        float(s)
        return s
    except Exception:
        return ""


def normalize_reading(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    val = _num_str(raw.get("value"))
    if val == "":
        val = "0"                 # conservative default; closeness is enforced by the principle
    unit = raw.get("unit")
    unit = str(unit)[:40] if isinstance(unit, str) else ""
    note = raw.get("note")
    note = note[:400] if isinstance(note, str) and note.strip() else "no note"
    return {"value": val, "unit": unit, "note": note}


def validate_reading(data) -> bool:
    if not isinstance(data, dict):
        return False
    try:
        float(data.get("value"))
    except Exception:
        return False
    n = data.get("note")
    return isinstance(n, str) and bool(n.strip())


class NumOracle(gl.Contract):
    requests: TreeMap[str, str]
    request_count: u256
    resolved_count: u256

    def __init__(self):
        self.request_count = u256(0)
        self.resolved_count = u256(0)

    @gl.public.write
    def request(self, question: str, sources: str, tolerance_bps: int) -> str:
        question = str(question).strip()
        sources = str(sources).strip()
        if not question:
            raise Exception("question required")
        tol = clamp_tol(tolerance_bps)
        key = str(int(self.request_count))
        rec = {
            "requester": str(gl.message.sender_address),
            "question": question[:300],
            "sources": sources[:600],
            "tolerance_bps": tol,
            "state": "open",          # open -> resolved
            "value": "",
            "unit": "",
            "note": "",
        }
        self.requests[key] = json.dumps(rec)
        self.request_count += u256(1)
        return key

    @gl.public.write
    def resolve(self, request_id: str) -> dict:
        request_id = str(request_id)
        if request_id not in self.requests:
            raise Exception("unknown request")
        r = json.loads(self.requests[request_id])
        if r["state"] != "open":
            raise Exception("already resolved")

        reading = self._read(r["question"], r["sources"], int(r["tolerance_bps"]))
        r["value"] = reading["value"]
        r["unit"] = reading["unit"]
        r["note"] = reading["note"]
        r["state"] = "resolved"
        self.requests[request_id] = json.dumps(r)
        self.resolved_count += u256(1)
        return {"request": request_id, "value": reading["value"], "unit": reading["unit"]}

    def _read(self, question: str, sources: str, tol_bps: int) -> dict:
        urls = [u.strip() for u in sources.replace(",", " ").split() if u.strip().startswith("http")][:3]
        tol_pct = tol_bps / 100.0

        def fetch_and_read() -> str:
            evidence = ""
            for u in urls:
                try:
                    evidence += f"\n--- {u} ---\n" + gl.nondet.web.get(u).body.decode("utf-8")[:2500]
                except Exception:
                    try:
                        evidence += f"\n--- {u} ---\n" + gl.nondet.web.render(u, mode="text")[:2500]
                    except Exception:
                        evidence += f"\n--- {u} (fetch failed) ---\n"
            if not evidence:
                evidence = "(no fetchable sources)"
            prompt = f"""You are a numeric oracle. Read the single numeric answer to the question from the evidence.

QUESTION: {question}

EVIDENCE (fetched now):
{evidence[:6000]}

Return the number only (no thousands separators), its unit, and a short note.
Reply ONLY JSON: {{"value": <number>, "unit": "<unit>", "note": "<source/short reason>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_reading(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_read,
            principle=(
                f"The numeric 'value' fields must agree within {tol_pct}% — treat readings as equivalent "
                f"when their relative difference is at most {tol_pct}%. Units must match; notes may differ."
            ),
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_reading(data):
            data = normalize_reading(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def read_value(self, request_id: str) -> dict:
        """Consumer contracts read the settled number here."""
        request_id = str(request_id)
        if request_id not in self.requests:
            return {"exists": False, "resolved": False}
        r = json.loads(self.requests[request_id])
        return {"exists": True, "resolved": r["state"] == "resolved", "value": r["value"], "unit": r["unit"]}

    @gl.public.view
    def get_request(self, request_id: str) -> dict:
        request_id = str(request_id)
        if request_id not in self.requests:
            return {"exists": False}
        r = json.loads(self.requests[request_id])
        r["exists"] = True
        return r

    @gl.public.view
    def stats(self) -> dict:
        return {"total_requests": int(self.request_count), "resolved": int(self.resolved_count)}
