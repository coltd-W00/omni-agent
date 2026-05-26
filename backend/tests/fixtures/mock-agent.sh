#!/usr/bin/env bash
# Mock agent binary for integration tests.
# Reads env vars:
#   MOCK_AGENT_SESSION_ID  — session ID to emit (default: mock-sess-12345678-1234-1234-1234-123456789abc)
#   MOCK_AGENT_DELAY_MS    — milliseconds to wait before emitting session ID line (default: 50)
#   MOCK_AGENT_SLEEP_SECS  — seconds to sleep after emitting (keeps subprocess alive, default: 30)
#   MOCK_AGENT_NO_OUTPUT   — if set to "1", emit no output at all (for timeout test)
#   MOCK_AGENT_PRINT_CWD   — if set to "1", emit cwd before session ID
set -e

SID="${MOCK_AGENT_SESSION_ID:-mock-sess-12345678-1234-1234-1234-123456789abc}"
DELAY_BEFORE_ID="${MOCK_AGENT_DELAY_MS:-50}"
SLEEP_AFTER="${MOCK_AGENT_SLEEP_SECS:-30}"
NO_OUTPUT="${MOCK_AGENT_NO_OUTPUT:-0}"
PRINT_CWD="${MOCK_AGENT_PRINT_CWD:-0}"

if [ "$NO_OUTPUT" = "1" ]; then
    sleep "$SLEEP_AFTER"
    exit 0
fi

# Wait DELAY_BEFORE_ID ms before emitting session ID
if [ "$DELAY_BEFORE_ID" -gt 0 ]; then
    python3 -c "import time; time.sleep($DELAY_BEFORE_ID / 1000.0)" 2>/dev/null || sleep 0
fi

if [ "$PRINT_CWD" = "1" ]; then
    echo "cwd=$(pwd)"
fi

echo "{\"session_id\":\"$SID\",\"type\":\"start\"}"

# Keep process alive for the integration test duration
sleep "$SLEEP_AFTER"
