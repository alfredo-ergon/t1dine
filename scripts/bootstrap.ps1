$ErrorActionPreference = "Stop"

Write-Host "Validating T1Dine bootstrap..."
python scripts/validate_repo.py

Write-Host "Checking required tools..."
$tools = @("git", "node", "pnpm", "python", "docker", "az", "claude")
foreach ($tool in $tools) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Write-Warning "$tool is not installed or not on PATH"
  }
}

Write-Host "Run: claude --permission-mode plan"
Write-Host "Then paste prompts/00-initial-plan-mode.md"
