"""Đăng nhập Garmin Connect MỘT lần, lưu token để các lần đồng bộ sau khỏi hỏi mật khẩu.

Chạy trong Terminal của chính mày (mật khẩu gõ ẩn, không in ra, không lưu):

    scripts/garmin/.venv/bin/python scripts/garmin/login.py

Token nằm ở ~/.garminconnect/garmin_tokens.json — NGOÀI repo, chỉ tài khoản máy này đọc được.
File đó có giá trị như mật khẩu: đừng gửi, đừng commit. Muốn huỷ thì xoá file và đổi mật khẩu
Garmin (đăng xuất không thu hồi token đã cấp).

Thư viện: cyberjunky/python-garminconnect — KHÔNG phải API chính thức của Garmin, Garmin đổi
cách đăng nhập là có thể hỏng. Chỉ dùng cho tài khoản của chính coach.
"""
import getpass
import os
import sys
from pathlib import Path

from garminconnect import Garmin

TOKENSTORE = os.getenv("GARMINTOKENS", str(Path.home() / ".garminconnect"))


def main() -> int:
    store = Path(TOKENSTORE).expanduser()
    store.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(store, 0o700)

    email = input("Email Garmin: ").strip()
    password = getpass.getpass("Mật khẩu Garmin (gõ ẩn): ")
    api = Garmin(email=email, password=password,
                 prompt_mfa=lambda: input("Mã xác thực 2 lớp (MFA) từ Garmin: ").strip())
    try:
        api.login(str(store))
    finally:
        password = None  # không giữ mật khẩu trong bộ nhớ lâu hơn cần thiết
    # login() đã ghi token vào store; siết quyền file cho chắc.
    for f in store.glob("*.json"):
        os.chmod(f, 0o600)
    name = None
    try:
        name = api.get_full_name()
    except Exception:  # noqa: BLE001 — chỉ để chào, không quan trọng
        pass
    print(f"✓ Đăng nhập xong{(' — ' + name) if name else ''}. Token lưu ở {store}")
    print("Giờ chạy: scripts/garmin/.venv/bin/python scripts/garmin/sync.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
