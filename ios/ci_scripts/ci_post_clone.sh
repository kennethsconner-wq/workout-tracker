#!/bin/zsh

set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f ~/.zprofile ]; then
  source ~/.zprofile
fi

if [ -f ~/.zshrc ]; then
  source ~/.zshrc
fi

echo "Node location:"
which node

echo "Node version:"
node --version

echo "NPM version:"
npm --version

echo "Installing node modules..."
npm install

echo "Installing CocoaPods dependencies..."
pod install --repo-update