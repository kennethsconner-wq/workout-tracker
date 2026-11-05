#!/bin/bash
# Writes ios/.xcode.env.local with a Node binary that can actually run.
# Xcode script phases use a short PATH, and `command -v node` can return a
# broken /usr/local/bin/node. Capturing the real path while PATH is complete
# lets Hermes and React Native prebuilt scripts run on EAS and Xcode Cloud.

set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

resolve_node_binary() {
  local candidate
  local candidates=()

  while IFS= read -r candidate; do
    [ -n "$candidate" ] && candidates+=("$candidate")
  done < <(command -v -a node 2>/dev/null || true)

  candidates+=(
    /opt/homebrew/bin/node
    /usr/local/opt/node/bin/node
  )

  if [ -d "${HOME}/.nvm/versions/node" ]; then
    for candidate in "${HOME}/.nvm/versions/node"/*/bin/node; do
      candidates+=("$candidate")
    done
  fi

  for candidate in "${candidates[@]}"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -e 'process.exit(0)' >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_PATH="$(resolve_node_binary || true)"
if [ -z "$NODE_PATH" ]; then
  echo "write-xcode-node-binary: no working node binary was found" >&2
  exit 1
fi

printf 'export NODE_BINARY=%s\n' "$NODE_PATH" > "$ROOT/ios/.xcode.env.local"
echo "Set ios/.xcode.env.local NODE_BINARY=$NODE_PATH"
