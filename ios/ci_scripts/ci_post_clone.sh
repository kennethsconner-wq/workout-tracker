#!/bin/sh

set -e

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE

if [[ -d "$HOME/.nvm" ]]; then
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
fi

export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

echo "Node version:"
node --version

echo "NPM version:"
npm --version

echo "Installing node modules..."
npm install

echo "Installing CocoaPods dependencies..."
pod install --repo-update