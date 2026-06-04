-- ============================================================================
-- Wavelength: Realtime Subscriptions
-- ============================================================================

do $$ begin
  begin alter publication supabase_realtime add table public.songs;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.votes;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments;  exception when duplicate_object then null; end;
end $$;
