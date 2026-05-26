#!/usr/bin/env bash
set -e

echo "stdout line 1"
echo "stdout line 2"
echo "stderr line A" >&2
echo "stdout line 3"
echo "stderr line B" >&2
sleep 0.1
exit 0
