param(
  [switch]$SkipQuality,
  [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"
$Source = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TargetVersion = (Get-Content (Join-Path $Source '.codex-plugin\plugin.json') -Raw | ConvertFrom-Json).version
$featureOutput = (codex features list 2>&1 | Out-String) -replace "$([char]27)\[[0-9;]*[A-Za-z]", ''
if ($featureOutput -notmatch '(?m)^\s*enable_mcp_apps\s+.*\s+true\s*$') {
  throw "Codex MCP Apps renderer is disabled. Run 'codex features enable enable_mcp_apps', fully restart Codex Desktop, then rerun this installer."
}
Push-Location $Source
try {
  npm install --ignore-scripts --fetch-retries=0 --fetch-timeout=30000 --registry=https://registry.npmjs.org
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
