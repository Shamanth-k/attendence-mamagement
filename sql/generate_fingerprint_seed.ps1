param(
  [string[]]$ReportFiles = @(
    "C:\Users\LENOVO\Downloads\Large_Attendance_Dataset (1).xlsx"
  ),
  [string]$OutputPath = ".\sql\fingerprint_seed.sql"
)

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$employees = @{}
$attendance = @{}

function Esc([string]$text) {
  if ($null -eq $text) { return "" }
  return $text.Replace("'", "''")
}

function To-HHMM([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  $trimmed = $text.Trim()
  $m = [regex]::Match($trimmed, "\b(\d{1,2}:\d{2})\b")
  if (-not $m.Success) { return $null }
  $parts = $m.Groups[1].Value.Split(":")
  $h = [int]$parts[0]
  $mm = [int]$parts[1]
  return ("{0:D2}:{1:D2}" -f $h, $mm)
}

function To-DateString($value) {
  if ($null -eq $value) { return $null }
  try {
    $dt = [datetime]$value
    return $dt.ToString("yyyy-MM-dd")
  } catch {
    $text = "$value".Trim()
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    try {
      return ([datetime]::Parse($text)).ToString("yyyy-MM-dd")
    } catch {
      return $null
    }
  }
}

function Upsert-AttendanceRecord($empId, $date, $inTime, $outTime, $statusText) {
  $key = "$empId|$date"
  $statusSafe = if ($null -eq $statusText) { "" } else { "$statusText" }
  $normalizedStatus = if ($statusSafe.Trim().ToUpper() -eq "PRESENT" -or $inTime -or $outTime) { "PRESENT" } else { "ABSENT" }
  if (-not $attendance.ContainsKey($key)) {
    $attendance[$key] = [PSCustomObject]@{
      emp_id = [int]$empId
      date = $date
      in_time = $inTime
      out_time = $outTime
      status = $normalizedStatus
    }
    return
  }

  # Prefer rows that contain actual punch times.
  if ($inTime) { $attendance[$key].in_time = $inTime }
  if ($outTime) { $attendance[$key].out_time = $outTime }
  if ($attendance[$key].in_time -or $attendance[$key].out_time) {
    $attendance[$key].status = "PRESENT"
  } else {
    $attendance[$key].status = $normalizedStatus
  }
}

try {
  foreach ($file in $ReportFiles) {
    if (-not (Test-Path $file)) { continue }
    $wb = $excel.Workbooks.Open($file)
    foreach ($ws in $wb.Worksheets) {
      $used = $ws.UsedRange
      $rows = $used.Rows.Count
      $cols = $used.Columns.Count
      if ($rows -lt 2 -or $cols -lt 9) { continue }

      $h1 = ($ws.Cells.Item(1, 1).Text).Trim()
      $h2 = ($ws.Cells.Item(1, 2).Text).Trim()
      $h5 = ($ws.Cells.Item(1, 5).Text).Trim()
      if ($h1 -ne "Employee_ID" -or $h2 -ne "Employee_Name" -or $h5 -ne "Date") { continue }

      for ($r = 2; $r -le $rows; $r++) {
        $empIdRaw = ($ws.Cells.Item($r, 1).Value2)
        $empName = ($ws.Cells.Item($r, 2).Text).Trim()
        $dateRaw = ($ws.Cells.Item($r, 5).Value2)
        $checkIn = To-HHMM (($ws.Cells.Item($r, 7).Text).Trim())
        $checkOut = To-HHMM (($ws.Cells.Item($r, 8).Text).Trim())
        $status = ($ws.Cells.Item($r, 9).Text).Trim()

        if ($null -eq $empIdRaw -or [string]::IsNullOrWhiteSpace("$empIdRaw")) { continue }
        $empId = [int]$empIdRaw
        if ($empId -le 0) { continue }
        if ([string]::IsNullOrWhiteSpace($empName)) { $empName = "Employee_$empId" }
        $date = To-DateString $dateRaw
        if (-not $date) { continue }

        if (-not $employees.ContainsKey("$empId")) {
          $employees["$empId"] = [PSCustomObject]@{
            id = $empId
            code = ("EMP-{0:D4}" -f $empId)
            name = $empName
          }
        }

        Upsert-AttendanceRecord $empId $date $checkIn $checkOut $status
      }
    }
    $wb.Close($false)
  }
}
finally {
  $excel.Quit() | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$empRows = $employees.Values | Sort-Object id
$attRows = $attendance.Values | Sort-Object emp_id, date

$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine("-- Generated from attendance dataset")
$null = $sb.AppendLine("SET FOREIGN_KEY_CHECKS = 0;")
$null = $sb.AppendLine("DELETE FROM password_reset_tokens;")
$null = $sb.AppendLine("DELETE FROM attendance_alerts;")
$null = $sb.AppendLine("DELETE FROM attendance_logs;")
$null = $sb.AppendLine("DELETE FROM biometric_events;")
$null = $sb.AppendLine("DELETE FROM app_usage_logs;")
$null = $sb.AppendLine("DELETE FROM users WHERE role = 'EMPLOYEE';")
$null = $sb.AppendLine("DELETE FROM employees;")
$null = $sb.AppendLine("ALTER TABLE employees AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("ALTER TABLE attendance_logs AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("ALTER TABLE biometric_events AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("ALTER TABLE attendance_alerts AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("ALTER TABLE app_usage_logs AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("ALTER TABLE password_reset_tokens AUTO_INCREMENT = 1;")
$null = $sb.AppendLine("SET FOREIGN_KEY_CHECKS = 1;")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("INSERT INTO employees(id, employee_code, full_name, section_id) VALUES")

for ($i = 0; $i -lt $empRows.Count; $i++) {
  $e = $empRows[$i]
  $line = "($($e.id), '$($e.code)', '$([string](Esc $e.name))', NULL)"
  if ($i -lt $empRows.Count - 1) { $line += "," } else { $line += ";" }
  $null = $sb.AppendLine($line)
}

$null = $sb.AppendLine("")
$null = $sb.AppendLine("-- Seed EMPLOYEE login users (default password: employee123)")
$null = $sb.AppendLine("-- hash = scryptSync('employee123', 'c2b3dbf378749be231db56f71f8f14d0', 64).toString('hex')")
$null = $sb.AppendLine("INSERT INTO users(employee_id, username, role, password_salt, password_hash, is_first_login, is_active)")
$null = $sb.AppendLine("SELECT")
$null = $sb.AppendLine("  e.id,")
$null = $sb.AppendLine("  LOWER(REPLACE(e.employee_code, '-', '')),")
$null = $sb.AppendLine("  'EMPLOYEE',")
$null = $sb.AppendLine("  'c2b3dbf378749be231db56f71f8f14d0',")
$null = $sb.AppendLine("  '965269a5bd9c015043d5fe222917f8d4d1d25037da441de6a3b0c4819ce061d12dbfea40e4033316d05600a9dc498ad7705658f2231623c56da1db0fd4568f73',")
$null = $sb.AppendLine("  1,")
$null = $sb.AppendLine("  1")
$null = $sb.AppendLine("FROM employees e;")

$null = $sb.AppendLine("")
$null = $sb.AppendLine("INSERT INTO attendance_logs(employee_id, attendance_date, in_time, out_time, break_start, break_end, work_minutes, idle_minutes, status) VALUES")

for ($i = 0; $i -lt $attRows.Count; $i++) {
  $r = $attRows[$i]
  $inSql = if ($r.in_time) { "'$($r.in_time)'" } else { "NULL" }
  $outSql = if ($r.out_time) { "'$($r.out_time)'" } else { "NULL" }
  $work = 0
  if ($r.in_time -and $r.out_time) {
    $ins = [TimeSpan]::Parse($r.in_time)
    $outs = [TimeSpan]::Parse($r.out_time)
    $mins = [int](($outs - $ins).TotalMinutes)
    if ($mins -lt 0) { $mins += 24 * 60 }
    $work = $mins
  }
  $line = "($($r.emp_id), '$($r.date)', $inSql, $outSql, NULL, NULL, $work, 0, '$($r.status)')"
  if ($i -lt $attRows.Count - 1) { $line += "," } else { $line += ";" }
  $null = $sb.AppendLine($line)
}

$presentRows = $attRows | Where-Object { $_.in_time -or $_.out_time }
if ($presentRows.Count -gt 0) {
  $null = $sb.AppendLine("")
  $null = $sb.AppendLine("INSERT INTO biometric_events(employee_code, scanner_id, punch_type, device_timestamp, payload) VALUES")
  $events = New-Object System.Collections.Generic.List[object]
  foreach ($r in $presentRows) {
    $code = ("EMP-{0:D4}" -f [int]$r.emp_id)
    if ($r.in_time) {
      $events.Add([PSCustomObject]@{
        code = $code
        type = "IN"
        ts = "$($r.date) $($r.in_time):00"
      })
    }
    if ($r.out_time) {
      $events.Add([PSCustomObject]@{
        code = $code
        type = "OUT"
        ts = "$($r.date) $($r.out_time):00"
      })
    }
  }
  for ($i = 0; $i -lt $events.Count; $i++) {
    $ev = $events[$i]
    $line = "('$($ev.code)', 'SCANNER-01', '$($ev.type)', '$($ev.ts)', '{}')"
    if ($i -lt $events.Count - 1) { $line += "," } else { $line += ";" }
    $null = $sb.AppendLine($line)
  }
}

[System.IO.File]::WriteAllText($OutputPath, $sb.ToString())
Write-Host "Generated $OutputPath"
Write-Host "Employees: $($empRows.Count), Attendance rows: $($attRows.Count), Present rows: $($presentRows.Count)"
