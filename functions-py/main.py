"""Đồng bộ đồng hồ Garmin của coach TRÊN MÁY CHỦ (2026-11-13) — để bấm "Sync" trong app / tự chạy mỗi sáng.

Thư viện: cyberjunky/python-garminconnect — KHÔNG phải API chính thức. Garmin có thể chặn yêu cầu từ máy chủ
cloud hoặc đổi cách đăng nhập; khi đó hàm báo lỗi rõ ràng, tab Work list hiện lệnh đồng bộ trên Mac.

Token (KHÔNG phải mật khẩu) nằm ở Firestore `privateTokens/garmin_{clientId}` { tokens, updatedAt }:
luật Firestore CHẶN mọi máy khách (allow read, write: if false) — chỉ hàm nền (Admin SDK) đọc ghi. Tải token
lên bằng scripts/garmin/upload-token.js sau khi login.py trên Mac. Mỗi lần chạy xong ghi lại token đã làm mới.

Ghi dữ liệu y hệt scripts/garmin/write.js: trường `garmin` RIÊNG trong activity/recovery theo ngày — không đè Polar.
"""
import json
import sys
from datetime import datetime, timedelta, timezone

from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn, options, scheduler_fn

import garmin_core as core

initialize_app()
REGION = "asia-southeast1"
CLIENT_ID = "longchu"          # = COACH_HOME_CLIENT trong index.html — hồ sơ tập của chính coach
TOKEN_DOC = "privateTokens/garmin_" + CLIENT_ID
VN = timezone(timedelta(hours=7))


def _sync(health_days: int, history_days: int) -> dict:
    from garminconnect import Garmin

    db = firestore.client()
    tref = db.document(TOKEN_DOC)
    snap = tref.get()
    tokens = (snap.to_dict() or {}).get("tokens") if snap.exists else None
    if not tokens:
        raise RuntimeError("NO_TOKEN")
    api = Garmin()
    api.login(tokens)                    # chuỗi JSON → thư viện nạp thẳng, tự làm mới nếu sắp hết hạn
    today = datetime.now(VN).date()
    days = [core.health_day(api, (today - timedelta(days=i)).isoformat()) for i in range(health_days - 1, -1, -1)]
    start = (today - timedelta(days=history_days)).isoformat()
    acts = core.safe(api.get_activities_by_date, start, today.isoformat())
    cut = (today - timedelta(days=60)).isoformat()
    # Kéo buổi tập HỎNG (None) ≠ không có buổi nào ([]): hỏng thì giữ nguyên workouts cũ, đừng ghi đè bằng mảng rỗng.
    workouts = None if acts is None else [core.workout(api, a, str(a.get("startTimeLocal") or "")[:10] >= cut)
                                          for a in acts if isinstance(a, dict)]
    n = core.write_firestore(db, CLIENT_ID, days, workouts)
    # Token đã làm mới phải lưu lại — không thì lần sau dùng refresh token cũ, Garmin bắt đăng nhập lại.
    try:
        tref.set({"tokens": api.client.dumps(), "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
    except Exception as e:  # noqa: BLE001
        print("[garmin] không lưu lại được token:", type(e).__name__, file=sys.stderr)
    if workouts is None:
        raise RuntimeError("Garmin không trả danh sách buổi tập")
    return {"docs": n, "workouts": len(workouts), "from": start, "to": today.isoformat()}


def _error(e: Exception) -> https_fn.HttpsError:
    msg = str(e)
    if msg == "NO_TOKEN":
        return https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                                   "Máy chủ chưa có token Garmin — chạy login.py rồi upload-token.js trên Mac.")
    low = msg.lower()
    if any(k in low for k in ("401", "403", "unauthorized", "forbidden", "login", "mfa", "cloudflare", "429")):
        return https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                                   "Garmin từ chối máy chủ (" + type(e).__name__ + "). Đăng nhập lại trên Mac và upload token, "
                                   "hoặc đồng bộ bằng lệnh trên Mac.")
    return https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "Đồng bộ Garmin hỏng: " + type(e).__name__)


@https_fn.on_call(region=REGION, timeout_sec=240, memory=options.MemoryOption.MB_512)
def garminSyncNow(req: https_fn.CallableRequest) -> dict:
    """Nút "Sync" của tab Work list. CHỈ coach phụ trách hồ sơ CLIENT_ID (= chính chủ đồng hồ)."""
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Cần đăng nhập.")
    c = firestore.client().document("clients/" + CLIENT_ID).get()
    if not c.exists or (c.to_dict() or {}).get("coachUid") != req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED, "Chỉ chủ đồng hồ mới đồng bộ được.")
    try:
        return _sync(health_days=7, history_days=45)
    except Exception as e:  # noqa: BLE001
        print("[garmin] sync hỏng:", type(e).__name__, str(e)[:200], file=sys.stderr)
        raise _error(e)


@scheduler_fn.on_schedule(schedule="30 6 * * *", timezone="Asia/Ho_Chi_Minh", region=REGION,
                          timeout_sec=300, memory=options.MemoryOption.MB_512)
def garminSyncDaily(event: scheduler_fn.ScheduledEvent) -> None:
    """06:30 mỗi sáng — không cần Mac, không cần mở app."""
    try:
        r = _sync(health_days=3, history_days=10)
        print("[garmin] sáng:", json.dumps(r))
    except Exception as e:  # noqa: BLE001
        print("[garmin] sáng hỏng:", type(e).__name__, str(e)[:200], file=sys.stderr)
