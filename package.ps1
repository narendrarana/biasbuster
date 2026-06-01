<#
.SYNOPSIS
  Build a Chrome Web Store upload zip containing exactly the files the
  extension needs at runtime — nothing else (no .git, specs, screenshots,
  or other zips).

.DESCRIPTION
  Reads the version from manifest.json and packages the manifest plus the
  asset folders it references into BiasBuster-store-<version>.zip in the
  project root. Re-run after any change you want to ship.

.EXAMPLE
  .\package.ps1
#>

[CmdletBinding()]
param(
    # Output directory for the zip (defaults to the project root).
    [string]$OutDir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Files / folders that make up the shippable extension. Keep this in sync
# with whatever manifest.json references.
$include = @(
    'manifest.json',
    'background',
    'content',
    'popup',
    'options',
    'providers',
    'themes',
    'icons'
)

# Verify every entry exists before zipping so we fail loudly on a typo
# or a renamed folder rather than shipping an incomplete package.
$missing = $include | Where-Object { -not (Test-Path $_) }
if ($missing) {
    throw "Cannot package — these paths are missing: $($missing -join ', ')"
}

# Pull the version straight from the manifest so the zip name always
# matches what the store will see.
$manifest = Get-Content 'manifest.json' -Raw | ConvertFrom-Json
$version  = $manifest.version
if (-not $version) { throw 'manifest.json has no "version" field.' }

$zipName = "BiasBuster-store-$version.zip"
$zipPath = Join-Path $OutDir $zipName

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path $include -DestinationPath $zipPath -Force

$sizeKB = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "Packaged v$version -> $zipName ($sizeKB KB)" -ForegroundColor Green
Write-Host "Upload this file on the Chrome Web Store Developer Dashboard (Package > Upload new package)."
