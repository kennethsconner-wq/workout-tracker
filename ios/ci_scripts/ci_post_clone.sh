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