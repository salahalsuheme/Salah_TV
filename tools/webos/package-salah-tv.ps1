# Build web app + IPK; output webos\build\Salah_Tv.ipk (and a copy in Downloads).
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$py = if (Get-Command python -ErrorAction SilentlyContinue) { 'python' } else { 'python3' }
& $py src/build.py --stage-webos
Set-Location (Join-Path $root 'webos')
npm exec --yes --package=@webosose/ares-cli -- ares-package . --no-minify -o build
$built = Get-ChildItem build\com.salahalsuheme.salahtv_*_all.ipk | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $built) { throw 'IPK not built' }
$out = Join-Path $root 'webos\build\Salah_Tv.ipk'
Copy-Item $built.FullName $out -Force
Copy-Item $built.FullName (Join-Path $env:USERPROFILE 'Downloads\Salah_Tv.ipk') -Force
Write-Host "OK: $($built.Name) -> $out"
