# Layer 2: Delete the SoftLanding Scheduled Task + set machine policy (admin)
# This script needs to be run elevated (admin) for the HKLM policy and task deletion

Write-Host "=== LAYER 2: Delete Scheduled Task + Machine Policy ===" -ForegroundColor Cyan
Write-Host ""

# --- 2A: Set machine-level policy (retry with admin) ---
Write-Host "[2A] Setting machine-level CloudContent policy..." -ForegroundColor Yellow
$machinePolicyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
try {
    if (-not (Test-Path $machinePolicyPath)) { 
        New-Item -Path $machinePolicyPath -Force -ErrorAction Stop | Out-Null 
    }
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableWindowsConsumerFeatures" -Value 1 -Type DWord -Force -ErrorAction Stop
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableSoftLanding" -Value 1 -Type DWord -Force -ErrorAction Stop
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableCloudOptimizedContent" -Value 1 -Type DWord -Force -ErrorAction Stop
    Write-Host "  Machine-level policies SET successfully" -ForegroundColor Green
} catch {
    Write-Host "  FAILED - Run this script as Administrator!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# --- 2B: Disable the scheduled task first (safer than direct delete) ---
Write-Host "[2B] Disabling the SoftLanding scheduled task..." -ForegroundColor Yellow
try {
    $task = Get-ScheduledTask -TaskPath "\SoftLanding\*" -ErrorAction SilentlyContinue
    if ($task) {
        foreach ($t in $task) {
            Write-Host "  Disabling: $($t.TaskPath)$($t.TaskName)" -ForegroundColor Yellow
            Disable-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop
            Write-Host "  DISABLED successfully" -ForegroundColor Green
        }
    } else {
        Write-Host "  No SoftLanding tasks found via Get-ScheduledTask" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "  Error disabling task: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# --- 2C: Delete the scheduled task ---
Write-Host "[2C] Deleting the SoftLanding scheduled task..." -ForegroundColor Yellow
try {
    $task = Get-ScheduledTask -TaskPath "\SoftLanding\*" -ErrorAction SilentlyContinue
    if ($task) {
        foreach ($t in $task) {
            Write-Host "  Deleting: $($t.TaskPath)$($t.TaskName)" -ForegroundColor Yellow
            Unregister-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Confirm:$false -ErrorAction Stop
            Write-Host "  DELETED successfully" -ForegroundColor Green
        }
    } else {
        Write-Host "  No tasks to delete (already removed or not found)" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "  Error deleting task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Trying schtasks.exe fallback..." -ForegroundColor Yellow
    schtasks /Delete /TN "\SoftLanding\S-1-5-21-3924387278-2453900624-2928912579-1001\SoftLandingCreativeManagementTask" /F 2>&1
}

Write-Host ""

# --- 2D: Delete the task folder from disk ---
Write-Host "[2D] Deleting SoftLanding task folder from disk..." -ForegroundColor Yellow
$taskDiskPath = "C:\Windows\System32\Tasks\SoftLanding"
if (Test-Path $taskDiskPath) {
    try {
        Remove-Item $taskDiskPath -Recurse -Force -ErrorAction Stop
        Write-Host "  DELETED: $taskDiskPath" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Trying takeown + icacls..." -ForegroundColor Yellow
        takeown /F $taskDiskPath /R /D Y 2>&1
        icacls $taskDiskPath /grant "$env:USERNAME`:F" /T 2>&1
        Remove-Item $taskDiskPath -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $taskDiskPath)) {
            Write-Host "  DELETED after taking ownership" -ForegroundColor Green
        } else {
            Write-Host "  STILL EXISTS - may need to delete manually" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  Folder already gone: $taskDiskPath" -ForegroundColor Green
}

Write-Host ""

# --- 2E: Verify task is gone ---
Write-Host "[2E] Verifying no SoftLanding tasks remain..." -ForegroundColor Yellow
$remaining = Get-ScheduledTask | Where-Object { $_.TaskName -like '*SoftLanding*' -or $_.TaskPath -like '*SoftLanding*' }
if ($remaining) {
    Write-Host "  WARNING: Tasks still found:" -ForegroundColor Red
    $remaining | Format-Table TaskName, TaskPath, State -AutoSize
} else {
    Write-Host "  VERIFIED: No SoftLanding scheduled tasks remain!" -ForegroundColor Green
}

# Also verify via schtasks
$schtasksResult = schtasks /Query /TN "\SoftLanding\" 2>&1
if ($schtasksResult -match "ERROR|cannot find") {
    Write-Host "  VERIFIED (schtasks): SoftLanding folder is gone!" -ForegroundColor Green
} else {
    Write-Host "  schtasks output:" -ForegroundColor Yellow
    Write-Host $schtasksResult
}

Write-Host ""
Write-Host "=== LAYER 2 COMPLETE ===" -ForegroundColor Cyan
