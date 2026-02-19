$ports = @(3001, 5173)
$processes = @()

foreach ($port in $ports) {
  $owners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  if ($owners) {
    $processes += $owners
  }
}

$processes = $processes |
  Where-Object { $_ -and $_ -ne $PID } |
  Select-Object -Unique

if (-not $processes) {
  Write-Output "No running dev processes found on ports 3001 or 5173."
  exit 0
}

foreach ($processId in $processes) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Output "Stopped process $processId"
  } catch {
    Write-Output "Failed to stop process ${processId}: $($_.Exception.Message)"
  }
}
