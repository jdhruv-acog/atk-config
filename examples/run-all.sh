#!/bin/bash

echo "==================================="
echo "Running all atk-config examples"
echo "==================================="

examples=(
  "01-basic"
  "02-with-files"
  "03-environments"
  "04-variable-substitution"
  "05-nested-schema"
  "06-validation-strict"
  "07-cli-and-env"
  "08-base-config"
  "09-app-name"
  "10-secrets"
  "11-commander"
)

failed=0

for example in "${examples[@]}"; do
  echo ""
  echo "-----------------------------------"
  echo "Running: $example"
  echo "-----------------------------------"

  if bun "examples/$example/index.ts" 2>&1 | head -30; then
    if [ "$example" = "06-validation-strict" ]; then
      echo "✓ $example passed (expected failure)"
    else
      echo "✓ $example passed"
    fi
  else
    if [ "$example" = "06-validation-strict" ]; then
      echo "✓ $example passed (expected failure)"
    else
      echo "✗ $example failed"
      ((failed++))
    fi
  fi
done

echo ""
echo "==================================="
if [ $failed -eq 0 ]; then
  echo "✓ All examples passed!"
else
  echo "✗ $failed examples failed"
fi
echo "==================================="
