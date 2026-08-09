# Supabase database

This directory contains versioned Postgres migrations for the workout tracker. No remote Supabase project is provisioned by these files.

Weight values use integer tenths of a pound. For example, `1350` represents 135 lb and `25` represents 2.5 lb.

The initial migration establishes user ownership, immutable prescription snapshots, offline mutation identifiers, audit records, indexes, grants, and Row Level Security. The reference-data migration seeds muscle groups, the initial curated exercise catalog, and primary/secondary muscle contributions.

Before connecting a hosted project, validate the migrations against a local Supabase/Postgres instance and run the two-user RLS test suite described in the implementation plan.
