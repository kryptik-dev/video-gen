$ErrorActionPreference = 'Stop'

param(
  [string]$TaskName = 'VideoGenDaily',
  [string]$StartTime = '10:00'
)

# Resolve workspace path
$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $workspace

# Command to run daily: start Docker service and run once
$pwsh = (Get-Command pwsh).Source
$actionCmd = "cd `$env:WORKSPACE; npm run up; pwsh -NoLogo -NoProfile -Command 'Start-Sleep -Seconds 10; node src/index.js --once'"

$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoLogo -NoProfile -Command `$env:WORKSPACE='$workspace'; $actionCmd"
$trigger = New-ScheduledTaskTrigger -Daily -At ($StartTime)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description 'Generate and upload a short video daily' -Force | Out-Null

Write-Host "Scheduled task '$TaskName' created to run daily at $StartTime"




