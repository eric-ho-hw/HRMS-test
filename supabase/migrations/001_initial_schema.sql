-- ─── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles (extends auth.users) ────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('boss','driver')),
  full_name  text not null,
  phone      text,
  created_at timestamptz default now()
);

-- ─── Drivers ──────────────────────────────────────────────────────────────────
create table drivers (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid unique references profiles(id) on delete set null,
  employee_no     text unique not null,
  base_salary     numeric(10,2) not null,
  shift_start     time not null default '08:00',
  shift_end       time not null default '17:00',
  is_active       boolean not null default true,
  created_at      timestamptz default now()
);

-- ─── Geofence Locations ────────────────────────────────────────────────────────
create table locations (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  lat       numeric(10,7) not null,
  lng       numeric(10,7) not null,
  radius_m  int not null default 100,
  is_active boolean not null default true
);

-- ─── Clockings ────────────────────────────────────────────────────────────────
create table clockings (
  id             uuid primary key default uuid_generate_v4(),
  driver_id      uuid not null references drivers(id) on delete cascade,
  date           date not null,
  clock_in       timestamptz,
  clock_out      timestamptz,
  clock_in_lat   numeric(10,7),
  clock_in_lng   numeric(10,7),
  clock_out_lat  numeric(10,7),
  clock_out_lng  numeric(10,7),
  status         text not null default 'open' check (status in ('open','closed')),
  unique (driver_id, date)
);

-- ─── Allowance Rates ──────────────────────────────────────────────────────────
create table allowance_rates (
  id     uuid primary key default uuid_generate_v4(),
  type   text unique not null check (type in ('meal','overnight')),
  amount numeric(10,2) not null
);

insert into allowance_rates (type, amount) values ('meal', 15.00), ('overnight', 80.00);

-- ─── Allowance Claims ─────────────────────────────────────────────────────────
create table allowance_claims (
  id           uuid primary key default uuid_generate_v4(),
  driver_id    uuid not null references drivers(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('meal','overnight')),
  amount       numeric(10,2) not null,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes        text,
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);

-- ─── OT Requests ──────────────────────────────────────────────────────────────
create table ot_requests (
  id           uuid primary key default uuid_generate_v4(),
  driver_id    uuid not null references drivers(id) on delete cascade,
  date         date not null,
  hours        numeric(4,1) not null,
  reason       text,
  day_type     text not null check (day_type in ('weekday','rest','public_holiday')),
  ot_amount    numeric(10,2),               -- filled on approval
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);

-- ─── Pay Periods ──────────────────────────────────────────────────────────────
create table pay_periods (
  id         uuid primary key default uuid_generate_v4(),
  year       int not null,
  month      int not null check (month between 1 and 12),
  status     text not null default 'open' check (status in ('open','locked')),
  locked_at  timestamptz,
  unique (year, month)
);

-- ─── Payroll Entries ──────────────────────────────────────────────────────────
create table payroll_entries (
  id                uuid primary key default uuid_generate_v4(),
  driver_id         uuid not null references drivers(id) on delete cascade,
  pay_period_id     uuid not null references pay_periods(id) on delete cascade,
  base_salary       numeric(10,2) not null,
  ot_total          numeric(10,2) not null default 0,
  allowance_total   numeric(10,2) not null default 0,
  generated_at      timestamptz default now(),
  unique (driver_id, pay_period_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles         enable row level security;
alter table drivers          enable row level security;
alter table locations        enable row level security;
alter table clockings        enable row level security;
alter table allowance_rates  enable row level security;
alter table allowance_claims enable row level security;
alter table ot_requests      enable row level security;
alter table pay_periods      enable row level security;
alter table payroll_entries  enable row level security;

-- Helper: get role from JWT app_metadata
create or replace function auth_role()
returns text language sql stable security definer as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (select role from profiles where id = auth.uid())
  );
$$;

-- Helper: get driver id for current user
create or replace function my_driver_id()
returns uuid language sql stable security definer as $$
  select id from drivers where profile_id = auth.uid();
$$;

-- profiles
create policy "own profile" on profiles
  for all using (id = auth.uid());
create policy "boss sees all profiles" on profiles
  for select using (auth_role() = 'boss');

-- drivers
create policy "boss full access" on drivers
  for all using (auth_role() = 'boss');
create policy "driver reads own" on drivers
  for select using (profile_id = auth.uid());

-- locations
create policy "boss manages locations" on locations
  for all using (auth_role() = 'boss');
create policy "drivers read locations" on locations
  for select using (true);

-- clockings
create policy "boss full access" on clockings
  for all using (auth_role() = 'boss');
create policy "driver own clockings" on clockings
  for all using (driver_id = my_driver_id());

-- allowance_rates
create policy "boss manages rates" on allowance_rates
  for all using (auth_role() = 'boss');
create policy "drivers read rates" on allowance_rates
  for select using (true);

-- allowance_claims
create policy "boss full access" on allowance_claims
  for all using (auth_role() = 'boss');
create policy "driver own claims" on allowance_claims
  for all using (driver_id = my_driver_id());

-- ot_requests
create policy "boss full access" on ot_requests
  for all using (auth_role() = 'boss');
create policy "driver own ot" on ot_requests
  for all using (driver_id = my_driver_id());

-- pay_periods
create policy "boss full access" on pay_periods
  for all using (auth_role() = 'boss');
create policy "drivers read pay_periods" on pay_periods
  for select using (true);

-- payroll_entries
create policy "boss full access" on payroll_entries
  for all using (auth_role() = 'boss');
create policy "driver own entries" on payroll_entries
  for select using (driver_id = my_driver_id());

-- ─── Trigger: set role in app_metadata on signup ───────────────────────────────
-- (Boss is created manually; this default creates driver role)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- app_metadata.role is set by the invite flow; default to 'driver'
  insert into profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_app_meta_data->>'role', 'driver'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
