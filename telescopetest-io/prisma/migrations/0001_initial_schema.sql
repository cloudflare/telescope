-- CreateTable
CREATE TABLE "tests" (
    "test_id" TEXT NOT NULL PRIMARY KEY,
    "zip_key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "source" TEXT,
    "url" TEXT NOT NULL,
    "test_date" INTEGER NOT NULL,
    "browser" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

-- CreateIndex
CREATE UNIQUE INDEX "tests_zip_key_key" ON "tests"("zip_key");

-- CreateIndex
CREATE INDEX "tests_created_at_idx" ON "tests"("created_at" DESC);

-- CreateIndex
CREATE INDEX "tests_updated_at_idx" ON "tests"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "tests_zip_key_idx" ON "tests"("zip_key");

