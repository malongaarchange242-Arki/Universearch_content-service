ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS organization_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activities_organization_type_check'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_organization_type_check
      CHECK (organization_type IN ('universite', 'centre_formation'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_organization
  ON activities(organization_id, organization_type);
