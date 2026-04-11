# Convert all MP4 files to HLS format
# Each video gets its own folder with playlist.m3u8 + .ts chunks

$publicDir = "$PSScriptRoot\public"

$mp4Files = Get-ChildItem -Path $publicDir -Recurse -Filter "*.mp4"

foreach ($file in $mp4Files) {
    $dir  = $file.DirectoryName
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $outDir = Join-Path $dir $stem

    # Skip if already done
    if (Test-Path (Join-Path $outDir "playlist.m3u8")) {
        Write-Host "SKIP (already converted): $($file.FullName)" -ForegroundColor Yellow
        continue
    }

    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    Write-Host "Converting: $($file.FullName)" -ForegroundColor Cyan

    & ffmpeg -y `
        -i "$($file.FullName)" `
        -c:v libx264 -profile:v baseline -level 3.0 `
        -c:a aac -b:a 128k `
        -start_number 0 `
        -hls_time 4 `
        -hls_list_size 0 `
        -hls_segment_filename "$outDir\segment%03d.ts" `
        -f hls `
        "$outDir\playlist.m3u8"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Done -> $outDir\playlist.m3u8" -ForegroundColor Green
    } else {
        Write-Host "  FAILED for $($file.Name)" -ForegroundColor Red
    }
}

Write-Host "`nAll conversions complete!" -ForegroundColor Magenta
