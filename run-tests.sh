#!/bin/sh
# Chạy toàn bộ test. Trả mã khác 0 nếu có bài nào hỏng — để còn dùng được
# trong một chuỗi lệnh có && trước khi commit.
cd "$(dirname "$0")" || exit 1
fail=0
for f in tests/*.test.js; do
  name=$(basename "$f" .test.js)
  printf '%-26s ' "$name"
  if TZ=Asia/Ho_Chi_Minh node "$f" >/dev/null 2>&1; then echo DAT; else echo HONG; fail=1; fi
done
[ "$fail" = 0 ] && echo "\nTAT CA DAT" || echo "\nCO BAI HONG — chay rieng de xem chi tiet"
exit $fail
