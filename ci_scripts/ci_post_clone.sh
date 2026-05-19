#!/bin/sh
set -e
set -x

echo "=== CI POST CLONE START ==="

pwd
ls
ls ios

echo "=== Installing Node dependencies ==="
npm install

echo "=== Installing CocoaPods ==="
cd ios

pod install --repo-update

echo "=== Listing generated xcconfig ==="
ls "Pods/Target Support Files/Pods-WorkoutTracker"

echo "=== CI POST CLONE COMPLETE ==="