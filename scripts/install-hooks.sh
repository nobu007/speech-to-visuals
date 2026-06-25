#!/bin/sh
# Install git hooks for speech-to-visuals
# Usage: npm run setup:hooks

HOOKS_DIR=$(git rev-parse --git-path hooks)
SCRIPT_DIR=$(dirname "$0")

echo "Installing git hooks to: $HOOKS_DIR"

# Install pre-commit hook
install_hook() {
  local hook_name=$1
  local src="$SCRIPT_DIR/hooks/$hook_name"
  local dst="$HOOKS_DIR/$hook_name"

  if [ ! -f "$src" ]; then
    echo "  ⚠️  Source not found: $src"
    return 1
  fi

  cp "$src" "$dst"
  chmod +x "$dst"
  echo "  ✅ Installed: $hook_name"
}

install_hook "pre-commit"

echo ""
echo "Done. Hooks will run automatically on git commit."
echo "Bypass with: git commit --no-verify"
