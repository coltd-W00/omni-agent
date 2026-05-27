#!/usr/bin/env bash
set -e

if [ "$1" != "exec" ]; then
    echo "Error: stdin is not a terminal" >&2
    exit 1
fi

SID="${MOCK_AGENT_SESSION_ID:-codex-exec-session-id}"
echo "{\"session_id\":\"$SID\",\"type\":\"start\"}"
sleep "${MOCK_AGENT_SLEEP_SECS:-1}"
