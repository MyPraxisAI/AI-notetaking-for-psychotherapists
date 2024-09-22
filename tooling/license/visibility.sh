#!/bin/bash

set -e

remote_url=$(git config --get remote.origin.url)

if [[ $remote_url == *"github.com"* ]]; then
  if [[ $remote_url == https://github.com/* ]]; then
    owner_repo=${remote_url#https://github.com/}
  elif [[ $remote_url == git@github.com:* ]]; then
    owner_repo=${remote_url#git@github.com:}
  else
    echo "Unsupported GitHub URL format"
    exit 1
  fi
  owner_repo=${owner_repo%.git}

  api_url="https://api.github.com/repos/$owner_repo"
  response=$(curl -s -o /dev/null -w "%{http_code}" $api_url)

  if [ $response -eq 200 ]; then
    visibility=$(curl -s $api_url | grep -o '"private": \(true\|false\)' | awk '{print $2}')
    if [ "$visibility" = "false" ]; then
      echo "The repository has been LEAKED on GitHub. Please delete the repository. A DMCA Takedown Request will automatically be requested in the coming hours."
      exit 1
    else
      exit 0
    fi
  elif [ $response -eq 404 ]; then
    exit 0
  else
    exit 1
  fi
else
  exit 0
fi