-- TOI Vendor Portal - Multi-Vendor Schema
-- Run this in the Supabase SQL editor

-- =============================================
-- EXTENSIONS
-- =============================================
create extension if not exists "uuid-ossp";

-- =============================================
-- VENDORS TABLE
-- =============================================
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  vendor_name text not null,
  mobile_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed vendors from the TOI Vendor Details folder
insert into vendors (vendor_name) values
  ('Arumugam'),
  ('Deva'),
  ('Dilli'),
  ('Ganesan'),
  ('Jeeva'),
  ('Kaliappan'),
  ('Kumaravel'),
  ('Meeran bai and Mohideen'),
  ('Murugesan'),
  ('Navaneetham'),
  ('Perumal'),
  ('Rajaendiren'),
  ('Srinivasan'),
  ('Suresh')
on conflict do nothing;

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  customer_id text,
  customer_name text not null,
  address text,
  mobile_number text,
  order_id text,
  notes text,
  vendor_id uuid references vendors(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'renew_soon', 'expiring_this_month', 'expired', 'renewed')),
  is_current boolean not null default true,
  notification_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- PUSH SUBSCRIPTIONS TABLE
-- =============================================
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_customers_vendor_id on customers(vendor_id);
create index if not exists idx_customers_name on customers(customer_name);
create index if not exists idx_subscriptions_customer_id on subscriptions(customer_id);
create index if not exists idx_subscriptions_end_date on subscriptions(end_date);
create index if not exists idx_subscriptions_is_current on subscriptions(is_current);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table vendors enable row level security;
alter table customers enable row level security;
alter table subscriptions enable row level security;
alter table push_subscriptions enable row level security;

-- Vendors: all authenticated users can read; only admins modify
create policy "Authenticated users can read vendors"
  on vendors for select to authenticated using (true);

create policy "Service role can manage vendors"
  on vendors for all to service_role using (true);

-- Customers: all authenticated users can CRUD
create policy "Authenticated users can read customers"
  on customers for select to authenticated using (true);

create policy "Authenticated users can insert customers"
  on customers for insert to authenticated with check (true);

create policy "Authenticated users can update customers"
  on customers for update to authenticated using (true);

create policy "Authenticated users can delete customers"
  on customers for delete to authenticated using (true);

-- Subscriptions: same as customers
create policy "Authenticated users can read subscriptions"
  on subscriptions for select to authenticated using (true);

create policy "Authenticated users can insert subscriptions"
  on subscriptions for insert to authenticated with check (true);

create policy "Authenticated users can update subscriptions"
  on subscriptions for update to authenticated using (true);

create policy "Authenticated users can delete subscriptions"
  on subscriptions for delete to authenticated using (true);

-- Push subscriptions
create policy "Users manage their push subscriptions"
  on push_subscriptions for all to authenticated using (user_id = auth.uid());

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_vendors_updated_at
  before update on vendors
  for each row execute function update_updated_at_column();

create trigger update_customers_updated_at
  before update on customers
  for each row execute function update_updated_at_column();

create trigger update_subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at_column();
