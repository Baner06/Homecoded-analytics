-- Ejecutar una sola vez en el SQL Editor de Supabase para el sistema
-- de calibración quincenal automática de Coded Sports.

create table if not exists calibration_state (
  id int primary key default 1,
  last_scanned_date date,
  last_calibrated_at timestamptz,
  constraint single_row check (id = 1)
);

insert into calibration_state (id, last_scanned_date, last_calibrated_at)
values (1, null, null)
on conflict (id) do nothing;

create table if not exists market_calibration (
  market_type text primary key,
  factor numeric not null default 1.0,
  hits integer not null default 0,
  misses integer not null default 0,
  sum_predicted_prob numeric not null default 0,
  sample_count integer not null default 0,
  history jsonb not null default '[]'::jsonb
);
