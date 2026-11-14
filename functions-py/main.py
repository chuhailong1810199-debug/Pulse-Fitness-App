"""Đồng bộ đồng hồ Garmin TRÊN MÁY CHỦ — cho coach và từng khách (2026-11-13).

Thư viện: cyberjunky/python-garminconnect — KHÔNG phải API chính thức. Garmin có thể chặn yêu cầu từ máy chủ
cloud hoặc đổi cách đăng nhập; khi đó hàm báo lỗi rõ, không giả vờ đã đồng bộ.

Kết nối (garminConnect): khách / coach nhập email + mật khẩu Garmin trong tab Work list → máy chủ đăng nhập MỘT
lần, lưu TOKEN, BỎ mật khẩu (không ghi, không log). Có mã 2 lớp → trả needsMfa, lần gọi sau gửi mã.
  privateTokens/garmin_{clientId}      { tokens, updatedAt }       — luật `if false`: chỉ Admin SDK
  privateTokens/garmin_mfa_{clientId}  { state, exp }              — phiên chờ mã 2 lớp, 10 phút
  clients/{clientId}.garmin            { connected, name, at, err } — để app biết đã kết nối chưa
Ai được làm với hồ sơ X: coach phụ trách (coachUid) hoặc chính khách (email đã xác thực khớp clients/X.email).

Ghi dữ liệu y hệt scripts/garmin/write.js (garmin_core.write_firestore): trường `garmin` RIÊNG trong
activity/recovery theo ngày — không đè Polar.
"""
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone

from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn, options, scheduler_fn

import garmin_core as core

initialize_app()
REGION = "asia-southeast1"
VN = timezone(timedelta(hours=7))
E = https_fn.FunctionsErrorCode
CID_RE = re.compile(r"^[A-Za-z0-9_\-À-ỹ]{1,80}$")


def _err(code, msg):
    return https_fn.HttpsError(code, msg)


def _cid(data) -> str:
    cid = str((data or {}).get("clientId") or "").strip()
    if not CID_RE.match(cid):
        raise _err(E.INVALID_ARGUMENT, "clientId không hợp lệ.")
    return cid


def _authorize(req, cid: str) -> dict:
    """Coach phụ trách hoặc chính khách. Trả dữ liệu hồ sơ khách."""
    if not req.auth or not req.auth.uid:
        raise _err(E.UNAUTHENTICATED, "Cần đăng nhập.")
    snap = firestore.client().document("clients/" + cid).get()
    if not snap.exists:
        raise _err(E.NOT_FOUND, "Không có hồ sơ này.")
    d = snap.to_dict() or {}
    if d.get("coachUid") and d.get("coachUid") == req.auth.uid:
        return d
    tok = req.auth.token or {}
    em = str(tok.get("email") or "").strip().lower()
    if em and tok.get("email_verified") is not False and str(d.get("email") or "").strip().lower() == em:
        return d
    raise _err(E.PERMISSION_DENIED, "Không có quyền với hồ sơ này.")


def _sync(cid: str, health_days: int, history_days: int) -> dict:
    from garminconnect import Garmin

    db = firestore.client()
    cdoc = db.document("clients/" + cid).get()
    cd = cdoc.to_dict() or {} if cdoc.exists else {}
    # Khách CHỈ dùng Garmin (không có polarProfile) → ghi thêm khuôn Polar cho Recovery / Health. Lần đầu kéo
    # 28 đêm để Recovery / Healthspan có đường nền ngay (Recovery đọc 28 ngày).
    mirror = not cd.get("polarProfile")
    if mirror and not (cd.get("garminSync") or {}).get("at"):
        health_days = max(health_days, 28)
    tref = db.document("privateTokens/garmin_" + cid)
    snap = tref.get()
    tokens = (snap.to_dict() or {}).get("tokens") if snap.exists else None
    if not tokens:
        raise RuntimeError("NO_TOKEN")
    api = Garmin()
    api.login(tokens)                    # chuỗi JSON → nạp thẳng, tự làm mới khi sắp hết hạn
    today = datetime.now(VN).date()
    days = [core.health_day(api, (today - timedelta(days=i)).isoformat()) for i in range(health_days - 1, -1, -1)]
    start = (today - timedelta(days=history_days)).isoformat()
    acts = core.safe(api.get_activities_by_date, start, today.isoformat())
    cut = (today - timedelta(days=60)).isoformat()
    # Kéo buổi tập HỎNG (None) ≠ không có buổi nào ([]): hỏng thì giữ nguyên workouts cũ.
    workouts = None if acts is None else [core.workout(api, a, str(a.get("startTimeLocal") or "")[:10] >= cut)
                                          for a in acts if isinstance(a, dict)]
    profile = core.profile_of(api) if mirror else None
    if mirror and acts:
        _strain_days(api, cd, profile, days, acts, min(len(days), 14))
    n = core.write_firestore(db, cid, days, workouts, mirror=mirror, profile=profile)
    try:  # token đã làm mới phải lưu lại — không thì lần sau Garmin bắt đăng nhập lại
        tref.set({"tokens": api.client.dumps(), "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
    except Exception as e:  # noqa: BLE001
        print("[garmin] không lưu lại được token:", cid, type(e).__name__, file=sys.stderr)
    db.document("clients/" + cid).set({"garmin": {"connected": True, "err": None}}, merge=True)
    if workouts is None:
        raise RuntimeError("Garmin không trả danh sách buổi tập")
    return {"docs": n, "workouts": len(workouts), "from": start, "to": today.isoformat()}


def _strain_days(api, cd: dict, profile: dict | None, days: list, acts: list, n: int) -> None:
    """Strain 0–21 cho N ngày gần nhất (khách Garmin) — gắn d["load"]; write_firestore đưa vào recovery/{ngày}.load.

    HR max: số coach nhập (clients.maxHr) > cao nhất Garmin ghi được trong các buổi đã kéo > ước theo tuổi.
    """
    observed = max([a.get("maxHR") for a in acts if isinstance(a.get("maxHR"), (int, float))] or [0]) or None
    sex = "female" if str((profile or {}).get("gender") or "").upper() == "FEMALE" else "male"
    for d in days[-n:]:
        rhr = d.get("rhr")
        if rhr is None:
            continue
        hm = core.ST.resolve_hr_max(manual=cd.get("maxHr"), observed=observed,
                                    birthdate=(profile or {}).get("birthdate"), today=d["date"])
        if not hm.get("hrMax"):
            continue
        ctx = {"rhr": rhr, "hrMax": hm["hrMax"], "hrMaxSource": hm["source"], "sex": sex}
        day_acts = [a for a in acts if str(a.get("startTimeLocal") or "")[:10] == d["date"]]
        try:
            d["load"] = core.day_load(api, day_acts, core.all_day_hr(api, d["date"]), ctx)
        except Exception as e:  # noqa: BLE001 — strain hỏng một ngày không được làm hỏng cả lần đồng bộ
            print("[garmin] strain hỏng", d["date"], type(e).__name__, file=sys.stderr)


def _mapped(e: Exception) -> https_fn.HttpsError:
    msg = str(e)
    if msg == "NO_TOKEN":
        return _err(E.FAILED_PRECONDITION, "Chưa kết nối Garmin — nhập tài khoản Garmin trong tab Work list.")
    low = msg.lower()
    if any(k in low for k in ("401", "403", "unauthorized", "forbidden", "login", "mfa", "cloudflare", "429", "credential")):
        return _err(E.UNAUTHENTICATED, "Garmin từ chối (" + type(e).__name__ + "). Kết nối lại tài khoản Garmin.")
    return _err(E.INTERNAL, "Đồng bộ Garmin hỏng: " + type(e).__name__)


def _finish_login(db, cid: str, api, by: str) -> dict:
    db.document("privateTokens/garmin_" + cid).set({"tokens": api.client.dumps(), "updatedAt": firestore.SERVER_TIMESTAMP})
    db.document("privateTokens/garmin_mfa_" + cid).delete()
    name = None
    try:
        name = api.get_full_name()
    except Exception:  # noqa: BLE001
        pass
    db.document("clients/" + cid).set({"garmin": {"connected": True, "name": name, "at": datetime.now(timezone.utc).isoformat(),
                                                  "by": by, "err": None}}, merge=True)
    return {"connected": True, "name": name}


@https_fn.on_call(region=REGION, timeout_sec=120, memory=options.MemoryOption.MB_512)
def garminConnect(req: https_fn.CallableRequest) -> dict:
    """Kết nối Garmin cho hồ sơ clientId. data: {clientId, email, password} hoặc {clientId, mfaCode}.

    Mật khẩu chỉ nằm trong bộ nhớ của lần gọi này — không ghi Firestore, không in log.
    """
    from garminconnect import Garmin

    data = req.data or {}
    cid = _cid(data)
    prof = _authorize(req, cid)
    db = firestore.client()
    by = "coach" if prof.get("coachUid") == req.auth.uid else "client"
    mref = db.document("privateTokens/garmin_mfa_" + cid)
    try:
        code = str(data.get("mfaCode") or "").strip()
        if code:
            st = mref.get()
            s = st.to_dict() if st.exists else None
            if not s or float(s.get("exp") or 0) < time.time():
                raise _err(E.FAILED_PRECONDITION, "Phiên chờ mã đã hết — nhập lại email và mật khẩu.")
            api = Garmin(return_on_mfa=True)
            api.resume_login(json.loads(s["state"]), code)
            return _finish_login(db, cid, api, by)
        email = str(data.get("email") or "").strip()
        password = str(data.get("password") or "")
        if not email or not password:
            raise _err(E.INVALID_ARGUMENT, "Nhập email và mật khẩu Garmin.")
        api = Garmin(email=email, password=password, return_on_mfa=True)
        password = None
        status, state = api.login()
        if status == "needs_mfa":
            mref.set({"state": json.dumps(state), "exp": time.time() + 600})
            return {"needsMfa": True}
        return _finish_login(db, cid, api, by)
    except https_fn.HttpsError:
        raise
    except Exception as e:  # noqa: BLE001 — KHÔNG in str(e): có thể kèm dữ liệu đăng nhập
        print("[garmin] kết nối hỏng:", cid, type(e).__name__, file=sys.stderr)
        low = str(e).lower()
        if any(k in low for k in ("401", "403", "invalid", "credential", "password", "unauthorized")):
            raise _err(E.UNAUTHENTICATED, "Garmin không nhận email / mật khẩu này (hoặc mã 2 lớp sai).")
        raise _err(E.INTERNAL, "Không kết nối được Garmin (" + type(e).__name__ + "). Thử lại sau.")


@https_fn.on_call(region=REGION, timeout_sec=60)
def garminDisconnect(req: https_fn.CallableRequest) -> dict:
    cid = _cid(req.data or {})
    _authorize(req, cid)
    db = firestore.client()
    db.document("privateTokens/garmin_" + cid).delete()
    db.document("privateTokens/garmin_mfa_" + cid).delete()
    db.document("clients/" + cid).set({"garmin": {"connected": False, "at": datetime.now(timezone.utc).isoformat()}}, merge=True)
    return {"connected": False}


@https_fn.on_call(region=REGION, timeout_sec=540, memory=options.MemoryOption.MB_512)
def garminSyncNow(req: https_fn.CallableRequest) -> dict:
    """Nút "Đồng bộ" của tab Work list. data: {clientId} — mặc định hồ sơ của coach (longchu) cho bản app cũ."""
    data = dict(req.data or {})
    data.setdefault("clientId", "longchu")
    cid = _cid(data)
    _authorize(req, cid)
    try:
        return _sync(cid, health_days=7, history_days=45)
    except Exception as e:  # noqa: BLE001
        print("[garmin] sync hỏng:", cid, type(e).__name__, str(e)[:160], file=sys.stderr)
        raise _mapped(e)


@scheduler_fn.on_schedule(schedule="30 6 * * *", timezone="Asia/Ho_Chi_Minh", region=REGION,
                          timeout_sec=1800, memory=options.MemoryOption.MB_512)
def garminSyncDaily(event: scheduler_fn.ScheduledEvent) -> None:
    """06:30 mỗi sáng: mọi hồ sơ đã kết nối. Giãn 20 giây giữa các tài khoản để Garmin khó coi là bot."""
    db = firestore.client()
    ids = [d.id[len("garmin_"):] for d in db.collection("privateTokens").list_documents()
           if d.id.startswith("garmin_") and not d.id.startswith("garmin_mfa_")]
    for i, cid in enumerate(ids):
        if i:
            time.sleep(20)
        try:
            print("[garmin] sáng", cid, json.dumps(_sync(cid, health_days=3, history_days=10)))
        except Exception as e:  # noqa: BLE001
            print("[garmin] sáng hỏng", cid, type(e).__name__, str(e)[:160], file=sys.stderr)
            db.document("clients/" + cid).set({"garmin": {"err": type(e).__name__, "errAt": datetime.now(timezone.utc).isoformat()}}, merge=True)
