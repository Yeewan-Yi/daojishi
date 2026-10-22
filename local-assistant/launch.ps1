param([string]$Manifest)
$ErrorActionPreference='Stop'
if (!$Manifest) { $Manifest=Join-Path $PSScriptRoot '..\test-results\hongshan-import\manifest.json' }
$nodeBin=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (!(Test-Path -LiteralPath $nodeBin)) { $nodeBin=(Get-Command node -ErrorAction Stop).Source }
Set-Location -LiteralPath $PSScriptRoot
& $nodeBin server.mjs "--manifest=$Manifest"
