"""Kéo dữ liệu Garmin của CHÍNH coach về một file JSON (chưa ghi Firestore).

    scripts/garmin/.venv/bin/python scripts/garmin/sync.py            # 7 ngày gần nhất
    scripts/garmin/.venv/bin/python scripts/garmin/sync.py --days 30

Cần chạy login.py trước. Kết quả: scripts/garmin/out/garmin-latest.json (gitignore). Bước ghi lên
app là scripts/garmin/write.js (mặc định chạy thử, --write mới ghi).

Mỗi ngày gọi vài endpoint; endpoint nào hỏng / đồng hồ không đo thì để null, không đoán số.
"""
import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin

TOKENSTORE = os.getenv("GARMINTOKENS", str(Path.home() / ".garminconnect"))
OUT = Path(__file__).resolve().parent / "out"


def g(d, *path, default=None):
    """Đi sâu vào dict an toàn: g(x, 'a', 'b') = x['a']['b'] hoặc default."""
    for k in path:
        if isinstance(d, dict):
            d = d.get(k)
        elif isinstance(d, list) and isinstance(k, int) and -len(d) <= k < len(d):
            d = d[k]
        else:
            return default
        if d is None:
            return default
    return d


def safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:  # noqa: BLE001
        print(f"   ! {fn.__name__}{a}: {type(e).__name__}: {str(e)[:120]}", file=sys.stderr)
        return None


def day(api: Garmin, d: str) -> dict:
    sleep = safe(api.get_sleep_data, d) or {}
    s = sleep.get("dailySleepDTO") or {}
    hrv = safe(api.get_hrv_data, d) or {}
    hs = hrv.get("hrvSummary") or {}
    st = safe(api.get_stats, d) or {}
    tr = safe(api.get_training_readiness, d) or []
    tr0 = tr[0] if isinstance(tr, list) and tr else (tr if isinstance(tr, dict) else {})
    acts = safe(api.get_activities_by_date, d, d) or []
    return {
        "date": d,
        "sleep": {
            "total": s.get("sleepTimeSeconds"),          # giây — cùng đơn vị với Polar
            "deep": s.get("deepSleepSeconds"),
            "light": s.get("lightSleepSeconds"),
            "rem": s.get("remSleepSeconds"),
            "awake": s.get("awakeSleepSeconds"),
            "score": g(s, "sleepScores", "overall", "value"),
            "start": s.get("sleepStartTimestampGMT"),
            "end": s.get("sleepEndTimestampGMT"),
        } if s else None,
        "hrv": {
            "lastNight": hs.get("lastNightAvg"),           # ms (RMSSD) — cùng đơn vị Polar
            "weekly": hs.get("weeklyAvg"),
            "status": hs.get("status"),
            "baselineLow": g(hs, "baseline", "balancedLow"),
            "baselineHigh": g(hs, "baseline", "balancedUpper"),
        } if hs else None,
        "rhr": st.get("restingHeartRate") or sleep.get("restingHeartRate"),
        "bodyBattery": {
            "high": st.get("bodyBatteryHighestValue"),
            "low": st.get("bodyBatteryLowestValue"),
            "latest": st.get("bodyBatteryMostRecentValue"),
            "charged": st.get("bodyBatteryChargedValue"),
            "drained": st.get("bodyBatteryDrainedValue"),
        } if st else None,
        "stressAvg": st.get("averageStressLevel"),
        "readiness": {
            "score": tr0.get("score"),
            "level": tr0.get("level"),
            "feedback": tr0.get("feedbackShort"),
        } if tr0 else None,
        "steps": st.get("totalSteps"),
        "calories": st.get("totalKilocalories"),
        "activeCalories": st.get("activeKilocalories"),
        "intensityMin": (st.get("moderateIntensityMinutes") or 0) + 2 * (st.get("vigorousIntensityMinutes") or 0)
        if st else None,
        "workouts": [{
            "at": a.get("startTimeLocal"),
            "name": a.get("activityName"),
            "sport": g(a, "activityType", "typeKey"),
            "sec": round(a["duration"]) if isinstance(a.get("duration"), (int, float)) else None,
            "calories": a.get("calories"),
            "hrAvg": a.get("averageHR"),
            "hrMax": a.get("maxHR"),
            "load": a.get("activityTrainingLoad"),
        } for a in (acts if isinstance(acts, list) else [])],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    a = ap.parse_args()
    store = Path(TOKENSTORE).expanduser()
    if not store.exists():
        print("Chưa đăng nhập — chạy scripts/garmin/login.py trước.", file=sys.stderr)
        return 1
    api = Garmin()
    api.login(str(store))
    today = date.today()
    out = []
    for i in range(max(1, min(a.days, 60)) - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        r = day(api, d)
        out.append(r)
        sl = r["sleep"] or {}
        print(f"{d}  ngủ {round((sl.get('total') or 0) / 3600, 1)}h  điểm {sl.get('score')}  "
              f"HRV {(r['hrv'] or {}).get('lastNight')}  RHR {r['rhr']}  "
              f"BB {(r['bodyBattery'] or {}).get('high')}  bước {r['steps']}  buổi tập {len(r['workouts'])}")
        time.sleep(0.4)  # nhẹ tay với máy chủ Garmin
    OUT.mkdir(exist_ok=True)
    f = OUT / "garmin-latest.json"
    f.write_text(json.dumps({"fetchedAt": int(time.time()), "days": out}, ensure_ascii=False, indent=1))
    print(f"✓ {len(out)} ngày → {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
