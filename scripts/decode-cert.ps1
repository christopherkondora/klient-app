# Decode APPLE_CERTIFICATE base64 string to .p12 file
# Usage:
#   1. Save the base64 string (without "APPLE_CERTIFICATE=" prefix) to build/certs/cert.b64
#   2. Run: pwsh ./scripts/decode-cert.ps1
#   3. Delete build/certs/cert.b64 after success

$ErrorActionPreference = "Stop"
$inputPath = "build/certs/cert.b64"
$outputPath = "build/certs/DeveloperIDApplication.p12"

if (-not (Test-Path $inputPath)) {
    Write-Error "Missing $inputPath. Save the base64 string there first (no APPLE_CERTIFICATE= prefix)."
    exit 1
}

$b64 = (Get-Content $inputPath -Raw).Trim()
$bytes = [System.Convert]::FromBase64String($b64)
[System.IO.File]::WriteAllBytes((Resolve-Path -LiteralPath (Split-Path $outputPath -Parent)).Path + "\" + (Split-Path $outputPath -Leaf), $bytes)

Write-Host "Wrote $outputPath ($($bytes.Length) bytes)"
Write-Host "Now delete $inputPath — never commit it."
