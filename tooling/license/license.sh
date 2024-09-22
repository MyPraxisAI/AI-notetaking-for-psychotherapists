#!/bin/sh

set -e

if [ "$NODE_ENV" = "production" ]; then
  exit 0
fi

GIT_USER=$(git config user.name)
GIT_EMAIL=$(git config user.email)

if [ -z "$GIT_USER" ]; then
  echo "Please set the git user name with the command 'git config user.name <username>'. The username needs to match the username in your Makerkit organization."
  exit 1
fi

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "https://makerkit.dev/api/license/check?username=$GIT_USER&email=$GIT_EMAIL")

if [ "$STATUS_CODE" = "200" ]; then
  exit 0
fi

exit 1