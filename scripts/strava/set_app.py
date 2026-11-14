"""Lưu Client ID + Client Secret của ỨNG DỤNG Strava lên máy chủ (privateTokens/strava_app — luật chặn mọi máy khách).

Tạo ứng dụng ở https://www.strava.com/settings/api trước. Rồi chạy TRONG TERMINAL CỦA MÀY (Secret gõ ẩn, không in ra):

    functions-py/venv/bin/python scripts/strava/set_app.py
"""
import getpass
import os

os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "fitness-app-a22c8")
import firebase_admin  # noqa: E402
from firebase_admin import firestore  # noqa: E402

firebase_admin.initialize_app(options={"projectId": "fitness-app-a22c8"})
cid = input("Strava Client ID (số): ").strip()
sec = getpass.getpass("Strava Client Secret (gõ ẩn): ").strip()
if not cid.isdigit() or len(sec) < 20:
    raise SystemExit("Client ID phải là số, Client Secret dài ~40 ký tự — kiểm tra lại trang strava.com/settings/api.")
db = firestore.client()
db.document("privateTokens/strava_app").set({"clientId": cid, "clientSecret": sec, "updatedAt": firestore.SERVER_TIMESTAMP})
# Client ID là CÔNG KHAI (nằm trong đường dẫn đăng nhập Strava) — app đọc ở settings/strava để mở trang Strava.
db.document("settings/strava").set({"clientId": cid}, merge=True)
sec = None
print(f"✓ Đã lưu ứng dụng Strava (Client ID {cid}). Nút 'Kết nối với Strava' trong tab Work list dùng được ngay.")
