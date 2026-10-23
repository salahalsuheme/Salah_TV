# Build web app + IPK; output Salah_Tv.ipk
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
python src/build.py
$webos = Join-Path $root 'webos'
$assetRoot = Join-Path $webos 'assets'
if (Test-Path $assetRoot) { Remove-Item $assetRoot -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $assetRoot 'fonts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $assetRoot 'backgrounds') -Force | Out-Null
Copy-Item (Join-Path $root 'assets\fonts\*.woff2') (Join-Path $assetRoot 'fonts') -Force
Copy-Item (Join-Path $root 'assets\backgrounds\*') (Join-Path $assetRoot 'backgrounds') -Force
Copy-Item (Join-Path $root 'dist\webos.html') (Join-Path $webos 'index.html') -Force
Set-Location $webos
npx ares-package . --no-minify -o build
$built = Get-ChildItem build\com.salahalsuheme.salahtv_*_all.ipk | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $built) { throw 'IPK not built' }
Copy-Item $built.FullName build\Salah_Tv.ipk -Force
Copy-Item $built.FullName "$env:USERPROFILE\Downloads\Salah_Tv.ipk" -Force
Write-Host "OK: $($built.Name) -> build\Salah_Tv.ipk"
