#!/bin/zsh

set -e

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE

brew install node

echo "Node version:"
node --version

echo "NPM version:"
npm --version

echo "Installing node modules..."
npm install

echo "Installing CocoaPods dependencies..."
pod install --repo-update

echo "Recording the Node binary for Xcode script phases..."
bash "${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../.." && pwd)}/scripts/write-xcode-node-binary.sh"