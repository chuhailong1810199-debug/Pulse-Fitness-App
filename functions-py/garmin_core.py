"""Lõi đồng bộ Garmin dùng CHUNG cho hàm nền (functions-py/main.py) và script trên Mac (scripts/garmin/sync.py).

Đọc: health_day() (ngủ, HRV, RHR, Body Battery, stress, readiness, bước) · workout() (một buổi tập).
Ghi: write_firestore() — trường `garmin` RIÊNG trong activity/{ngày} và recovery/{ngày}, + clients/{id}.garminSync.
KHÔNG đụng trường của Polar. Endpoint hỏng / đồng hồ không đo → null, không đoán số.
"""
import calendar
import math
import sys
from datetime import datetime, timezone

import strain as ST

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
    resp = safe(api.get_respiration_data, d) or {}
    spo2 = safe(api.get_spo2_data, d) or {}
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
        # Nhịp thở / SpO₂ LÚC NGỦ — so được với nhịp thở đêm của Polar. Đồng hồ không đo / không đeo khi ngủ → null.
        "resp": resp.get("avgSleepRespirationValue"),
        "respWake": resp.get("avgWakingRespirationValue"),
        "spo2": spo2.get("avgSleepSpO2") or spo2.get("averageSpO2"),
        "spo2Low": spo2.get("lowestSpO2"),
        "readiness": {"score": tr0.get("score"), "level": tr0.get("level"), "feedback": tr0.get("feedbackShort")} if tr0 else None,
        "steps": st.get("totalSteps"),
        "calories": st.get("totalKilocalories"),
        "activeCalories": st.get("activeKilocalories"),
        "intensityMin": (st.get("moderateIntensityMinutes") or 0) + 2 * (st.get("vigorousIntensityMinutes") or 0) if st else None,
    }


def _gmt_sec(s):
    """"2026-11-11 09:26:23" (GMT) → giây epoch."""
    try:
        return calendar.timegm(datetime.strptime(str(s)[:19], "%Y-%m-%d %H:%M:%S").timetuple())
    except (TypeError, ValueError):
        return None


def all_day_hr(api, d: str) -> list:
    """Nhịp tim cả ngày (Garmin ~2 phút / mẫu) → [{at giây, hr}] — tải ngày không tập, giống contSamples của Polar."""
    h = safe(api.get_heart_rates, d) or {}
    return [{"at": t / 1000, "hr": v} for t, v in (h.get("heartRateValues") or []) if isinstance(v, (int, float)) and v > 0]


def activity_hr(api, activity_id) -> list:
    """Nhịp tim TỪNG GIÂY của một buổi tập (directTimestamp ms + directHeartRate) — như file FIT của Polar."""
    det = safe(api.get_activity_details, activity_id, 4000, 0) or {}
    idx = {m.get("key"): m.get("metricsIndex") for m in det.get("metricDescriptors") or []}
    ti, hi = idx.get("directTimestamp"), idx.get("directHeartRate")
    if ti is None or hi is None:
        return []
    out = []
    for row in det.get("activityDetailMetrics") or []:
        m = row.get("metrics") or []
        if max(ti, hi) < len(m) and isinstance(m[ti], (int, float)) and isinstance(m[hi], (int, float)) and m[hi] > 0:
            out.append({"at": m[ti] / 1000, "hr": m[hi]})
    return out


def day_load(api, acts: list, cont: list, ctx: dict) -> dict | None:
    """Tải tim mạch MỘT ngày cho khách Garmin — cùng khuôn `load` của Polar (dayLoad trong functions/index.js) và
    cùng công thức strain (strain.py == strain.js). acts: buổi tập Garmin của ngày; cont: nhịp tim cả ngày."""
    if not ctx.get("hrMax") or ctx.get("rhr") is None:
        return None
    series, workouts, wins, sec = [], [], [], 0
    for a in acts:
        samples = activity_hr(api, a["activityId"]) if a.get("activityId") else []
        w = ST.workout_strain(samples, ctx) if len(samples) > 1 else None
        if len(samples) > 1:
            series.append(samples)
            ts = [p["at"] for p in samples]
            wins.append((min(ts), max(ts)))
        gsec = round(a.get("duration") or 0)
        sec += gsec
        workouts.append({
            "at": str(a.get("startTimeLocal") or "").replace(" ", "T"),
            "sport": str(g(a, "activityType", "typeKey") or "OTHER").upper(),
            "sec": gsec,
            "cardioLoad": num(a.get("activityTrainingLoad"), 1),     # training load của Garmin — chỗ cardio-load của Polar
            "strain": w["strain"] if w else None,
            "hrAvg": w["hrAvg"] if w else num(a.get("averageHR"), 0),
            "hrMax": w["hrMax"] if w else num(a.get("maxHR"), 0),
            "zoneSec": w["zoneSec"] if w else None,
            "samples": len(samples),
            "noHr": len(samples) < 2,
            "records": 1,
        })
    outside = [p for p in cont if not any(f <= p["at"] <= t for f, t in wins)]
    if len(outside) > 1:
        series.append(outside)
    if not workouts and len(outside) < 2:
        return None
    day = ST.daily_strain(series, ctx) if series else None
    cardio = sum(w["cardioLoad"] or 0 for w in workouts)
    return {
        "cardioLoad": round(cardio, 1), "strain": day["strain"] if day else None, "rawLoad": day["load"] if day else None,
        "zoneSec": day["zoneSec"] if day else None, "hrMax": ctx["hrMax"], "hrMaxSource": ctx.get("hrMaxSource"), "rhr": ctx["rhr"],
        "sessions": len(workouts), "sessionsNoHr": sum(1 for w in workouts if w["noHr"]), "sec": sec, "workouts": workouts,
        "allDaySamples": len(outside), "source": "garmin + app-strain-v1",
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


def encode_polyline(points) -> str:
    """Google encoded polyline (độ chính xác 1e-5 ≈ 1 m) — 329 điểm còn ~2–3 KB thay vì ~15 KB số thô.
    App giải bằng wlDecodePolyline() trong index.html (cùng thuật toán chuẩn)."""
    out, plat, plon = [], 0, 0
    for lat, lon in points:
        ilat, ilon = int(round(lat * 1e5)), int(round(lon * 1e5))
        for v in (ilat - plat, ilon - plon):
            v = ~(v << 1) if v < 0 else (v << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        plat, plon = ilat, ilon
    return "".join(out)


def route_of(api, activity_id):
    """Tuyến GPS của một buổi ngoài trời: {poly, spd[]} — spd (m/s) từng điểm để tô màu theo pace. Tối đa 800 điểm.

    Toạ độ là dữ liệu vị trí (lộ nơi ở nếu chạy từ nhà): nằm trong activity/{ngày} — chỉ coach phụ trách + chính khách đọc.
    """
    det = safe(api.get_activity_details, activity_id, 10, 800) or {}
    pts = [p for p in ((det.get("geoPolylineDTO") or {}).get("polyline") or [])
           if isinstance(p.get("lat"), (int, float)) and isinstance(p.get("lon"), (int, float)) and p.get("valid", True) is not False]
    if len(pts) < 2:
        return None
    return {"poly": encode_polyline([(p["lat"], p["lon"]) for p in pts]), "spd": _route_speeds(pts)}


def _haversine(la1, lo1, la2, lo2) -> float:
    """Khoảng cách (m) giữa hai toạ độ."""
    r = 6371008.8
    p1, p2 = math.radians(la1), math.radians(la2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _route_speeds(pts, window_ms: int = 20000):
    """Tốc độ (m/s) từng điểm. Trường `speed` Garmin trả trong polyline thường = 0 (2026-11-14: cả 329 điểm), nên
    tự tính từ quãng cộng dồn (distanceInMeters) + giờ (time, ms), trung bình trượt ~20 giây — GPS nhiễu từng
    điểm, tính từng cặp thì màu nhảy loạn. Thiếu quãng cộng dồn thì cộng distanceFromPreviousPoint."""
    dist, tot = [], 0.0
    for i, p in enumerate(pts):
        if isinstance(p.get("distanceInMeters"), (int, float)):
            tot = float(p["distanceInMeters"])
        elif i and isinstance(p.get("distanceFromPreviousPoint"), (int, float)):
            tot += float(p["distanceFromPreviousPoint"])
        elif i:   # 2026-11-14: Garmin để trống cả hai → tính từ toạ độ
            tot += _haversine(pts[i - 1]["lat"], pts[i - 1]["lon"], p["lat"], p["lon"])
        dist.append(tot)
    t = [p.get("time") if isinstance(p.get("time"), (int, float)) else None for p in pts]
    out, j = [], 0
    for i in range(len(pts)):
        if t[i] is None:
            out.append(None)
            continue
        while j < i and (t[j] is None or t[i] - t[j] > window_ms):
            j += 1
        k = j if j < i else max(0, i - 1)
        dt = (t[i] - t[k]) / 1000 if t[k] is not None else 0
        out.append(round((dist[i] - dist[k]) / dt, 2) if dt > 0 and dist[i] >= dist[k] else None)
    return out


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
        # Bản đồ tuyến (tab Work list): chỉ buổi CÓ GPS (Garmin đánh dấu hasPolyline — chạy máy / trong nhà thì không).
        "route": route_of(api, a["activityId"]) if recent and a.get("hasPolyline") and a.get("activityId") else None,
    }


def profile_of(api) -> dict | None:
    """Ngày sinh / giới tính / cân / cao từ hồ sơ Garmin — cùng dạng polarProfile (cân kg, cao cm) cho Healthspan."""
    ud = (safe(api.get_user_profile) or {}).get("userData") or {}
    if not ud.get("birthDate"):
        return None
    w, h = ud.get("weight"), ud.get("height")
    return {"birthdate": ud.get("birthDate"), "gender": ud.get("gender"),
            "weight": round(w / 1000, 1) if isinstance(w, (int, float)) and w > 500 else w,   # Garmin trả gram
            "height": h, "at": datetime.now(timezone.utc).isoformat()}


def polar_shape(day: str, rec: dict | None, act: dict | None, ws: list | None, load: dict | None = None) -> tuple[dict, dict]:
    """Bản theo KHUÔN POLAR cho khách chỉ có Garmin: tab Recovery / Health / dashboard / tóm tắt AI đọc
    sleep / recharge / steps / workouts ở gốc doc như của Polar. Không có số thì không ghi khoá đó (không ghi null đè)."""
    r, a = {}, {}
    if rec:
        sl, hrv, rhr = rec.get("sleep") or {}, rec.get("hrv") or {}, rec.get("rhr")
        if sl.get("total"):
            r["sleep"] = {k: sl.get(k) for k in ("total", "deep", "light", "rem", "score", "start", "end")} | {"hrMin": rhr}
        if rhr or hrv.get("lastNight") or rec.get("resp") or rec.get("spo2"):
            r["recharge"] = {"rhr": rhr, "hrv": hrv.get("lastNight"), "breathing": rec.get("resp"), "spo2": rec.get("spo2"),
                             "status": None, "ansCharge": None, "ansStatus": None}
    if load:
        r["load"] = load
    if r:
        r["source"] = "garmin"
    if act:
        a.update({"steps": act.get("steps"), "calories": act.get("calories"), "activeCalories": act.get("activeCalories"),
                  "activeSec": (act.get("intensityMin") or 0) * 60 if act.get("intensityMin") is not None else None})
    if ws is not None:
        a["workouts"] = [{"at": str(w.get("at") or "").replace(" ", "T"), "sport": str(w.get("sport") or "OTHER").upper(),
                          "sec": w.get("sec"), "calories": w.get("calories"), "hrAvg": w.get("hrAvg"), "hrMax": w.get("hrMax"),
                          "noHr": not w.get("hrAvg")} for w in ws]
        a["workoutSec"] = sum(w.get("sec") or 0 for w in ws) or None
        a["workoutCalories"] = sum(w.get("calories") or 0 for w in ws) or None
    if a:
        a["source"] = "garmin"
    return r, a


def write_firestore(db, client_id: str, days: list, workouts, mirror: bool = False, profile: dict | None = None) -> int:
    """Ghi lên Firestore (Admin SDK). workouts=None nghĩa là KÉO BUỔI TẬP HỎNG → không đụng workouts cũ.

    Cùng dạng với scripts/garmin/write.js: activity/{d}.garmin = {bước…, workouts[], at}; recovery/{d}.garmin.
    mirror=True (khách KHÔNG dùng Polar): ghi thêm bản khuôn Polar ở gốc doc (polar_shape) + garminProfile.
    Hồ sơ dùng Polar (polarProfile) KHÔNG BAO GIỜ mirror — số Polar không bị đè.
    """
    at = datetime.now(timezone.utc).isoformat()
    c = db.collection("clients").document(client_id)
    by = {}
    for d in days or []:
        s = by.setdefault(d["date"], {"rec": None, "act": {}, "w": [], "load": None})
        if d.get("sleep") or d.get("hrv") or d.get("rhr") or d.get("bodyBattery") or d.get("readiness"):
            s["rec"] = {k: d.get(k) for k in ("sleep", "hrv", "rhr", "bodyBattery", "stressAvg", "readiness",
                                              "resp", "respWake", "spo2", "spo2Low")} | {"at": at}
        s["load"] = d.get("load")
        if d.get("steps") is not None:
            s["act"] = {k: d.get(k) for k in ("steps", "calories", "activeCalories", "intensityMin")}
    for w in workouts or []:
        day = str(w.get("at") or "")[:10]
        if len(day) == 10:
            by.setdefault(day, {"rec": None, "act": {}, "w": [], "load": None})["w"].append(w)
    ops = []
    for day, s in sorted(by.items()):
        pr, pa = polar_shape(day, s["rec"], s["act"] or None, s["w"] if workouts is not None else None, s.get("load")) if mirror else ({}, {})
        if s["rec"] or pr:
            ops.append((c.collection("recovery").document(day), {"date": day, **pr, **({"garmin": s["rec"]} if s["rec"] else {})}))
        if s["act"] or s["w"] or workouts is not None:
            g_ = dict(s["act"])
            if workouts is not None:
                g_["workouts"] = s["w"]
            g_["at"] = at
            ops.append((c.collection("activity").document(day), {"date": day, **pa, "garmin": g_}))
    for i in range(0, len(ops), 400):
        b = db.batch()
        for ref, data in ops[i:i + 400]:
            b.set(ref, data, merge=True)
        b.commit()
    dates = sorted(by)
    if mirror and profile:
        c.set({"garminProfile": profile}, merge=True)
    c.set({"garminSync": {"at": at, "workouts": len(workouts or []), "from": dates[0] if dates else None,
                          "to": dates[-1] if dates else None, "by": "server"}}, merge=True)
    return len(ops)
