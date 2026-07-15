#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

payload = json.load(sys.stdin)
tool_name = payload.get("tool_name", "")
tool_input = payload.get("tool_input", {}) or {}

def decision(kind: str, reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": kind,
            "permissionDecisionReason": reason
        }
    }))
    raise SystemExit(0)

text = json.dumps(tool_input, sort_keys=True)

secret_patterns = [
    r"(^|[/\\])\.env($|[./\\])",
    r"(^|[/\\])secrets([/\\]|$)",
    r"\.pem\b", r"\.pfx\b", r"\.p12\b", r"id_rsa", r"id_ed25519"
]
if any(re.search(p, text, re.IGNORECASE) for p in secret_patterns):
    decision("deny", "Secrets and credential files are outside Claude Code access.")

if tool_name == "Bash":
    command = str(tool_input.get("command", ""))
    destructive = [
        r"\brm\s+-rf\b", r"git\s+push\s+--force", r"git\s+reset\s+--hard",
        r"terraform\s+destroy", r"az\s+group\s+delete", r"az\s+resource\s+delete",
        r"kubectl\s+delete", r"docker\s+system\s+prune"
    ]
    if any(re.search(p, command, re.IGNORECASE) for p in destructive):
        decision("deny", "Destructive commands are blocked by the project safety policy.")

if tool_name in {"Write", "Edit"}:
    path_value = tool_input.get("file_path") or tool_input.get("path") or ""
    normalized = str(Path(path_value)).replace("\\", "/")
    clinical_paths = ("packages/dose-engine/", "docs/clinical/")
    if any(part in normalized for part in clinical_paths):
        if os.getenv("T1DINE_CLINICAL_EDIT", "0") != "1":
            decision(
                "ask",
                "This changes the clinical boundary or deterministic dose engine. Set T1DINE_CLINICAL_EDIT=1 only after explicit human approval and a linked hazard or requirement update."
            )

# No output means the normal permission flow continues.
