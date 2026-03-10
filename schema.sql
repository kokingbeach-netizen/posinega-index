-- ポジネガ指数 Supabase schema
-- Run this in Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- =====================
-- sources
-- =====================
create table if not exists sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text not null unique,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================
-- items
-- =====================
create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete cascade,
  title        text not null,
  url          text not null unique,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),

  -- AI 判定結果
  sentiment    text not null default 'neutral'
                 check (sentiment in ('positive', 'neutral', 'negative')),
  intensity    text not null default 'weak'
                 check (intensity in ('weak', 'medium', 'strong')),
  category     text not null default 'other'
                 check (category in (
                   'economy','politics','world','disaster',
                   'crime','health','tech','society','entertainment','other'
                 )),
  score        int  not null default 0,
  analyzed_at  timestamptz
);

create index if not exists items_published_at_idx       on items(published_at);
create index if not exists items_source_published_idx   on items(source_id, published_at);
create index if not exists items_analyzed_at_idx        on items(analyzed_at);

-- =====================
-- daily_snapshots
-- =====================
create table if not exists daily_snapshots (
  day              date primary key,    -- JST日付
  positive_points  int  not null,
  negative_points  int  not null,
  net_score        int  not null,
  items_count      int  not null,
  sources_count    int  not null,
  updated_at       timestamptz not null
);
