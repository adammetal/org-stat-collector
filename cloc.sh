#!/usr/bin/env bash
git clone --depth 1 "$1" ./gen/temp-linecount-repo-"$2" &&
  cloc ./gen/temp-linecount-repo-"$2" --max-file-size=1 --json --exclude-dir=node_modules --exclude-lang=Markdown,JSON,YAML,SQL &&
  rm -rf ./gen/temp-linecount-repo-"$2"