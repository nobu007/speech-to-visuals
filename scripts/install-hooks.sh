#!/bin/sh
# Install git hooks for speech-to-visuals
# Usage: npm run setup:hooks

HOOKS_DIR=$(git rev-parse --git-path hooks)
SCRIPT_DIR=$(dirname "$0")

echo "Installing git hooks to: $HOOKS_DIR"

# Install git hooks (currently: pre-commit + pre-push).
# Both hooks are drift detectors — they fire only when the working tree
# disagrees with the source of truth (spine manifest for pre-commit, generated
# Edge sanitizer for both). Adding a new hook is a one-line task: drop a file
# in scripts/hooks/ and add an `install_hook "<name>"` call below.
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
install_hook "pre-push"

echo ""
echo "Done. Hooks will run automatically on git commit and git push."
echo "Bypass with: git commit --no-verify / git push --no-verify"
