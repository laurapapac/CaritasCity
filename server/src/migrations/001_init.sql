CREATE TYPE building_category AS ENUM ('residential', 'hospital', 'food', 'school');
CREATE TYPE building_status   AS ENUM ('queued', 'in_progress', 'completed');

CREATE TABLE schools (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE qr_codes (
  id            BIGSERIAL PRIMARY KEY,
  public_token  TEXT NOT NULL UNIQUE,        -- unguessable, embedded in the QR/URL, never the id
  category      building_category NOT NULL
);

CREATE TABLE desktop_codes (
  id         BIGSERIAL PRIMARY KEY,
  code       TEXT NOT NULL,                  -- short, human-typed
  qr_id      BIGINT NOT NULL REFERENCES qr_codes(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                    -- null = still valid/unused
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX desktop_codes_active_code_uq
  ON desktop_codes (code) WHERE used_at IS NULL;

CREATE TABLE buildings (
  id               BIGSERIAL PRIMARY KEY,
  category         building_category NOT NULL,
  variant          TEXT NOT NULL,             -- 'house' | 'short_apartment' | 'hospital_small' | 'school_design_1' | ...
  order_index      INT NOT NULL,              -- placeholder for sequencing; rule TBD later
  total_blocks     INT NOT NULL,
  completed_blocks INT NOT NULL DEFAULT 0,
  status           building_status NOT NULL DEFAULT 'queued'
);
CREATE UNIQUE INDEX buildings_one_active_per_category
  ON buildings (category) WHERE status = 'in_progress';

CREATE TABLE blocks (
  id          BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES buildings(id),
  block_index INT NOT NULL,
  qr_id       BIGINT NOT NULL UNIQUE REFERENCES qr_codes(id),
  school_id   BIGINT NOT NULL REFERENCES schools(id),
  placed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, block_index)
);
