#!/bin/bash

# Start dev server in background
npm run dev > /tmp/dev.log 2>&1 &
DEV_PID=$!

# Wait for server to start
sleep 3

# Generate auth token
TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const secret = 'test-secret-key-12345';
const token = jwt.sign({ sub: 'test' }, secret, { expiresIn: '1h' });
console.log(token);
" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "Failed to generate token, checking .env.local for AUTH_SECRET"
  source .env.local
  if [ -z "$AUTH_SECRET" ]; then
    echo "ERROR: AUTH_SECRET not found in .env.local"
    kill $DEV_PID
    exit 1
  fi
  TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const secret = '$AUTH_SECRET';
  const token = jwt.sign({ sub: 'test' }, secret, { expiresIn: '1h' });
  console.log(token);
  ")
fi

echo "Generated token: ${TOKEN:0:20}..."

# Read resume from file
RESUME=$(cat data/resume.json)

# Call export PDF API
echo "Exporting PDF..."
curl -s -X POST http://localhost:3000/api/export/pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"resume\": $RESUME,
    \"jobDescription\": \"Looking for a full-stack developer experienced with React, Node.js, TypeScript, and cloud technologies\"
  }" \
  > /tmp/export-response.json

# Check response
if grep -q "error" /tmp/export-response.json; then
  echo "Error in response:"
  cat /tmp/export-response.json | jq .
else
  echo "PDF exported successfully (check for actual output)"
  ls -lh /tmp/*.pdf 2>/dev/null || echo "No PDF files found in /tmp"
fi

# Cleanup
kill $DEV_PID
