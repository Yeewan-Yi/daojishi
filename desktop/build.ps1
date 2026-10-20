param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist'))
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.8 compiler required.' }
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$references = @('/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Net.Http.dll', '/r:System.Web.Extensions.dll', '/r:System.Security.dll')
& $compiler /nologo /target:winexe /optimize+ /main:Youqi.Program "/win32manifest:$PSScriptRoot\app.manifest" "/out:$output\YouqiWidget.exe" @references "$PSScriptRoot\Widget.cs"
if ($LASTEXITCODE -ne 0) { throw 'Widget compilation failed' }
& $compiler /nologo /target:exe /optimize+ /main:Tests "/out:$output\WidgetTests.exe" @references "$PSScriptRoot\Widget.cs" "$PSScriptRoot\Tests.cs"
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& "$output\WidgetTests.exe"
if ($LASTEXITCODE -ne 0) { throw 'Widget tests failed' }
& $compiler /nologo /target:winexe /optimize+ "/win32manifest:$PSScriptRoot\app.manifest" "/resource:$output\YouqiWidget.exe,Widget" "/out:$output\Youqi-Setup.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll "$PSScriptRoot\Installer.cs"
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
Copy-Item -LiteralPath "$PSScriptRoot/README.md" -Destination "$output/使用说明.md"
Compress-Archive -LiteralPath "$output\YouqiWidget.exe", "$output/使用说明.md" -DestinationPath "$output/Youqi-Windows-Portable.zip" -Force
Get-FileHash -Algorithm SHA256 -LiteralPath "$output\YouqiWidget.exe", "$output\Youqi-Setup.exe", "$output/Youqi-Windows-Portable.zip" | Format-Table
