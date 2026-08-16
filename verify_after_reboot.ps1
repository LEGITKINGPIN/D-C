# Post-Reboot Verification Script
# Run this AFTER rebooting to confirm SoftLanding is fully removed

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  POST-REBOOT VERIFICATION" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$issues = 0

# 1. Check scheduled tasks
Write-Host "[1/6] Checking scheduled tasks..." -ForegroundColor Yellow
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -like '*SoftLanding*' -or $_.TaskPath -like '*SoftLanding*' }
if ($tasks) {
    Write-Host "  FAIL: SoftLanding task has been recreated!" -ForegroundColor Red
    $tasks | Format-Table TaskName, TaskPath, State -AutoSize
    $issues++
} else {
    Write-Host "  PASS: No SoftLanding scheduled tasks" -ForegroundColor Green
}

# 2. Check Task Scheduler folder on disk
Write-Host "[2/6] Checking task folder on disk..." -ForegroundColor Yellow
if (Test-Path "C:\Windows\System32\Tasks\SoftLanding") {
    Write-Host "  FAIL: SoftLanding folder still exists on disk!" -ForegroundColor Red
    Get-ChildItem "C:\Windows\System32\Tasks\SoftLanding" -Recurse -Force -ErrorAction SilentlyContinue
    $issues++
} else {
    Write-Host "  PASS: No SoftLanding folder on disk" -ForegroundColor Green
}

# 3. Check HKCU SoftLanding state
Write-Host "[3/6] Checking HKCU SoftLanding state key..." -ForegroundColor Yellow
if (Test-Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SoftLanding") {
    Write-Host "  WARN: SoftLanding state key has been recreated" -ForegroundColor Yellow
    Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SoftLanding" -ErrorAction SilentlyContinue | Format-List
    $issues++
} else {
    Write-Host "  PASS: No SoftLanding state key" -ForegroundColor Green
}

# 4. Verify ContentDeliveryManager settings
Write-Host "[4/6] Verifying ContentDeliveryManager settings..." -ForegroundColor Yellow
$cdmPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
$criticalSettings = @{
    "SoftLandingEnabled" = 0
    "SilentInstalledAppsEnabled" = 0
    "ContentDeliveryAllowed" = 0
    "SystemPaneSuggestionsEnabled" = 0
    "SubscribedContent-338389Enabled" = 0
}
foreach ($name in $criticalSettings.Keys) {
    $val = (Get-ItemProperty $cdmPath -Name $name -ErrorAction SilentlyContinue).$name
    $expected = $criticalSettings[$name]
    if ($val -eq $expected) {
        Write-Host "  PASS: $name = $val" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: $name = $val (expected $expected)" -ForegroundColor Red
        $issues++
    }
}

# 5. Verify policy keys
Write-Host "[5/6] Verifying CloudContent policy..." -ForegroundColor Yellow
$policyPath = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
if (Test-Path $policyPath) {
    $dsl = (Get-ItemProperty $policyPath -Name "DisableSoftLanding" -ErrorAction SilentlyContinue).DisableSoftLanding
    if ($dsl -eq 1) {
        Write-Host "  PASS: DisableSoftLanding policy = 1" -ForegroundColor Green
    } else {
        Write-Host "  WARN: DisableSoftLanding = $dsl" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARN: HKCU CloudContent policy path doesn't exist" -ForegroundColor Yellow
}

# Also check machine policy
$machinePolicyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
if (Test-Path $machinePolicyPath) {
    $dsl = (Get-ItemProperty $machinePolicyPath -Name "DisableSoftLanding" -ErrorAction SilentlyContinue).DisableSoftLanding
    Write-Host "  Machine policy DisableSoftLanding = $dsl" -ForegroundColor $(if ($dsl -eq 1) { "Green" } else { "Yellow" })
} else {
    Write-Host "  INFO: Machine-level policy not set (optional, user-level is sufficient)" -ForegroundColor DarkYellow
}

# 6. Check for running SoftLanding processes
Write-Host "[6/6] Checking for SoftLanding-related processes..." -ForegroundColor Yellow
$procs = Get-Process | Where-Object { $_.ProcessName -like '*SoftLanding*' }
if ($procs) {
    Write-Host "  WARN: SoftLanding process found running!" -ForegroundColor Red
    $procs | Format-Table Id, ProcessName, Path -AutoSize
    $issues++
} else {
    Write-Host "  PASS: No SoftLanding processes running" -ForegroundColor Green
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
if ($issues -eq 0) {
    Write-Host "  ALL CHECKS PASSED! SoftLanding is GONE!" -ForegroundColor Green
    Write-Host "  Your PC should no longer open random websites" -ForegroundColor Green
    Write-Host "  or silently install apps like Roblox." -ForegroundColor Green
} else {
    Write-Host "  $issues issue(s) found. See details above." -ForegroundColor Red
    Write-Host "  If tasks were recreated, re-run the removal scripts." -ForegroundColor Yellow
}
Write-Host "=============================================" -ForegroundColor Cyan
