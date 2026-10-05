#!/bin/sh
# Chạy toàn bộ test. Trả mã khác 0 nếu có bài nào hỏng — để còn dùng được
# trong một chuỗi lệnh có && trước khi commit.
cd "$(dirname "$0")" || exit 1

# functions/node_modules bị gitignore nên worktree MỚI không có nó, và hai bài
# test cần firebase-admin sẽ hỏng vì thiếu module chứ không phải vì code sai.
# Nối tạm sang bản cài ở checkout chính. Nói ra chứ không làm lén.
if [ ! -e functions/node_modules ]; then
  main=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')
  if [ -d "$main/functions/node_modules" ]; then
    ln -s "$main/functions/node_modules" functions/node_modules
    echo "(đã nối functions/node_modules sang $main)"
  else
    echo "THIẾU functions/node_modules — chạy: cd functions && npm install"
  fi
fi

fail=0
for f in tests/*.test.js; do
  name=$(basename "$f" .test.js)
  printf '%-26s ' "$name"
  if TZ=Asia/Ho_Chi_Minh node "$f" >/dev/null 2>&1; then echo DAT; else echo HONG; fail=1; fi
done
[ "$fail" = 0 ] && printf '\nTAT CA DAT\n' || printf '\nCO BAI HONG — chay rieng de xem chi tiet\n'
exit $fail
