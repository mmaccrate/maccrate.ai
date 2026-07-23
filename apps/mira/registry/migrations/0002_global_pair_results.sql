-- Automatically accepted, permanent pair results.
-- The first valid result for a pair/version wins; all later players receive it.
CREATE TABLE IF NOT EXISTS mira_pair_results (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  game_version TEXT NOT NULL,
  input_a TEXT NOT NULL,
  input_b TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK(length(result_json) BETWEEN 20 AND 4096),
  output_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(pair_id, game_version)
);

CREATE INDEX IF NOT EXISTS mira_pair_results_lookup
  ON mira_pair_results(pair_id, game_version);
