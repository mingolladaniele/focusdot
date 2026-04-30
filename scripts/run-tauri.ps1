$ErrorActionPreference = "Stop"
. "$PSScriptRoot\rust-path.ps1"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriJs = Join-Path $root "node_modules\@tauri-apps\cli\tauri.js"
if (-not (Test-Path $tauriJs)) {
  Write-Error "Run npm install first (missing @tauri-apps/cli)."
  exit 1
}

& node $tauriJs @args
exit $LASTEXITCODE
