#!/usr/bin/env bash
# E2E test script for Omni-Agent

set -eo pipefail

API_URL="http://127.0.0.1:8080/api"
HEALTH_URL="http://127.0.0.1:8080/health"

echo "=== [1/9] Checking if backend server is online... ==="
# Wait up to 10 seconds for backend to start
for i in {1..15}; do
  if curl -s "$HEALTH_URL" | grep -q '"status":"ok"'; then
    echo "Backend is online!"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "Error: Backend server did not start in time."
    exit 1
  fi
  echo "Waiting for server to listen on port 8080..."
  sleep 1
done

WORKSPACE_PATH="$(pwd)/tmp/e2e_workspace"

echo "=== [2/9] Creating Project... ==="
PROJECT_JSON=$(curl -s -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"E2E Test Project\", \"key\": \"E2EP\", \"workspacePath\": \"$WORKSPACE_PATH\"}")

echo "Project response: $PROJECT_JSON"
PROJECT_ID=$(echo "$PROJECT_JSON" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Failed to create project or extract project_id."
  exit 1
fi
echo "Created Project ID: $PROJECT_ID"

echo "=== [3/9] Creating Task... ==="
TASK_JSON=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "E2E Task Title", "description": "Testing create, start and resume", "agent": "claude", "role": "coder"}')

echo "Task response: $TASK_JSON"
TASK_ID=$(echo "$TASK_JSON" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
  echo "Error: Failed to create task or extract task_id."
  exit 1
fi
echo "Created Task ID: $TASK_ID"

echo "=== [4/9] Assigning Agent... ==="
ASSIGN_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"agent": "claude", "role": "coder"}')
echo "Assign response: $ASSIGN_RESPONSE"

echo "=== [5/9] Starting Session... ==="
START_JSON=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/sessions/start" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Start session response: $START_JSON"
SESSION_PK=$(echo "$START_JSON" | grep -o '"sessionPk":"[^"]*' | head -n 1 | cut -d'"' -f4)
if [ -z "$SESSION_PK" ]; then
  echo "Error: Failed to start session or extract sessionPk."
  exit 1
fi
echo "Session PK: $SESSION_PK"

echo "=== [6/9] Verifying Task is Running... ==="
TASK_STATUS_JSON=$(curl -s "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID")
echo "Task status response: $TASK_STATUS_JSON"
TASK_STATUS=$(echo "$TASK_STATUS_JSON" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)
if [ "$TASK_STATUS" != "running" ]; then
  echo "Error: Task status should be 'running' but got '$TASK_STATUS'"
  exit 1
fi
echo "Success: Task status is running!"

echo "=== [7/9] Waiting for subprocess to exit (2s sleep + 1.5s buffer)... ==="
sleep 3.5

echo "=== [8/9] Verifying Task auto-paused after subprocess exit... ==="
TASK_STATUS_JSON=$(curl -s "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID")
echo "Task status response: $TASK_STATUS_JSON"
TASK_STATUS=$(echo "$TASK_STATUS_JSON" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)
if [ "$TASK_STATUS" != "paused" ]; then
  echo "Error: Task status should be 'paused' but got '$TASK_STATUS'"
  exit 1
fi
echo "Success: Task is automatically Paused!"

echo "=== [9/9] Resuming Session... ==="
RESUME_JSON=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/sessions/resume" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Resume this E2E task"}')
echo "Resume session response: $RESUME_JSON"
RUN_NUMBER=$(echo "$RESUME_JSON" | grep -o '"runNumber":[0-9]*' | head -n 1 | cut -d':' -f2)

if [ "$RUN_NUMBER" != "2" ]; then
  echo "Error: Expected runNumber to be 2 but got '$RUN_NUMBER'"
  exit 1
fi

echo "Verifying Task is Running again after resume..."
TASK_STATUS_JSON=$(curl -s "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID")
echo "Task status response: $TASK_STATUS_JSON"
TASK_STATUS=$(echo "$TASK_STATUS_JSON" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)
if [ "$TASK_STATUS" != "running" ]; then
  echo "Error: Task status should be 'running' after resume but got '$TASK_STATUS'"
  exit 1
fi
echo "Success: Task is running again!"

# Clean up wait time for the resumed run
echo "Waiting for resumed run to complete (3.5s)..."
sleep 3.5

TASK_STATUS_JSON=$(curl -s "$API_URL/projects/$PROJECT_ID/tasks/$TASK_ID")
TASK_STATUS=$(echo "$TASK_STATUS_JSON" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)
echo "Final Task status: $TASK_STATUS"

if [ "$TASK_STATUS" != "paused" ]; then
  echo "Error: Resumed task status should auto-pause again but got '$TASK_STATUS'"
  exit 1
fi

echo "======================================"
echo "   E2E INTEGRATION TEST SUCCESSFUL!   "
echo "======================================"
exit 0
