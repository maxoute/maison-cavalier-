-- Une demande ne peut pas pointer vers le résident d'un autre immeuble.
alter table public.service_requests add constraint requests_resident_tenant
  foreign key (resident_id, building_id) references public.residents(id, building_id);
alter table public.service_requests add column completed_at timestamptz;

create function public.check_request_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.status <> 'nouveau' then
      raise exception 'Une demande doit commencer au statut nouveau' using errcode = '23514';
    end if;
    new.completed_at := null;
  elsif new.status is distinct from old.status then
    if not ((old.status = 'nouveau' and new.status in ('en_cours', 'en_attente'))
      or (old.status = 'en_cours' and new.status in ('en_attente', 'termine'))
      or (old.status = 'en_attente' and new.status = 'en_cours')) then
      raise exception 'Transition de demande invalide' using errcode = '23514';
    end if;
    new.completed_at := case when new.status = 'termine' then now() else null end;
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;
create trigger request_transition before insert or update on public.service_requests
  for each row execute function public.check_request_transition();

-- Publication requise pour les abonnements Realtime filtrés par immeuble.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests') then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end;
$$;
