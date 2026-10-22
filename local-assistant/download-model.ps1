$ErrorActionPreference='Stop'
$revision='d15189d7028b43f1d3e65039190477f6af591c2a'
$root=Join-Path $env:LOCALAPPDATA "YouqiModels\models\$revision\Xenova\clip-vit-base-patch32"
$metadata=Invoke-RestMethod -Uri "https://huggingface.co/api/models/Xenova/clip-vit-base-patch32/revision/${revision}?blobs=true" -TimeoutSec 30
$files=$metadata.siblings | Where-Object { ($_.rfilename -notmatch '^onnx/' -and $_.rfilename -ne '.gitattributes') -or $_.rfilename -match '(text_model|vision_model)_quantized.onnx$' }
foreach ($file in $files) {
 $target=Join-Path $root $file.rfilename
 New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
 if ((Test-Path -LiteralPath $target) -and (!$file.lfs.sha256 -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $file.lfs.sha256)) { continue }
 $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
 Invoke-WebRequest -Uri "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/$revision/$($file.rfilename)?download=true&run=$nonce" -OutFile "$target.part" -TimeoutSec 1200
 if ($file.lfs.sha256 -and (Get-FileHash -LiteralPath "$target.part" -Algorithm SHA256).Hash -ne $file.lfs.sha256) { throw 'Model checksum mismatch' }
 Move-Item -LiteralPath "$target.part" -Destination $target -Force
 Write-Output "Downloaded and verified $($file.rfilename)"
}
Write-Output 'Pinned model ready for offline inference.'
