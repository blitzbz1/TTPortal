-- Cache table for AmaTur tournament data (fetched from amatur.ro)
CREATE TABLE IF NOT EXISTS amatur_cache (
  id TEXT PRIMARY KEY,
  html TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow the edge function (service role) full access; anon can read
ALTER TABLE amatur_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read amatur cache"
  ON amatur_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can upsert amatur cache"
  ON amatur_cache FOR ALL
  USING (true)
  WITH CHECK (true);
