# Waits for rooted SSH (port 22) then runs install-salah-as-home.js
$ipkScript = Join-Path $PSScriptRoot 'install-salah-as-home.js'
$tvHost = '192.168.1.2'
$maxMin = 120
for ($i = 0; $i -lt ($maxMin * 6); $i++) {
  if ((Test-NetConnection $tvHost -Port 22 -WarningAction SilentlyContinue).TcpTestSucceeded) {
    Write-Host "$(Get-Date -Format o) SSH open - installing homehook"
    Push-Location "$env:TEMP\tv-ssh"
    node $ipkScript
    $code = $LASTEXITCODE
    Pop-Location
    exit $code
  }
  if ($i % 6 -eq 0) {
    $elapsed = [int]($i / 6)
    Write-Host ('{0} waiting for SSH on {1} port 22 ({2}/{3} min)' -f (Get-Date -Format o), $tvHost, $elapsed, $maxMin)
  }
  Start-Sleep -Seconds 10
}
Write-Host ('SSH still closed after {0} minutes' -f $maxMin)
exit 1
