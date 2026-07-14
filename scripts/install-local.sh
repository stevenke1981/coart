#!/usr/bin/env bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

cd "$SOURCE"
npm install --registry=https://registry.npmjs.org
npm run quality
if ! codex plugin marketplace list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.exit(JSON.parse(s).marketplaces.some(x=>x.name==='coart-public')?0:1))"; then
  codex plugin marketplace add "$SOURCE" --json
fi
if ! codex plugin list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.exit(JSON.parse(s).installed.some(x=>x.pluginId==='coart@coart-public'&&x.version==='0.2.1')?0:1))"; then
  codex plugin add coart@coart-public --json
fi
printf '%s\n' "Coart installed from $SOURCE" "Start a new Codex task, then ask: Open the Coart canvas for this project."
