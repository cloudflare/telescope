-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tests" (
    "test_id" TEXT NOT NULL PRIMARY KEY,
    "zip_key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "test_date" INTEGER NOT NULL,
    "browser" TEXT NOT NULL,
    "content_rating" TEXT NOT NULL,
    "created_at" INTEGER DEFAULT (unixepoch()),
    "updated_at" INTEGER DEFAULT (unixepoch())
);
INSERT INTO "new_tests" ("browser", "content_rating", "created_at", "description", "name", "source", "test_date", "test_id", "updated_at", "url", "zip_key") SELECT "browser", "content_rating", "created_at", "description", "name", "source", "test_date", "test_id", "updated_at", "url", "zip_key" FROM "tests";
DROP TABLE "tests";
ALTER TABLE "new_tests" RENAME TO "tests";
CREATE UNIQUE INDEX "tests_zip_key_key" ON "tests"("zip_key");
CREATE INDEX "idx_tests_file_key" ON "tests"("zip_key");
CREATE INDEX "idx_tests_content_rating" ON "tests"("content_rating");
CREATE INDEX "idx_tests_updated_at" ON "tests"("updated_at" DESC);
CREATE INDEX "idx_tests_created_at" ON "tests"("created_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
