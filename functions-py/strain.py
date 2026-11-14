"""STRAIN 0–21 — bản Python của functions/strain.js, cho khách dùng Garmin (máy chủ functions-py).

PHẢI ra CÙNG SỐ với strain.js: strain của khách Garmin và của coach (Polar) nằm trên một thang. Mọi hằng số và
cách làm tròn chép nguyên; tests/worklist.test.js chạy hai bản trên cùng dữ liệu và so từng con số. Đổi công thức
ở một bên mà không đổi bên kia là test hỏng — cố ý. Chú thích đầy đủ về vì sao chọn từng bước: functions/strain.js.
"""
import math

B_MALE = 1.92
B_FEMALE = 1.67
STRAIN_MAX = 21
K = 83
P = 3
MAX_GAP_SEC = 600
ZONE_FLOOR = [0.5, 0.6, 0.7, 0.8, 0.9]
STRAIN_BANDS = [
    {"max": 7, "key": "thap", "label": "Thấp"},
    {"max": 10, "key": "vua", "label": "Vừa"},
    {"max": 14, "key": "kha_cao", "label": "Khá cao"},
    {"max": 18, "key": "cao", "label": "Cao"},
    {"max": 21, "key": "rat_cao", "label": "Rất cao"},
]


def js_round(x: float) -> int:
    """Math.round của JS: .5 làm tròn LÊN (Python round() làm tròn về số chẵn — sẽ lệch 1 ở biên)."""
    return math.floor(x + 0.5)


def r2(x: float) -> float:
    return js_round(x * 100) / 100


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def strain_band(v):
    if not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    return next((b for b in STRAIN_BANDS if v <= b["max"]), STRAIN_BANDS[-1])


def intensity(hr, rhr, hr_max):
    span = hr_max - rhr
    if not span > 0:
        return None
    return max(0.0, min(1.0, (hr - rhr) / span))


def resolve_hr_max(manual=None, observed=None, birthdate=None, today=None) -> dict:
    """Nhịp tim tối đa: đo thật > cao nhất đã ghi (nếu gần ước theo tuổi) > Tanaka 208 − 0.7 × tuổi."""
    man = _num(manual)
    if man is not None and man > 100:
        return {"hrMax": js_round(man), "source": "đo thật"}
    age = tanaka = None
    if birthdate and today:
        try:
            by, bm, bd = (int(x) for x in str(birthdate)[:10].split("-"))
            ty, tm, td = (int(x) for x in str(today)[:10].split("-"))
            import datetime as _dt
            age = ((_dt.date(ty, tm, td) - _dt.date(by, bm, bd)).days * 864e5) / (365.25 * 864e5)
            if 5 < age < 100:
                tanaka = 208 - 0.7 * age
        except (ValueError, TypeError):
            age = None
    obs = _num(observed)
    if obs is not None and obs > 100 and (tanaka is None or obs >= tanaka - 5):
        return {"hrMax": js_round(obs), "source": "cao nhất đã ghi được"}
    if tanaka is not None:
        return {"hrMax": js_round(tanaka), "source": "ước theo tuổi (Tanaka)", "age": js_round(age * 10) / 10}
    if obs is not None and obs > 100:
        return {"hrMax": js_round(obs), "source": "cao nhất đã ghi được"}
    return {"hrMax": None, "source": "không đủ dữ liệu"}


def raw_load(samples, ctx):
    rhr, hr_max = _num((ctx or {}).get("rhr")), _num((ctx or {}).get("hrMax"))
    if not isinstance(samples, list) or len(samples) < 2:
        return None
    if rhr is None or hr_max is None or hr_max - rhr <= 0:
        return None
    b = B_FEMALE if (ctx or {}).get("sex") == "female" else B_MALE
    pts = []
    for s in samples:
        hr = _num((s or {}).get("hr"))
        if hr is None or hr <= 0:
            continue
        pts.append({"at": _num(s.get("at")), "hr": hr})
    if all(p["at"] is not None for p in pts):
        pts.sort(key=lambda p: p["at"])
    if len(pts) < 2:
        return None
    fallback = _num((ctx or {}).get("fallbackStepSec")) or 1
    zone = [0.0] * 5
    load = sec = tot = 0.0
    peak = 0.0
    for i, cur in enumerate(pts):
        nxt = pts[i + 1] if i + 1 < len(pts) else None
        dt = fallback
        if cur["at"] is not None and nxt and nxt["at"] is not None:
            dt = nxt["at"] - cur["at"]
        if not dt > 0:
            dt = fallback
        dt = min(dt, MAX_GAP_SEC)
        i_n = intensity(cur["hr"], rhr, hr_max)
        if i_n is None:
            continue
        load += (dt / 60) * (i_n ** P) * math.exp(b * i_n)
        sec += dt
        tot += cur["hr"] * dt
        peak = max(peak, cur["hr"])
        for z in range(len(ZONE_FLOOR) - 1, -1, -1):
            if i_n >= ZONE_FLOOR[z]:
                zone[z] += dt
                break
    if not sec > 0:
        return None
    return {"load": r2(load), "sec": js_round(sec), "hrAvg": js_round(tot / sec), "hrMax": peak or None,
            "zoneSec": [js_round(v) for v in zone], "samples": len(pts)}


def to_strain(load):
    t = _num(load)
    if t is None or t < 0:
        return None
    return js_round(STRAIN_MAX * (1 - math.exp(-t / K)) * 10) / 10


def workout_strain(samples, ctx):
    r = raw_load(samples, ctx)
    if not r:
        return None
    s = to_strain(r["load"])
    return {**r, "strain": s, "band": strain_band(s)}


def daily_strain(series, ctx):
    parts = [p for p in (raw_load(s, ctx) for s in (series or [])) if p]
    if not parts:
        return None
    total = sum(p["load"] for p in parts)
    zone = [0] * 5
    sec = peak = wsum = 0
    for p in parts:
        zone = [a + b for a, b in zip(zone, p["zoneSec"])]
        sec += p["sec"]
        wsum += p["hrAvg"] * p["sec"]
        peak = max(peak, p["hrMax"] or 0)
    s = to_strain(total)
    return {"load": r2(total), "strain": s, "band": strain_band(s), "sec": sec,
            "hrAvg": js_round(wsum / sec) if sec else None, "hrMax": peak or None, "zoneSec": zone, "parts": len(parts)}
