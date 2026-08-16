Write-Host "=== SCHEDULED TASK FOLDERS ===" -ForegroundColor Cyan

# Method 1: COM Object approach for folder-level enumeration
try {
    $ts = New-Object -ComObject Schedule.Service
    $ts.Connect()
    $root = $ts.GetFolder('\')
    foreach ($folder in $root.GetFolders(0)) {
        if ($folder.Name -like '*SoftLanding*') {
            Write-Host "FOUND FOLDER: $($folder.Path)" -ForegroundColor Red
            foreach ($task in $folder.GetTasks(1)) {
                Write-Host "  Task: $($task.Name)  State: $($task.State)  LastRun: $($task.LastRunTime)" -ForegroundColor Yellow
                Write-Host "  --- XML Definition ---" -ForegroundColor Gray
                Write-Host $task.Xml
                Write-Host ""
            }
        }
    }
} catch {
    Write-Host "COM error: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=== ALL TASKS MATCHING 'SoftLanding' (Get-ScheduledTask) ===" -ForegroundColor Cyan

# Method 2: Get-ScheduledTask cmdlet
$matched = Get-ScheduledTask | Where-Object {
    $_.TaskName -like '*SoftLanding*' -or
    $_.TaskPath -like '*SoftLanding*' -or
    $_.Description -like '*SoftLanding*'
}

if ($matched) {
    $matched | Format-List TaskName, TaskPath, State, Description, Author, Date, URI
    
    Write-Host "=== TASK ACTIONS (what executables they run) ===" -ForegroundColor Cyan
    foreach ($t in $matched) {
        Write-Host "Task: $($t.TaskName)" -ForegroundColor Yellow
        $info = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction SilentlyContinue
        if ($info) {
            Write-Host "  LastRunTime: $($info.LastRunTime)"
            Write-Host "  NextRunTime: $($info.NextRunTime)"
        }
        foreach ($action in $t.Actions) {
            Write-Host "  Action Execute: $($action.Execute)" -ForegroundColor Red
            Write-Host "  Action Arguments: $($action.Arguments)"
            Write-Host "  Action WorkingDir: $($action.WorkingDirectory)"
        }
        foreach ($trigger in $t.Triggers) {
            Write-Host "  Trigger: $($trigger.CimClass.CimClassName) Enabled=$($trigger.Enabled)" -ForegroundColor Magenta
        }
        Write-Host ""
    }
} else {
    Write-Host "No tasks found via Get-ScheduledTask matching 'SoftLanding'" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== SCHTASKS /QUERY for SoftLanding folder ===" -ForegroundColor Cyan
try {
    schtasks /Query /TN "\SoftLanding\" /V /FO LIST 2>&1
} catch {
    Write-Host "schtasks error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== CHECKING Task Scheduler XML files on disk ===" -ForegroundColor Cyan
$taskPath = "C:\Windows\System32\Tasks"
if (Test-Path "$taskPath\SoftLanding") {
    Write-Host "FOUND folder: $taskPath\SoftLanding" -ForegroundColor Red
    Get-ChildItem "$taskPath\SoftLanding" -Recurse | ForEach-Object {
        Write-Host "  File: $($_.FullName)  Size: $($_.Length) bytes" -ForegroundColor Yellow
        if (-not $_.PSIsContainer) {
            Write-Host "  --- Content ---" -ForegroundColor Gray
            Get-Content $_.FullName -ErrorAction SilentlyContinue
            Write-Host ""
        }
    }
} else {
    Write-Host "No SoftLanding folder found in $taskPath" -ForegroundColor Green
}
