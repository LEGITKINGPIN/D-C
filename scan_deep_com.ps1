# Deep COM CLSID search for the malware handler
$clsid = "{F576B2F9-7850-4226-ADB0-E5993FED4F02}"
$clsid2 = "{F751293B-DC01-468D-925C-2B3619582720}"  # CustomActivator from AppUserModelId

Write-Host "=== Deep CLSID Search ===" -ForegroundColor Cyan

# Search everywhere for the CLSID
Write-Host "`n--- Searching reg.exe for CLSID $clsid ---" -ForegroundColor Yellow
reg query HKLM /s /f "F576B2F9-7850-4226-ADB0-E5993FED4F02" 2>$null
reg query HKCU /s /f "F576B2F9-7850-4226-ADB0-E5993FED4F02" 2>$null
reg query HKCR /s /f "F576B2F9-7850-4226-ADB0-E5993FED4F02" 2>$null

Write-Host "`n--- Searching reg.exe for CustomActivator CLSID $clsid2 ---" -ForegroundColor Yellow
reg query HKCR\CLSID\$clsid2 /s 2>$null
reg query HKLM\SOFTWARE\Classes\CLSID\$clsid2 /s 2>$null

Write-Host "`n=== Checking if 'SoftLanding' is a legit Windows component ===" -ForegroundColor Cyan
Write-Host "--- Checking MicrosoftWindows.Client.CBS package ---" -ForegroundColor Yellow
Get-AppxPackage -Name "MicrosoftWindows.Client.CBS" -ErrorAction SilentlyContinue | Format-List Name, PackageFullName, InstallLocation, Version, Status

Write-Host "`n--- Checking the AppxManifest for SoftLanding entry ---" -ForegroundColor Yellow
$pkg = Get-AppxPackage -Name "MicrosoftWindows.Client.CBS" -ErrorAction SilentlyContinue
if ($pkg) {
    $manifest = Join-Path $pkg.InstallLocation "AppxManifest.xml"
    if (Test-Path $manifest) {
        $content = Get-Content $manifest -Raw
        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "SoftLanding") {
                $start = [Math]::Max(0, $i - 3)
                $end = [Math]::Min($lines.Count - 1, $i + 3)
                Write-Host "  Found 'SoftLanding' at line $($i+1):" -ForegroundColor Red
                for ($j = $start; $j -le $end; $j++) {
                    Write-Host "    $($lines[$j])"
                }
                Write-Host ""
            }
        }
    }
}

Write-Host "`n=== Checking for ACTUAL malware-created COM objects ===" -ForegroundColor Cyan
Write-Host "--- All user-registered CLSIDs (HKCU\SOFTWARE\Classes\CLSID) ---" -ForegroundColor Yellow
$userClsids = Get-ChildItem "HKCU:\SOFTWARE\Classes\CLSID" -ErrorAction SilentlyContinue
if ($userClsids) {
    foreach ($key in $userClsids) {
        $inproc = Get-ItemProperty "$($key.PSPath)\InprocServer32" -ErrorAction SilentlyContinue
        $local = Get-ItemProperty "$($key.PSPath)\LocalServer32" -ErrorAction SilentlyContinue
        if ($inproc) {
            $dll = $inproc.'(default)'
            if ($dll -and $dll -notmatch 'windows|microsoft|system32') {
                Write-Host "  SUSPICIOUS CLSID: $($key.PSChildName)" -ForegroundColor Red
                Write-Host "    DLL: $dll" -ForegroundColor Yellow
            }
        }
        if ($local) {
            $exe = $local.'(default)'
            if ($exe -and $exe -notmatch 'windows|microsoft|system32') {
                Write-Host "  SUSPICIOUS CLSID: $($key.PSChildName)" -ForegroundColor Red
                Write-Host "    EXE: $exe" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "  No user CLSIDs found in HKCU" -ForegroundColor Green
}

Write-Host "`n=== Checking for SoftLanding-related files on disk ===" -ForegroundColor Cyan
$searchPaths = @(
    "$env:APPDATA",
    "$env:LOCALAPPDATA",
    "$env:PROGRAMDATA",
    "$env:TEMP",
    "$env:USERPROFILE"
)
foreach ($sp in $searchPaths) {
    Write-Host "Searching $sp ..." -ForegroundColor Gray
    Get-ChildItem $sp -Recurse -ErrorAction SilentlyContinue -Force | Where-Object {
        $_.Name -like '*SoftLanding*'
    } | ForEach-Object {
        Write-Host "  FILE: $($_.FullName)  Size: $($_.Length)" -ForegroundColor Red
    }
}

Write-Host "`n=== Checking Task Scheduler XML for the COM handler CLSID ===" -ForegroundColor Cyan
# Search C:\Windows\System32\Tasks for any task referencing this CLSID
Get-ChildItem "C:\Windows\System32\Tasks" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "F576B2F9") {
        Write-Host "  TASK FILE with CLSID: $($_.FullName)" -ForegroundColor Red
    }
}
