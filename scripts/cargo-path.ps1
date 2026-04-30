$ErrorActionPreference = "Stop"
$msvcVersions = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
if (Test-Path $msvcVersions) {
  $linkDir = Get-ChildItem $msvcVersions -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 |
    ForEach-Object { Join-Path $_.FullName "bin\Hostx64\x64" }
  if ($linkDir -and (Test-Path (Join-Path $linkDir "link.exe"))) {
    $env:Path = "$linkDir;$env:Path"
  }
}
$env:Path = ($env:Path -split ';' | Where-Object { $_ -and $_ -notmatch '[\\/]Git[\\/]usr[\\/]bin' }) -join ';'
$cargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
if (-not (Test-Path $cargo)) { $cargo = "cargo" }
& $cargo @args
exit $LASTEXITCODE
