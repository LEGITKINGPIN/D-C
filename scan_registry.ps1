Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  STEP 2: REGISTRY SCAN FOR SoftLanding" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# --- 2A: Trace the COM CLSID from the scheduled task ---
$clsid = "{F576B2F9-7850-4226-ADB0-E5993FED4F02}"
Write-Host "=== 2A: Tracing COM CLSID $clsid ===" -ForegroundColor Yellow

$comPaths = @(
    "HKLM:\SOFTWARE\Classes\CLSID\$clsid",
    "HKCU:\SOFTWARE\Classes\CLSID\$clsid",
    "HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\$clsid",
    "Registry::HKEY_CLASSES_ROOT\CLSID\$clsid"
)

foreach ($path in $comPaths) {
    if (Test-Path $path) {
        Write-Host "FOUND: $path" -ForegroundColor Red
        Get-ItemProperty $path -ErrorAction SilentlyContinue | Format-List
        
        # Check InprocServer32 (the DLL path)
        $inproc = "$path\InprocServer32"
        if (Test-Path $inproc) {
            Write-Host "  InprocServer32:" -ForegroundColor Red
            Get-ItemProperty $inproc -ErrorAction SilentlyContinue | Format-List
        }
        
        # Check LocalServer32 (the EXE path)
        $local = "$path\LocalServer32"
        if (Test-Path $local) {
            Write-Host "  LocalServer32:" -ForegroundColor Red
            Get-ItemProperty $local -ErrorAction SilentlyContinue | Format-List
        }
        
        # Dump all subkeys
        Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  SubKey: $($_.PSPath)" -ForegroundColor DarkYellow
            Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue | Format-List
        }
    } else {
        Write-Host "NOT FOUND: $path" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== 2B: Searching ALL registry for 'SoftLanding' ===" -ForegroundColor Yellow
Write-Host "(This searches key names and value names/data in major hives)" -ForegroundColor Gray

$hives = @(
    "HKLM:\SOFTWARE",
    "HKCU:\SOFTWARE",
    "HKLM:\SYSTEM\CurrentControlSet",
    "Registry::HKEY_CLASSES_ROOT\AppUserModelId"
)

foreach ($hive in $hives) {
    Write-Host "Searching $hive ..." -ForegroundColor Gray
    try {
        # Search key names
        Get-ChildItem $hive -Recurse -ErrorAction SilentlyContinue | Where-Object {
            $_.PSChildName -like '*SoftLanding*'
        } | ForEach-Object {
            Write-Host "  KEY MATCH: $($_.PSPath)" -ForegroundColor Red
            Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue | Format-List
        }
    } catch {}
}

Write-Host ""
Write-Host "=== 2C: Check AppUserModelId for SoftLanding ===" -ForegroundColor Yellow
$appModelPath = "Registry::HKEY_CLASSES_ROOT\AppUserModelId\Windows.SystemToast.SoftLanding"
if (Test-Path $appModelPath) {
    Write-Host "FOUND: $appModelPath" -ForegroundColor Red
    Get-ItemProperty $appModelPath -ErrorAction SilentlyContinue | Format-List
    Get-ChildItem $appModelPath -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  SubKey: $($_.PSPath)" -ForegroundColor DarkYellow
        Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue | Format-List
    }
} else {
    Write-Host "NOT FOUND: $appModelPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 2D: Check Run/RunOnce startup keys for SoftLanding ===" -ForegroundColor Yellow
$runKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce"
)

foreach ($key in $runKeys) {
    if (Test-Path $key) {
        $props = Get-ItemProperty $key -ErrorAction SilentlyContinue
        $props.PSObject.Properties | Where-Object { 
            $_.Name -like '*SoftLanding*' -or $_.Value -like '*SoftLanding*' 
        } | ForEach-Object {
            Write-Host "  STARTUP MATCH in $key" -ForegroundColor Red
            Write-Host "    Name: $($_.Name)  Value: $($_.Value)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== 2E: Quick reg query for SoftLanding in HKCR ===" -ForegroundColor Yellow
reg query "HKCR\AppUserModelId" /s /f "SoftLanding" 2>$null
