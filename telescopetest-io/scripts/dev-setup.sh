#!/bin/bash

# 1. Create a local D1 dev database
echo "Creating local D1 database..."
npx wrangler d1 execute telescope-db-development --local --env development --command "SELECT 1;"

# 2. Create a local R2 Bucket (NOTE: This might prompt for login)
echo "Creating R2 bucket 'results-bucket-development'..."
npx wrangler r2 bucket create results-bucket-development

# 3. Setup .env file with DATABASE_URL
echo "Setting up .env file..."
SQLITE_FILE=$(find .wrangler/state/v3/d1/miniflare-D1DatabaseObject -name "*.sqlite" | head -n 1)
if [ -n "$SQLITE_FILE" ]; then
  # Use relative path as per README
  echo "DATABASE_URL=\"file:$SQLITE_FILE\"" > .env
  echo ".env file created with DATABASE_URL=\"file:$SQLITE_FILE\""
else
  echo "Error: Could not find sqlite file in .wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  exit 1
fi

# 4. Apply migrations to the local D1 database
echo "Applying migrations to local D1 database..."
npm run migrate:local

# 5. Generate Prisma Client
echo "Generating Prisma Client..."
npm run generate

# 6. Generate Cloudflare worker types
echo "Generating worker types..."
npm run cf-typegen
