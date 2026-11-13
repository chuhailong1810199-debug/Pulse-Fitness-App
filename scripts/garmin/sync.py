"""Kéo dữ liệu Garmin của CHÍNH coach về một file JSON (chưa ghi Firestore).

    scripts/garmin/.venv/bin/python scripts/garmin/sync.py                    # sức khoẻ 14 ngày + buổi tập 365 ngày
    scripts/garmin/.venv/bin/python scripts/garmin/sync.py --days 30 --history-days 1825

Cần chạy login.py trước. Kết quả: scripts/garmin/out/garmin-latest.json (gitignore). Bước ghi lên
app là scripts/garmin/write.js (mặc định chạy thử, --write mới ghi).

- Sức khoẻ theo ngày (ngủ, HRV, RHR, Body Battery, stress, readiness, bước): vài lần gọi MỖI ngày → --days.
- Buổi tập (tab Work list): MỘT lần gọi cho cả khoảng --history-days; phút ở từng vùng nhịp tim lấy
  từ bản tóm tắt, thiếu thì hỏi riêng; lap chỉ kéo cho buổi chạy / đạp trong 60 ngày gần nhất.
Endpoint nào hỏng / đồng hồ không đo thì để null, không đoán số.
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
LAP_SPORTS = ("running", "trail_running", "treadmill_running", "track_running", "cycling", "indoor_cycling", "road_biking")


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


def num(v, nd=None):
    return (round(v, nd) if nd is not None else v) if isinstance(v, (int, float)) else None


def health_day(api: Garmin, d: str) -> dict:
    sleep = safe(api.get_sleep_data, d) or {}
    s = sleep.get("dailySleepDTO") or {}
    hrv = safe(api.get_hrv_data, d) or {}
    hs = hrv.get("hrvSummary") or {}
    st = safe(api.get_stats, d) or {}
    tr = safe(api.get_training_readiness, d) or []
    tr0 = tr[0] if isinstance(tr, list) and tr else (tr if isinstance(tr, dict) else {})
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
    }


def zones_of(api: Garmin, a: dict, ask: bool):
    z = [a.get(f"hrTimeInZone_{i}") for i in range(1, 6)]
    if any(isinstance(x, (int, float)) for x in z):
        return [round(x) if isinstance(x, (int, float)) else 0 for x in z]
    if not ask or not a.get("activityId"):
        return None
    r = safe(api.get_activity_hr_in_timezones, a["activityId"]) or []
    if not isinstance(r, list) or not r:
        return None
    out = [0] * 5
    for row in r:
        n = row.get("zoneNumber")
        if isinstance(n, int) and 1 <= n <= 5:
            out[n - 1] = round(row.get("secsInZone") or 0)
    return out


def laps_of(api: Garmin, a: dict):
    r = safe(api.get_activity_splits, a["activityId"]) or {}
    laps = []
    for l in (r.get("lapDTOs") or [])[:60]:
        laps.append({"distM": num(l.get("distance"), 1), "sec": num(l.get("duration"), 1),
                     "hrAvg": num(l.get("averageHR")), "speed": num(l.get("averageSpeed"), 3)})
    return laps or None


def workout(api: Garmin, a: dict, recent: bool) -> dict:
    sport = g(a, "activityType", "typeKey")
    return {
        "id": str(a.get("activityId") or ""),
        "at": a.get("startTimeLocal"),
        "name": a.get("activityName"),
        "sport": sport,
        "sec": num(a.get("duration"), 0),
        "distM": num(a.get("distance"), 1),
        "speed": num(a.get("averageSpeed"), 3),             # m/s → pace ở phía app
        "calories": num(a.get("calories"), 0),
        "hrAvg": num(a.get("averageHR"), 0),
        "hrMax": num(a.get("maxHR"), 0),
        "load": num(a.get("activityTrainingLoad"), 0),
        "teAer": num(a.get("aerobicTrainingEffect"), 1),
        "teAna": num(a.get("anaerobicTrainingEffect"), 1),
        "zones": zones_of(api, a, recent),                  # giây ở Z1..Z5
        "laps": laps_of(api, a) if recent and sport in LAP_SPORTS and a.get("activityId") else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14, help="số ngày sức khoẻ (ngủ, HRV…)")
    ap.add_argument("--history-days", type=int, default=365, help="số ngày lịch sử buổi tập")
    a = ap.parse_args()
    store = Path(TOKENSTORE).expanduser()
    if not store.exists():
        print("Chưa đăng nhập — chạy scripts/garmin/login.py trước.", file=sys.stderr)
        return 1
    api = Garmin()
    api.login(str(store))
    today = date.today()

    days = []
    for i in range(max(1, min(a.days, 90)) - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        r = health_day(api, d)
        days.append(r)
        sl = r["sleep"] or {}
        print(f"{d}  ngủ {round((sl.get('total') or 0) / 3600, 1)}h  HRV {(r['hrv'] or {}).get('lastNight')}  "
              f"RHR {r['rhr']}  BB {(r['bodyBattery'] or {}).get('high')}  bước {r['steps']}")
        time.sleep(0.3)  # nhẹ tay với máy chủ Garmin

    start = (today - timedelta(days=max(1, min(a.history_days, 3650)))).isoformat()
    acts = safe(api.get_activities_by_date, start, today.isoformat()) or []
    cut = (today - timedelta(days=60)).isoformat()
    workouts = []
    for x in acts if isinstance(acts, list) else []:
        recent = str(x.get("startTimeLocal") or "")[:10] >= cut
        workouts.append(workout(api, x, recent))
        if recent:
            time.sleep(0.3)
    workouts.sort(key=lambda w: str(w.get("at") or ""))
    print(f"Buổi tập từ {start}: {len(workouts)}")
    for w in workouts[-8:]:
        print(f"  {str(w['at'])[:16]}  {w['sport']:<18} {w['name'] or '':<30.30} {round((w['sec'] or 0) / 60)}′  "
              f"HR {w['hrAvg']}  load {w['load']}")

    OUT.mkdir(exist_ok=True)
    f = OUT / "garmin-latest.json"
    f.write_text(json.dumps({"fetchedAt": int(time.time()), "days": days, "workouts": workouts},
                            ensure_ascii=False, indent=1))
    print(f"✓ {len(days)} ngày sức khoẻ + {len(workouts)} buổi tập → {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
