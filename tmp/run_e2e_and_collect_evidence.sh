#!/usr/bin/env bash
# Script to run E2E test and collect concrete database evidence of the Resume flow.

set -eo pipefail

echo "=== [1/5] Setup clean environment & ports ==="
rm -rf tmp/e2e_env tmp/e2e_workspace
mkdir -p tmp/e2e_env tmp/e2e_workspace
fuser -k 8080/tcp || true
fuser -k 5173/tcp || true

# Symlink real codex credentials so the real Codex CLI can authenticate under the isolated HOME
mkdir -p tmp/e2e_env/.codex
ln -sf /home/locdt/.codex/auth.json tmp/e2e_env/.codex/auth.json
ln -sf /home/locdt/.codex/config.toml tmp/e2e_env/.codex/config.toml
ln -sf /home/locdt/.codex/version.json tmp/e2e_env/.codex/version.json
if [ -d "/home/locdt/.codex/skills" ]; then ln -sf /home/locdt/.codex/skills tmp/e2e_env/.codex/skills; fi
if [ -d "/home/locdt/.codex/rules" ]; then ln -sf /home/locdt/.codex/rules tmp/e2e_env/.codex/rules; fi
mkdir -p tmp/e2e_env/.codex/sessions

echo "=== [2/5] Starting Backend & Frontend servers ==="
HOME=$(pwd)/tmp/e2e_env \
OMNI_AGENT_CLAUDE_BIN=$(pwd)/backend/tests/fixtures/mock-agent.sh \
OMNI_AGENT_CODEX_BIN=/home/locdt/.nvm/versions/node/v22.17.1/bin/codex \
MOCK_AGENT_SESSION_ID=e2e-session-uuid-123 \
MOCK_AGENT_SLEEP_SECS=2 \
OMNI_AGENT_CODEX_SESSIONS_DIR=$(pwd)/tmp/e2e_env/.codex/sessions \
./backend/target/debug/omni-agent-backend > tmp/backend_e2e.log 2>&1 &
BACKEND_PID=$!

npm --prefix frontend run dev > tmp/frontend_e2e.log 2>&1 &
FRONTEND_PID=$!

# Wait for servers online
for i in {1..15}; do
  if curl -s http://127.0.0.1:8080/health >/dev/null && curl -s http://localhost:5173/ >/dev/null; then
    echo "Both servers are online!"
    break
  fi
  echo "Waiting for servers..."
  sleep 1
done

echo "=== [3/5] Running Playwright E2E Test ==="
# cd to e2e directory to avoid playwright scanning frontend/src Vitest files
(cd e2e && E2E_WORKSPACE_PATH=$(pwd)/../tmp/e2e_workspace npx playwright test)

echo "=== [4/5] Collecting SQLite Database Evidence ==="
python3 -c "
import sqlite3
import json

db_path = 'tmp/e2e_env/.omni-agent/omni-agent.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print('\n--- PROJECTS TABLE ---')
cur.execute('SELECT id, name, key, workspace_path FROM projects')
for r in cur.fetchall():
    print(dict(r))

print('\n--- TASKS TABLE ---')
cur.execute('SELECT id, title, agent, role, status FROM tasks')
for r in cur.fetchall():
    print(dict(r))

print('\n--- SESSIONS TABLE ---')
cur.execute('SELECT id, task_id, agent, session_id, status FROM sessions')
for r in cur.fetchall():
    print(dict(r))

print('\n--- RUNS TABLE (The evidence of Resume) ---')
cur.execute('SELECT id, session_id, run_number, input, exit_code FROM runs ORDER BY run_number ASC')
for r in cur.fetchall():
    print(dict(r))

print('\n--- COMMENTS TABLE ---')
cur.execute('SELECT id, task_id, content, sent FROM comments')
for r in cur.fetchall():
    print(dict(r))
"

echo "=== [5/5] Cleaning up background servers ==="
kill $BACKEND_PID || true
kill $FRONTEND_PID || true
fuser -k 8080/tcp || true
fuser -k 5173/tcp || true

echo "Done!"
