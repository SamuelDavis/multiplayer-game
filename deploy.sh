#!/usr/bin/env sh
rm -rf dist

REPO_NAME=multiplayer-game

# abort on errors
set -e

# build
npm run build

# navigate into the dist output directory
cd dist

# if you are deploying to a custom domain
echo "$REPO_NAME.sdavis.online" > CNAME

git init
git add -A
git commit -m 'deploy'

git push -f "git@github.com:SamuelDavis/$REPO_NAME.git" main:gh-pages

cd -