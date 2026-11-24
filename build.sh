#!/bin/sh
# Builds the store packages from src/:
#   dist/restart-chrome-<version>.zip   (src/ as is: Chrome, Brave, Edge…)
#   dist/restart-firefox-<version>.zip  (src/ with platforms/firefox/manifest.json)
# The version comes from src/manifest.json: change it there only.
set -eu
cd "$(dirname "$0")"

version=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' src/manifest.json)
[ -n "$version" ] || { echo "No version found in src/manifest.json" >&2; exit 1; }

rm -rf dist
mkdir -p dist/chrome dist/firefox

cp -R src/. dist/chrome/
cp -R src/. dist/firefox/
sed "s/__VERSION__/$version/" platforms/firefox/manifest.json > dist/firefox/manifest.json

(cd dist/chrome && zip -qr -X "../restart-chrome-$version.zip" . -x '.*')
(cd dist/firefox && zip -qr -X "../restart-firefox-$version.zip" . -x '.*')

echo "Built dist/restart-chrome-$version.zip and dist/restart-firefox-$version.zip"
