"""NumOracle tests: tolerance clamp, numeric parsing/guards, full request→resolve→read_value flow."""


def test_clamp_tol(contract):
    c = contract.clamp_tol
    assert c(100) == 100
    assert c(0) == 1                 # below min
    assert c(99999) == 5000          # above max
    assert c("nope") == contract.DEFAULT_TOL_BPS
    assert c(250) == 250

def test_num_str(contract):
    n = contract._num_str
    assert n("1,234.5") == "1234.5"
    assert n(42) == "42"
    assert n(63250.5) == "63250.5"
    assert n(True) == ""             # bool rejected
    assert n("abc") == ""

def test_normalize_reading(contract):
    n = contract.normalize_reading
    r = n({"value": 63250.5, "unit": "USD", "note": "coinbase"})
    assert r["value"] == "63250.5" and r["unit"] == "USD"
    d = n({})
    assert d["value"] == "0" and d["note"] == "no note"     # conservative default

def test_validate_reading(contract):
    v = contract.validate_reading
    assert v({"value": "63250.5", "note": "ok"})
    assert not v({"value": "abc", "note": "ok"})    # not numeric
    assert not v({"value": "5", "note": "  "})      # empty note
    assert not v({"note": "x"})                      # missing value


def _new(contract):
    return contract, contract.NumOracle()

def test_request_resolve_flow(contract):
    mod, c = _new(contract)
    rid = c.request("BTC/USD spot price right now", "https://api.example/btc", 50)
    rq = c.get_request(rid)
    assert rq["state"] == "open" and rq["tolerance_bps"] == 50
    out = c.resolve(rid)
    assert "value" in out
    rv = c.read_value(rid)
    assert rv["resolved"] is True and float(rv["value"]) == 0.0   # offline default 0, flow intact
    st = c.stats()
    assert st["total_requests"] == 1 and st["resolved"] == 1

def test_cannot_double_resolve(contract):
    mod, c = _new(contract)
    rid = c.request("x", "", 100)
    c.resolve(rid)
    try:
        c.resolve(rid); assert False, "double resolve should fail"
    except Exception:
        pass
