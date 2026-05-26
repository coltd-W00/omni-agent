#!/usr/bin/env bash
set -e

for i in $(seq 1 100); do
    echo "stdout noisy $i"
    sleep 0.02
done
exit 0
