# Layer 3: Clean HKCU registry keys + retry disk folder deletion
# Also clean the user-level SoftLanding state/tracking keys

Write-Host "=== LAYER 3: Clean HKCU Registry Keys ===" -ForegroundColor Cyan
Write-Host ""

# --- 3A: Retry disk folder deletion with cmd.exe ---
Write-Host "[3A] Retry deleting SoftLanding task folder from disk..." -ForegroundColor Yellow
$taskDiskPath = "C:\Windows\System32\Tasks\SoftLanding"
if (Test-Path $taskDiskPath) {
    # Use cmd /c rd which sometimes works when PowerShell Remove-Item doesn't
    cmd /c "rd /s /q `"$taskDiskPath`"" 2>&1
    if (-not (Test-Path $taskDiskPath)) {
        Write-Host "  DELETED: $taskDiskPath" -ForegroundColor Green
    } else {
        Write-Host "  Still exists. Listing contents:" -ForegroundColor Yellow
        Get-ChildItem $taskDiskPath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "    $($_.FullName)  IsDir=$($_.PSIsContainer)  Size=$($_.Length)" -ForegroundColor DarkYellow
        }
        Write-Host "  (Empty folder may be cleaned up after reboot)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  Already gone!" -ForegroundColor Green
}

Write-Host ""

# --- 3B: Delete HKCU SoftLanding state key ---
Write-Host "[3B] Deleting HKCU\...\CurrentVersion\SoftLanding state key..." -ForegroundColor Yellow
$hkcuSL = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SoftLanding"
if (Test-Path $hkcuSL) {
    $props = Get-ItemProperty $hkcuSL -ErrorAction SilentlyContinue
    Write-Host "  Current values:" -ForegroundColor Gray
    Write-Host "    LastCourtesyRenderTime: $($props.LastCourtesyRenderTime)"
    Remove-Item $hkcuSL -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $hkcuSL)) {
        Write-Host "  DELETED" -ForegroundColor Green
    } else {
        Write-Host "  FAILED to delete" -ForegroundColor Red
    }
} else {
    Write-Host "  Already gone!" -ForegroundColor Green
}

Write-Host ""

# --- 3C: Delete HKCU PushNotifications backup keys ---
Write-Host "[3C] Cleaning PushNotifications backup entries..." -ForegroundColor Yellow
$pushBackup1 = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PushNotifications\Backup\MicrosoftWindows.Client.CBS_cw5n1h2txyewy!SoftLanding"
$pushBackup2 = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PushNotifications\Backup\Windows.SystemToast.SoftLanding"

foreach ($path in @($pushBackup1, $pushBackup2)) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $path)) {
            Write-Host "  DELETED: ...$(Split-Path $path -Leaf)" -ForegroundColor Green
        } else {
            Write-Host "  FAILED: $path" -ForegroundColor Red
        }
    } else {
        Write-Host "  Already gone: ...$(Split-Path $path -Leaf)" -ForegroundColor Green
    }
}

Write-Host ""

# --- 3D: Delete HKCU HostActivityManager commit history ---
Write-Host "[3D] Cleaning HostActivityManager commit history..." -ForegroundColor Yellow
$hamPath = "HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\HostActivityManager\CommitHistory\MicrosoftWindows.Client.CBS_cw5n1h2txyewy!SoftLanding"
if (Test-Path $hamPath) {
    Remove-Item $hamPath -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $hamPath)) {
        Write-Host "  DELETED" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "  Already gone!" -ForegroundColor Green
}

Write-Host ""

# --- 3E: Delete HKCU HAM AUI SoftLanding key ---
Write-Host "[3E] Cleaning HAM AUI SoftLanding key..." -ForegroundColor Yellow
$hamAui = "HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\MicrosoftWindows.Client.CBS_cw5n1h2txyewy\HAM\AUI\SoftLanding"
if (Test-Path $hamAui) {
    Remove-Item $hamAui -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $hamAui)) {
        Write-Host "  DELETED" -ForegroundColor Green
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "  Already gone!" -ForegroundColor Green
}

Write-Host ""

# --- 3F: Verify all ContentDeliveryManager settings are correct ---
Write-Host "[3F] Verifying ContentDeliveryManager settings..." -ForegroundColor Yellow
$cdmPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
$criticalValues = @("SoftLandingEnabled", "SilentInstalledAppsEnabled", "ContentDeliveryAllowed", "SystemPaneSuggestionsEnabled")
foreach ($name in $criticalValues) {
    $val = Get-ItemProperty $cdmPath -Name $name -ErrorAction SilentlyContinue
    if ($val) {
        $v = $val.$name
        $color = if ($v -eq 0) { "Green" } else { "Red" }
        Write-Host "  $name = $v" -ForegroundColor $color
    }
}

Write-Host ""

# --- 3G: Summary of what remains (HKLM keys we intentionally skip) ---
Write-Host "=== LAYER 3 COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "REMAINING HKLM keys (INTENTIONALLY NOT DELETED):" -ForegroundColor Yellow
Write-Host "These are system-owned Windows component keys. Deleting them" -ForegroundColor Gray
Write-Host "can corrupt the Windows component store. The policy settings" -ForegroundColor Gray
Write-Host "we applied in Layer 1 override them." -ForegroundColor Gray
Write-Host ""
Write-Host "  - HKLM\...\AppUserModelId\Windows.SystemToast.SoftLanding" -ForegroundColor DarkGray
Write-Host "  - HKLM\...\WindowsRuntime\...\SoftLandingExperience" -ForegroundColor DarkGray
Write-Host "  - HKLM\...\SideBySide\Winners\...\softlanding" -ForegroundColor DarkGray
Write-Host "  - HKLM\...\PushNotifications\...\Windows.SystemToast.SoftLanding" -ForegroundColor DarkGray
Write-Host "  - HKLM\...\Notifications\Controller\NamedToastSinks\SoftLanding" -ForegroundColor DarkGray
Write-Host ""
Write-Host "These are HARMLESS with the policy disabled." -ForegroundColor Green
