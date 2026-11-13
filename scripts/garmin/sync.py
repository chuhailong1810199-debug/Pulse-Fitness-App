"""Kéo dữ liệu Garmin của CHÍNH coach về một file JSON trên Mac (chưa ghi Firestore).

    scripts/garmin/.venv/bin/python scripts/garmin/sync.py                    # sức khoẻ 14 ngày + buổi tập 365 ngày
    scripts/garmin/.venv/bin/python scripts/garmin/sync.py --days 30 --history-days 1825

Cần chạy login.py trước. Kết quả: scripts/garmin/out/garmin-latest.json (gitignore); ghi lên app bằng
scripts/garmin/write.js --write. Từ 2026-11-13 máy chủ tự đồng bộ (functions-py) — script này để kéo lịch sử dài
hoặc khi máy chủ bị Garmin chặn. Lõi đọc dữ liệu dùng CHUNG với máy chủ: functions-py/garmin_core.py.
"""
import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "functions-py"))
import garmin_core as core  # noqa: E402

TOKENSTORE = os.getenv("GARMINTOKENS", str(Path.home() / ".garminconnect"))
OUT = Path(__file__).resolve().parent / "out"


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
        r = core.health_day(api, d)
        days.append(r)
        print(f"{d}  ngủ {round(((r['sleep'] or {}).get('total') or 0) / 3600, 1)}h  HRV {(r['hrv'] or {}).get('lastNight')}  "
              f"RHR {r['rhr']}  BB {(r['bodyBattery'] or {}).get('high')}  bước {r['steps']}")
        time.sleep(0.3)  # nhẹ tay với máy chủ Garmin

    start = (today - timedelta(days=max(1, min(a.history_days, 3650)))).isoformat()
    acts = core.safe(api.get_activities_by_date, start, today.isoformat())
    if acts is None:
        print("Không kéo được danh sách buổi tập — thử lại sau.", file=sys.stderr)
        return 1
    cut = (today - timedelta(days=60)).isoformat()
    workouts = [core.workout(api, x, str(x.get("startTimeLocal") or "")[:10] >= cut) for x in acts if isinstance(x, dict)]
    workouts.sort(key=lambda w: str(w.get("at") or ""))
    print(f"Buổi tập từ {start}: {len(workouts)}")
    for w in workouts[-5:]:
        print(f"  {str(w['at'])[:16]}  {w['sport']:<18} {w['name'] or '':<30.30} {round((w['sec'] or 0) / 60)}′  load {w['load']}")

    OUT.mkdir(exist_ok=True)
    f = OUT / "garmin-latest.json"
    f.write_text(json.dumps({"fetchedAt": int(time.time()), "days": days, "workouts": workouts}, ensure_ascii=False, indent=1))
    print(f"✓ {len(days)} ngày sức khoẻ + {len(workouts)} buổi tập → {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
