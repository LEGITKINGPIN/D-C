# Layer 1: Disable SoftLanding via Settings & Policy Registry Keys
# These are the RECOMMENDED way to stop this behavior permanently.
# All changes are in HKCU (user-level, no admin needed for most)

Write-Host "=== LAYER 1: Disabling SoftLanding via Settings & Policy ===" -ForegroundColor Cyan
Write-Host ""

# --- 1A: Disable "Get tips, tricks, and suggestions as you use Windows" ---
Write-Host "[1A] Disabling Tips & Suggestions..." -ForegroundColor Yellow
$path1 = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
if (-not (Test-Path $path1)) { New-Item -Path $path1 -Force | Out-Null }

# These are all the ContentDeliveryManager values that control SoftLanding/ads
$cdmValues = @{
    "SoftLandingEnabled"                = 0   # The main SoftLanding toggle
    "SubscribedContent-310093Enabled"   = 0   # "Welcome Experience" after updates
    "SubscribedContent-338389Enabled"   = 0   # "Suggest ways to get the most out of Windows"
    "SubscribedContent-338388Enabled"   = 0   # Start menu suggestions
    "SubscribedContent-338393Enabled"   = 0   # Suggested content in Settings
    "SubscribedContent-353698Enabled"   = 0   # Timeline suggestions
    "SubscribedContent-353694Enabled"   = 0   # Suggested content in Settings
    "SubscribedContent-353696Enabled"   = 0   # Suggested content in Settings
    "SubscribedContent-88000326Enabled" = 0   # Start menu app suggestions
    "SystemPaneSuggestionsEnabled"      = 0   # Start menu system pane suggestions
    "OemPreInstalledAppsEnabled"        = 0   # Pre-installed OEM apps
    "PreInstalledAppsEnabled"           = 0   # Pre-installed apps
    "PreInstalledAppsEverEnabled"       = 0   # Pre-installed apps ever
    "SilentInstalledAppsEnabled"        = 0   # Silently installed apps (like Roblox!)
    "ContentDeliveryAllowed"            = 0   # Master switch for content delivery
    "FeatureManagementEnabled"          = 0   # Feature management
    "RotatingLockScreenEnabled"         = 0   # Lock screen spotlight
    "RotatingLockScreenOverlayEnabled"  = 0   # Lock screen overlay
}

foreach ($name in $cdmValues.Keys) {
    $current = Get-ItemProperty -Path $path1 -Name $name -ErrorAction SilentlyContinue
    $currentVal = if ($current) { $current.$name } else { "(not set)" }
    Set-ItemProperty -Path $path1 -Name $name -Value $cdmValues[$name] -Type DWord -Force
    Write-Host "  SET $name = 0  (was: $currentVal)" -ForegroundColor Green
}

Write-Host ""

# --- 1B: Disable Windows Spotlight ---
Write-Host "[1B] Disabling Windows Spotlight..." -ForegroundColor Yellow
$spotlightPath = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
if (-not (Test-Path $spotlightPath)) { New-Item -Path $spotlightPath -Force | Out-Null }

$spotlightValues = @{
    "DisableWindowsConsumerFeatures" = 1   # Disable consumer features
    "DisableSoftLanding"             = 1   # Directly disable SoftLanding!
    "DisableCloudOptimizedContent"   = 1   # Disable cloud content
    "DisableTailoredExperiencesWithDiagnosticData" = 1
}

foreach ($name in $spotlightValues.Keys) {
    $current = Get-ItemProperty -Path $spotlightPath -Name $name -ErrorAction SilentlyContinue
    $currentVal = if ($current) { $current.$name } else { "(not set)" }
    Set-ItemProperty -Path $spotlightPath -Name $name -Value $spotlightValues[$name] -Type DWord -Force
    Write-Host "  SET $name = 1  (was: $currentVal)" -ForegroundColor Green
}

# Also set machine-level policy (needs admin)
Write-Host ""
Write-Host "[1C] Setting machine-level policy (requires admin)..." -ForegroundColor Yellow
$machinePolicyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
try {
    if (-not (Test-Path $machinePolicyPath)) { New-Item -Path $machinePolicyPath -Force | Out-Null }
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableWindowsConsumerFeatures" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableSoftLanding" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path $machinePolicyPath -Name "DisableCloudOptimizedContent" -Value 1 -Type DWord -Force
    Write-Host "  Machine-level policies SET successfully" -ForegroundColor Green
} catch {
    Write-Host "  Could not set machine-level policies (may need elevated/admin PowerShell)" -ForegroundColor DarkYellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=== LAYER 1 COMPLETE ===" -ForegroundColor Cyan
Write-Host "All suggestions/tips/SoftLanding features have been DISABLED via registry policy." -ForegroundColor Green
Write-Host ""
Write-Host "VERIFICATION:" -ForegroundColor Yellow
Write-Host "  SoftLandingEnabled:" 
Get-ItemProperty $path1 -Name "SoftLandingEnabled" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty SoftLandingEnabled
Write-Host "  DisableSoftLanding (policy):"
Get-ItemProperty $spotlightPath -Name "DisableSoftLanding" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DisableSoftLanding
