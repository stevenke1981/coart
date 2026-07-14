#!/usr/bin/env bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_VERSION="$(node -p "require('$SOURCE/.codex-plugin/plugin.json').version")"

cd "$SOURCE"
npm install --registry=https://registry.npmjs.org
npm run quality
if ! codex plugin marketplace list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.exit(JSON.parse(s).marketplaces.some(x=>x.name==='coart-public')?0:1))"; then
  codex plugin marketplace add "$SOURCE" --json
fi
INSTALLED_VERSION="$(codex plugin list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).installed.find(x=>x.pluginId==='coart@coart-public');process.stdout.write(p?.version||'')})")"
if [[ -n "$INSTALLED_VERSION" && "$INSTALLED_VERSION" != "$TARGET_VERSION" ]]; then
  codex plugin remove coart@coart-public --json >/dev/null
  INSTALLED_VERSION=""
fi
if [[ -z "$INSTALLED_VERSION" ]]; then
  codex plugin add coart@coart-public --json
fi
printf '%s\n' "Coart installed from $SOURCE" "Start a new Codex task, then ask: Open the Coart canvas for this project."
