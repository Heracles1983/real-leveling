CREATE TABLE IF NOT EXISTS real_leveling_saves (
  player_id varchar(100) NOT NULL,
  mode varchar(10) NOT NULL CHECK (mode IN ('demo', 'real')),
  revision integer NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, mode)
);
