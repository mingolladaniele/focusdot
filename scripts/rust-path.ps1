# Dot-source this file to fix PATH before calling cargo/tauri from npm on Windows.
# Fixes: missing cargo; Git usr\bin shadowing MSVC link.exe.

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}

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
