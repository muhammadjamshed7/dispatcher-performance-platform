DROP INDEX IF EXISTS "DailyActivity_carrierId_activityDate_key";

CREATE INDEX IF NOT EXISTS "DailyActivity_carrierId_activityDate_idx"
  ON "DailyActivity"("carrierId", "activityDate");
