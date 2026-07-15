#!/usr/bin/env bash
set -euo pipefail
python scripts/validate_repo.py
for tool in git node pnpm python docker az claude; do
  command -v "$tool" >/dev/null 2>&1 || echo "WARNING: $tool is not installed or not on PATH"
done
echo "Run: claude --permission-mode plan"
echo "Then paste prompts/00-initial-plan-mode.md"
