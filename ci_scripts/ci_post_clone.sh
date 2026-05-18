#!/bin/sh

echo "Installing Node dependencies..."

npm install

echo "Installing CocoaPods..."

cd ios
pod install --repo-update