-- Mira registry tables are namespaced for the shared maccrate-ai D1 database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mira_discoveries (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  game_version TEXT NOT NULL,
  input_a TEXT NOT NULL,
  input_b TEXT NOT NULL,
  discovery_json TEXT NOT NULL CHECK(length(discovery_json) BETWEEN 20 AND 4096),
  status TEXT NOT NULL CHECK(status IN ('approved','retired')) DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(pair_id, game_version)
);

CREATE INDEX IF NOT EXISTS mira_discoveries_pair_version ON mira_discoveries(pair_id, game_version, status);

CREATE TABLE IF NOT EXISTS mira_proposals (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  game_version TEXT NOT NULL,
  input_a TEXT NOT NULL,
  input_b TEXT NOT NULL,
  proposal_json TEXT NOT NULL CHECK(length(proposal_json) BETWEEN 20 AND 4096),
  output_hash TEXT NOT NULL,
  proposer_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','merged')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  review_note TEXT,
  UNIQUE(pair_id, game_version, output_hash)
);

CREATE INDEX IF NOT EXISTS mira_proposals_review_queue ON mira_proposals(status, created_at);
CREATE INDEX IF NOT EXISTS mira_proposals_rate_lookup ON mira_proposals(proposer_hash, created_at);

CREATE TABLE IF NOT EXISTS mira_discovery_claims (
  pair_id TEXT NOT NULL,
  game_version TEXT NOT NULL,
  claimant_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('claimed','submitted')) DEFAULT 'claimed',
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(pair_id, game_version)
);

CREATE INDEX IF NOT EXISTS mira_discovery_claims_expiry ON mira_discovery_claims(expires_at, status);

CREATE TABLE IF NOT EXISTS mira_consumed_tokens (
  token_hash TEXT PRIMARY KEY,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mira_consumed_tokens_expiry ON mira_consumed_tokens(consumed_at);
