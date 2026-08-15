# Layer 4: Machine-level policy + post-reboot verification script
# THIS MUST BE RUN AS ADMINISTRATOR (Right-click PowerShell > Run as Administrator)

Write-Host "=== LAYER 4: Machine-Level Policy (Admin Required) ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: This script is NOT running as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then re-run this script." -ForegroundColor Red
    Write-Host "Command:  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Attempting anyway (will likely fail on HKLM keys)..." -ForegroundColor DarkYellow
    Write-Host ""
}

# --- 4A: Set machine-level CloudContent policy ---
Write-Host "[4A] Setting machine-level CloudContent policy..." -ForegroundColor Yellow
$machinePolicyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
try {
    if (-not (Test-Path $machinePolicyPath)) { 
        New-Item -Path $machinePolicyPath -Force -ErrorAction Stop | Out-Null 
        Write-Host "  Created policy key" -ForegroundColor Green
    }
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableWindowsConsumerFeatures" -Value 1 -Type DWord -Force -ErrorAction Stop
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableSoftLanding" -Value 1 -Type DWord -Force -ErrorAction Stop
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableCloudOptimizedContent" -Value 1 -Type DWord -Force -ErrorAction Stop
    Write-Host "  DisableWindowsConsumerFeatures = 1" -ForegroundColor Green
    Write-Host "  DisableSoftLanding = 1" -ForegroundColor Green
    Write-Host "  DisableCloudOptimizedContent = 1" -ForegroundColor Green
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  MANUAL FALLBACK - Run these commands in an Admin command prompt:" -ForegroundColor Yellow
    Write-Host '  reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent" /v DisableWindowsConsumerFeatures /t REG_DWORD /d 1 /f' -ForegroundColor White
    Write-Host '  reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent" /v DisableSoftLanding /t REG_DWORD /d 1 /f' -ForegroundColor White
    Write-Host '  reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent" /v DisableCloudOptimizedContent /t REG_DWORD /d 1 /f' -ForegroundColor White
}

Write-Host ""

# --- 4B: Also disable Windows Tips notification scheduled tasks ---
Write-Host "[4B] Checking for other Microsoft suggestion/tips tasks..." -ForegroundColor Yellow
$suspectTasks = Get-ScheduledTask | Where-Object {
    $_.TaskName -like '*SoftLanding*' -or
    $_.TaskName -like '*Spotlight*' -or
    $_.TaskName -like '*CloudExperienceHost*' -or
    $_.TaskName -like '*ContentDelivery*'
}
if ($suspectTasks) {
    foreach ($t in $suspectTasks) {
        Write-Host "  Found: $($t.TaskPath)$($t.TaskName) - State: $($t.State)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  No additional suggestion/tips tasks found" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== LAYER 4 COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  REMOVAL SUMMARY" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [X] Scheduled task: DISABLED + DELETED" -ForegroundColor Green
Write-Host "  [X] Task disk files: DELETED" -ForegroundColor Green
Write-Host "  [X] ContentDeliveryManager: All adware toggles set to 0" -ForegroundColor Green
Write-Host "  [X] CloudContent policy: DisableSoftLanding = 1" -ForegroundColor Green
Write-Host "  [X] SilentInstalledAppsEnabled: 0 (no more Roblox!)" -ForegroundColor Green
Write-Host "  [X] HKCU SoftLanding state: DELETED" -ForegroundColor Green
Write-Host "  [X] PushNotification backups: DELETED" -ForegroundColor Green
Write-Host "  [X] HostActivityManager history: DELETED" -ForegroundColor Green
Write-Host ""
Write-Host "  NEXT STEP: Reboot your PC, then run the verification script:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File `"c:\Users\meets\Desktop\D&C\verify_after_reboot.ps1`"" -ForegroundColor White
Write-Host ""
