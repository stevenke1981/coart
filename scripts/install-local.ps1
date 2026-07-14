param(
  [switch]$SkipQuality,
  [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"
$Source = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TargetVersion = (Get-Content (Join-Path $Source '.codex-plugin\plugin.json') -Raw | ConvertFrom-Json).version
Push-Location $Source
try {
  npm install --registry=https://registry.npmjs.org
  if (-not $SkipQuality) { npm run quality }

  $marketplaces = (codex plugin marketplace list --json | ConvertFrom-Json).marketplaces
  $coartMarketplace = $marketplaces | Where-Object { $_.name -eq 'coart-public' }
  if ($coartMarketplace) {
    $registeredRoot = [string]$coartMarketplace.root -replace '^\\\\\?\\', ''
    if ([IO.Path]::GetFullPath($registeredRoot) -ne [IO.Path]::GetFullPath($Source)) {
      throw "Marketplace coart-public already points to a different root: $registeredRoot"
    }
  } else {
    codex plugin marketplace add $Source --json
  }

  $installed = (codex plugin list --json | ConvertFrom-Json).installed |
    Where-Object { $_.pluginId -eq 'coart@coart-public' }
  if ($installed -and ($ForceReinstall -or $installed.version -ne $TargetVersion)) {
    codex plugin remove coart@coart-public --json | Out-Null
    $installed = $null
  }
  if (-not $installed) { codex plugin add coart@coart-public --json }
  Write-Host "Coart installed from $Source"
  Write-Host "Start a new Codex task, then ask: Open the Coart canvas for this project."
} finally {
  Pop-Location
}
