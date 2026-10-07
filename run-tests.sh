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

# ── Luật Firestore + Storage chạy THẬT trên emulator ──────────────────
# Cần Java + firebase-tools. Thiếu thì BÁO HỎNG chứ không lặng lẽ bỏ qua:
# đây là lớp bảo mật, "không chạy được" không được trông giống "đạt".
if [ ! -e tests/rules/node_modules ]; then
  main=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')
  if [ -d "$main/tests/rules/node_modules" ]; then
    ln -s "$main/tests/rules/node_modules" tests/rules/node_modules
    echo "(đã nối tests/rules/node_modules sang $main)"
  else
    (cd tests/rules && npm install --silent >/dev/null 2>&1)
  fi
fi
for f in tests/rules/*.test.js; do
  name=rules/$(basename "$f" .test.js)
  printf '%-26s ' "$name"
  if ! command -v java >/dev/null 2>&1 || ! command -v firebase >/dev/null 2>&1; then
    echo "HONG (thiếu java hoặc firebase)"; fail=1; continue
  fi
  if NODE_PATH=tests/rules/node_modules firebase emulators:exec --project demo-pulse-rules \
       --only firestore,storage "node $f" >/dev/null 2>&1; then echo DAT; else echo HONG; fail=1; fi
done

[ "$fail" = 0 ] && printf '\nTAT CA DAT\n' || printf '\nCO BAI HONG — chay rieng de xem chi tiet\n'
exit $fail
