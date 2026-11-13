"""Lõi đồng bộ Garmin dùng CHUNG cho hàm nền (functions-py/main.py) và script trên Mac (scripts/garmin/sync.py).

Đọc: health_day() (ngủ, HRV, RHR, Body Battery, stress, readiness, bước) · workout() (một buổi tập).
Ghi: write_firestore() — trường `garmin` RIÊNG trong activity/{ngày} và recovery/{ngày}, + clients/{id}.garminSync.
KHÔNG đụng trường của Polar. Endpoint hỏng / đồng hồ không đo → null, không đoán số.
"""
import sys
from datetime import datetime, timezone

LAP_SPORTS = ("running", "trail_running", "treadmill_running", "track_running", "cycling", "indoor_cycling", "road_biking")


def g(d, *path, default=None):
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
        print(f"   ! {getattr(fn, '__name__', 'call')}{a}: {type(e).__name__}: {str(e)[:120]}", file=sys.stderr)
        return None


def num(v, nd=None):
    return (round(v, nd) if nd is not None else v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def health_day(api, d: str) -> dict:
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
            "total": s.get("sleepTimeSeconds"), "deep": s.get("deepSleepSeconds"), "light": s.get("lightSleepSeconds"),
            "rem": s.get("remSleepSeconds"), "awake": s.get("awakeSleepSeconds"),
            "score": g(s, "sleepScores", "overall", "value"),
            "start": s.get("sleepStartTimestampGMT"), "end": s.get("sleepEndTimestampGMT"),
        } if s.get("sleepTimeSeconds") else None,
        "hrv": {
            "lastNight": hs.get("lastNightAvg"), "weekly": hs.get("weeklyAvg"), "status": hs.get("status"),
            "baselineLow": g(hs, "baseline", "balancedLow"), "baselineHigh": g(hs, "baseline", "balancedUpper"),
        } if hs else None,
        "rhr": st.get("restingHeartRate") or sleep.get("restingHeartRate"),
        "bodyBattery": {
            "high": st.get("bodyBatteryHighestValue"), "low": st.get("bodyBatteryLowestValue"),
            "latest": st.get("bodyBatteryMostRecentValue"), "charged": st.get("bodyBatteryChargedValue"),
            "drained": st.get("bodyBatteryDrainedValue"),
        } if st.get("bodyBatteryHighestValue") is not None else None,
        "stressAvg": st.get("averageStressLevel"),
        "readiness": {"score": tr0.get("score"), "level": tr0.get("level"), "feedback": tr0.get("feedbackShort")} if tr0 else None,
        "steps": st.get("totalSteps"),
        "calories": st.get("totalKilocalories"),
        "activeCalories": st.get("activeKilocalories"),
        "intensityMin": (st.get("moderateIntensityMinutes") or 0) + 2 * (st.get("vigorousIntensityMinutes") or 0) if st else None,
    }


def zones_of(api, a: dict, ask: bool):
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


def laps_of(api, a: dict):
    r = safe(api.get_activity_splits, a["activityId"]) or {}
    laps = [{"distM": num(l.get("distance"), 1), "sec": num(l.get("duration"), 1),
             "hrAvg": num(l.get("averageHR")), "speed": num(l.get("averageSpeed"), 3)} for l in (r.get("lapDTOs") or [])[:60]]
    return laps or None


def workout(api, a: dict, recent: bool) -> dict:
    sport = g(a, "activityType", "typeKey")
    return {
        "id": str(a.get("activityId") or ""), "at": a.get("startTimeLocal"), "name": a.get("activityName"), "sport": sport,
        "sec": num(a.get("duration"), 0), "distM": num(a.get("distance"), 1), "speed": num(a.get("averageSpeed"), 3),
        "calories": num(a.get("calories"), 0), "hrAvg": num(a.get("averageHR"), 0), "hrMax": num(a.get("maxHR"), 0),
        "load": num(a.get("activityTrainingLoad"), 0),
        "teAer": num(a.get("aerobicTrainingEffect"), 1), "teAna": num(a.get("anaerobicTrainingEffect"), 1),
        "zones": zones_of(api, a, recent),
        "laps": laps_of(api, a) if recent and sport in LAP_SPORTS and a.get("activityId") else None,
    }


def write_firestore(db, client_id: str, days: list, workouts) -> int:
    """Ghi lên Firestore (Admin SDK). workouts=None nghĩa là KÉO BUỔI TẬP HỎNG → không đụng workouts cũ.

    Cùng dạng với scripts/garmin/write.js: activity/{d}.garmin = {bước…, workouts[], at}; recovery/{d}.garmin.
    """
    at = datetime.now(timezone.utc).isoformat()
    c = db.collection("clients").document(client_id)
    by = {}
    for d in days or []:
        s = by.setdefault(d["date"], {"rec": None, "act": {}, "w": []})
        if d.get("sleep") or d.get("hrv") or d.get("rhr") or d.get("bodyBattery") or d.get("readiness"):
            s["rec"] = {k: d.get(k) for k in ("sleep", "hrv", "rhr", "bodyBattery", "stressAvg", "readiness")} | {"at": at}
        if d.get("steps") is not None:
            s["act"] = {k: d.get(k) for k in ("steps", "calories", "activeCalories", "intensityMin")}
    for w in workouts or []:
        day = str(w.get("at") or "")[:10]
        if len(day) == 10:
            by.setdefault(day, {"rec": None, "act": {}, "w": []})["w"].append(w)
    ops = []
    for day, s in sorted(by.items()):
        if s["rec"]:
            ops.append((c.collection("recovery").document(day), {"date": day, "garmin": s["rec"]}))
        if s["act"] or s["w"] or workouts is not None:
            g_ = dict(s["act"])
            if workouts is not None:
                g_["workouts"] = s["w"]
            g_["at"] = at
            ops.append((c.collection("activity").document(day), {"date": day, "garmin": g_}))
    for i in range(0, len(ops), 400):
        b = db.batch()
        for ref, data in ops[i:i + 400]:
            b.set(ref, data, merge=True)
        b.commit()
    dates = sorted(by)
    c.set({"garminSync": {"at": at, "workouts": len(workouts or []), "from": dates[0] if dates else None,
                          "to": dates[-1] if dates else None, "by": "server"}}, merge=True)
    return len(ops)
