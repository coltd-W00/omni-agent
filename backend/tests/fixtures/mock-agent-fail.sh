#!/usr/bin/env bash
# Mock agent binary that exits with code 1 after printing session ID.
# Used for integration tests of non-zero exit detection.
set -e

SID="${MOCK_AGENT_SESSION_ID:-mock-sess-fail-12345678}"
DELAY_BEFORE_ID="${MOCK_AGENT_DELAY_MS:-50}"

if [ "$DELAY_BEFORE_ID" -gt 0 ]; then
    python3 -c "import time; time.sleep($DELAY_BEFORE_ID / 1000.0)" 2>/dev/null || sleep 0
fi

echo "{\"session_id\":\"$SID\",\"type\":\"start\"}"

exit 1
