"""Strava — API CHÍNH THỨC (OAuth), lựa chọn thứ hai bên cạnh Garmin cho tab Work list (2026-11-14).

Khách bấm "Kết nối với Strava" → trang Strava → Cho phép → quay về app với ?code → hàm nền đổi code lấy token.
App KHÔNG bao giờ thấy mật khẩu Strava. Strava có buổi tập (kể cả ghi bằng GPS điện thoại, Apple Watch, Coros…),
KHÔNG có giấc ngủ / HRV / nhịp tim nghỉ.

  privateTokens/strava_app        { clientId, clientSecret }      — mật khẩu ỨNG DỤNG; coach tự nhập (scripts/strava/set-app.js)
  privateTokens/strava_{clientId} { access, refresh, expiresAt, athleteId }
  activity/{ngày}.strava          { workouts[], at }               — cùng khuôn workout với Garmin (tab Work list đọc)

Giới hạn Strava (cho CẢ ứng dụng, mọi khách cộng lại): ~100 lần đọc / 15 phút. Vì vậy chỉ kéo chi tiết (streams + lap)
cho tối đa DETAIL_MAX buổi MỚI mỗi lần; buổi đã lưu dùng lại; buổi còn lại vẫn có bản đồ từ summary_polyline.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import strain as ST
from garmin_core import encode_polyline

API = "https://www.strava.com/api/v3"
DETAIL_MAX = 12
SPORT = {  # sport_type của Strava → typeKey kiểu Garmin (tab Work list tô màu theo nhóm này)
    "Run": "running", "TrailRun": "trail_running", "VirtualRun": "treadmill_running",
    "Ride": "cycling", "MountainBikeRide": "cycling", "GravelRide": "cycling", "EBikeRide": "e_bike_fitness",
    "VirtualRide": "indoor_cycling", "WeightTraining": "strength_training", "Crossfit": "hiit",
    "HighIntensityIntervalTraining": "hiit", "Workout": "indoor_cardio", "Elliptical": "indoor_cardio",
    "Walk": "walking", "Hike": "hiking", "Swim": "lap_swimming", "Rowing": "indoor_rowing", "Yoga": "yoga",
}


class StravaError(Exception):
    def __init__(self, status, msg):
        super().__init__(f"Strava HTTP {status}: {msg}")
        self.status = status


def _http(method: str, url: str, token: str | None = None, data: dict | None = None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise StravaError(e.code, (e.read() or b"")[:200].decode("utf-8", "replace")) from None


def exchange_code(app: dict, code: str) -> dict:
    """code (Strava trả về sau khi khách Cho phép) → token. KHÔNG log token."""
    return _http("POST", "https://www.strava.com/oauth/token",
                 data={"client_id": app["clientId"], "client_secret": app["clientSecret"], "code": code,
                       "grant_type": "authorization_code"})


def fresh_token(app: dict, tok: dict) -> tuple[dict, bool]:
    """Token còn hạn > 5 phút thì giữ; không thì làm mới (Strava cấp refresh token MỚI — phải lưu lại)."""
    if float(tok.get("expiresAt") or 0) > time.time() + 300:
        return tok, False
    r = _http("POST", "https://www.strava.com/oauth/token",
              data={"client_id": app["clientId"], "client_secret": app["clientSecret"],
                    "grant_type": "refresh_token", "refresh_token": tok["refresh"]})
    return {**tok, "access": r["access_token"], "refresh": r.get("refresh_token", tok["refresh"]),
            "expiresAt": r.get("expires_at")}, True


def list_activities(access: str, after_epoch: int, pages: int = 3) -> list:
    out = []
    for p in range(1, pages + 1):
        chunk = _http("GET", f"{API}/athlete/activities?after={int(after_epoch)}&per_page=100&page={p}", access) or []
        out += chunk
        if len(chunk) < 100:
            break
    return out


def _local(s: str) -> str:
    """start_date_local "2026-11-11T06:05:00Z" (giờ ĐỊA PHƯƠNG dù có Z) → "2026-11-11 06:05:00" như Garmin."""
    return str(s or "")[:19].replace("T", " ")


def _streams(access: str, aid) -> dict:
    try:
        s = _http("GET", f"{API}/activities/{aid}/streams?keys=time,heartrate,latlng,velocity_smooth&key_by_type=true", access)
        return {k: (v or {}).get("data") for k, v in (s or {}).items()}
    except StravaError as e:
        print("[strava] streams", aid, e.status, file=sys.stderr)
        return {}


def _laps(access: str, aid):
    try:
        return [{"distM": l.get("distance"), "sec": l.get("elapsed_time"), "hrAvg": l.get("average_heartrate"),
                 "speed": l.get("average_speed")} for l in (_http("GET", f"{API}/activities/{aid}/laps", access) or [])[:60]] or None
    except StravaError as e:
        print("[strava] laps", aid, e.status, file=sys.stderr)
        return None


def _route(a: dict, st: dict):
    """Bản đồ: ưu tiên streams (toạ độ + tốc độ thật → tô màu theo pace); không có thì summary_polyline (một màu)."""
    ll, vel = st.get("latlng") or [], st.get("velocity_smooth") or []
    if len(ll) >= 2:
        step = max(1, len(ll) // 800)
        idx = list(range(0, len(ll), step))
        return {"poly": encode_polyline([tuple(ll[i]) for i in idx]),
                "spd": [round(vel[i], 2) if i < len(vel) and isinstance(vel[i], (int, float)) else None for i in idx]}
    poly = ((a.get("map") or {}).get("summary_polyline") or "")
    return {"poly": poly, "spd": []} if poly else None


def hr_samples(a: dict, st: dict) -> list:
    t, hr = st.get("time") or [], st.get("heartrate") or []
    t0 = time.mktime(time.strptime(_local(a.get("start_date_local")), "%Y-%m-%d %H:%M:%S")) if a.get("start_date_local") else 0
    return [{"at": t0 + t[i], "hr": hr[i]} for i in range(min(len(t), len(hr))) if isinstance(hr[i], (int, float)) and hr[i] > 0]


def to_workout(a: dict, st: dict | None, laps, ctx: dict | None, cached: dict | None = None) -> dict:
    sport = SPORT.get(a.get("sport_type") or a.get("type"), str(a.get("sport_type") or "other").lower())
    w = {
        "id": "s" + str(a.get("id")), "source": "strava", "at": _local(a.get("start_date_local")),
        "name": a.get("name"), "sport": sport,
        "sec": a.get("elapsed_time"), "distM": a.get("distance") or None, "speed": a.get("average_speed") or None,
        "calories": a.get("calories") or (round(a["kilojoules"] / 4.184 / 0.24) if a.get("kilojoules") else None),
        "hrAvg": a.get("average_heartrate"), "hrMax": a.get("max_heartrate"),
        "load": a.get("suffer_score"),        # Relative Effort của Strava (chỉ tài khoản có gói) — chỗ training load
        "teAer": None, "teAna": None, "zones": None, "laps": None, "route": None,
    }
    if cached and "route" in cached:          # đã kéo chi tiết lần trước → dùng lại, không tốn lượt gọi Strava
        for k in ("zones", "laps", "route", "strain"):
            w[k] = cached.get(k)
        return w
    if st is not None:
        w["laps"] = laps
        w["route"] = _route(a, st)
        samples = hr_samples(a, st)
        if ctx and len(samples) > 1:
            r = ST.workout_strain(samples, ctx)
            if r:
                w["zones"], w["strain"] = r["zoneSec"], r["strain"]
    else:   # quá DETAIL_MAX buổi mới trong một lần → vẫn có bản đồ (một màu) từ summary_polyline, chi tiết kéo ở lần sau
        w["route"] = _route(a, {})
        w.pop("route")                    # bỏ khoá: lần sau coi như CHƯA kéo chi tiết → sẽ kéo
        w["summaryRoute"] = _route(a, {})
    return w


def day_loads(workouts: list, samples_by_id: dict, ctx: dict) -> dict:
    """Strain CẢ NGÀY từ các buổi có nhịp tim (Strava không có nhịp tim cả ngày → chỉ phần buổi tập). Khuôn `load` Polar."""
    by = {}
    for w in workouts:
        by.setdefault(str(w.get("at") or "")[:10], []).append(w)
    out = {}
    for day, ws in by.items():
        series = [samples_by_id[w["id"]] for w in ws if len(samples_by_id.get(w["id"]) or []) > 1]
        if not series:
            continue
        d = ST.daily_strain(series, ctx)
        out[day] = {"cardioLoad": None, "strain": d["strain"], "rawLoad": d["load"], "zoneSec": d["zoneSec"],
                    "hrMax": ctx["hrMax"], "hrMaxSource": ctx.get("hrMaxSource"), "rhr": ctx["rhr"], "rhrSource": ctx.get("rhrSource"),
                    "sessions": len(ws), "sessionsNoHr": sum(1 for w in ws if w["id"] not in samples_by_id), "sec": sum(w.get("sec") or 0 for w in ws),
                    "workouts": [{"at": w["at"].replace(" ", "T"), "sport": str(w["sport"]).upper(), "sec": w.get("sec"), "strain": w.get("strain"),
                                  "hrAvg": w.get("hrAvg"), "hrMax": w.get("hrMax"), "zoneSec": w.get("zones"), "noHr": w["id"] not in samples_by_id,
                                  "records": 1} for w in ws],
                    "allDaySamples": 0, "source": "strava + app-strain-v1"}
    return out
