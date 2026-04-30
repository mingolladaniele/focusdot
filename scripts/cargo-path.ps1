$ErrorActionPreference = "Stop"
. "$PSScriptRoot\rust-path.ps1"
$cargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
if (-not (Test-Path $cargo)) { $cargo = "cargo" }
& $cargo @args
exit $LASTEXITCODE
