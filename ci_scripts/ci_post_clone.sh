#!/bin/sh

echo "CI POST CLONE IS RUNNING"

cd ios || exit 1

pod install --repo-update || exit 1

ls "Pods/Target Support Files/Pods-WorkoutTracker"