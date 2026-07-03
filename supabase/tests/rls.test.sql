-- ============================================================
-- Tests de sécurité RLS (PRD §4, §5) — exécutés via `npm run test:rls`
-- Chaque violation lève une exception => échec du script.
-- Le tout est joué dans une transaction annulée à la fin.
-- ============================================================
\set ON_ERROR_STOP on

begin;

-- Impersonation d'un utilisateur authentifié
create or replace function pg_temp.impersonate(u_id uuid, u_role text, b_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', u_id::text,
    'role', 'authenticated',
    'aal', 'aal2',
    'app_metadata', json_build_object('role', u_role, 'building_id', b_id::text)
  )::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.reset_role()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end;
$$;

do $$
declare
  n integer;
  marly constant uuid := '11111111-1111-1111-1111-111111111111';
  segur constant uuid := '22222222-2222-2222-2222-222222222222';
  concierge1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  syndic1 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  concierge2 constant uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  superadm constant uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  failed boolean;
begin
  -- ------------------------------------------------------------
  -- 1. Isolation inter-immeubles
  -- ------------------------------------------------------------
  perform pg_temp.impersonate(concierge1, 'concierge', marly);
  select count(*) into n from public.residents;
  if n <> 15 then
    raise exception 'TEST 1a ÉCHOUÉ : le concierge Marly devrait voir 15 résidents, en voit %', n;
  end if;

  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', segur);
  select count(*) into n from public.residents;
  if n <> 6 then
    raise exception 'TEST 1b ÉCHOUÉ : le concierge Ségur devrait voir 6 résidents, en voit %', n;
  end if;
  select count(*) into n from public.service_requests;
  if n <> 0 then
    raise exception 'TEST 1c ÉCHOUÉ : le concierge Ségur voit % demandes du Marly', n;
  end if;

  -- ------------------------------------------------------------
  -- 2. Le syndic ne voit AUCUNE donnée résident / service / paiement (PRD §4)
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(syndic1, 'syndic', marly);

  select count(*) into n from public.residents;
  if n <> 0 then
    raise exception 'TEST 2a ÉCHOUÉ : le syndic voit % fiches résident', n;
  end if;
  select count(*) into n from public.service_requests;
  if n <> 0 then
    raise exception 'TEST 2b ÉCHOUÉ : le syndic voit % demandes de service', n;
  end if;
  select count(*) into n from public.quotes;
  if n <> 0 then
    raise exception 'TEST 2c ÉCHOUÉ : le syndic voit % devis', n;
  end if;
  select count(*) into n from public.notifications;
  if n <> 0 then
    raise exception 'TEST 2d ÉCHOUÉ : le syndic voit % notifications', n;
  end if;
  select count(*) into n from public.audit_logs;
  if n <> 0 then
    raise exception 'TEST 2e ÉCHOUÉ : le syndic voit % lignes d''audit', n;
  end if;

  -- 2e2. Le syndic voit le staff de son immeuble mais aucun profil résident/chauffeur
  select count(*) into n from public.profiles where role in ('resident', 'chauffeur');
  if n <> 0 then
    raise exception 'TEST 2e2 ÉCHOUÉ : le syndic voit % profils résident/chauffeur', n;
  end if;
  select count(*) into n from public.profiles where role = 'concierge';
  if n < 1 then
    raise exception 'TEST 2e3 ÉCHOUÉ : le syndic devrait voir le concierge de son immeuble';
  end if;

  -- 2f. Le syndic accède bien à sa messagerie
  select count(*) into n from public.syndic_messages;
  if n < 3 then
    raise exception 'TEST 2f ÉCHOUÉ : le syndic devrait voir >= 3 messages, en voit %', n;
  end if;

  -- ------------------------------------------------------------
  -- 3. Écriture cross-tenant refusée (WITH CHECK)
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  perform pg_temp.impersonate(concierge2, 'concierge', segur);
  failed := false;
  begin
    insert into public.residents (building_id, full_name)
    values (marly, 'Intrus Cross-Tenant');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 3 ÉCHOUÉ : insertion cross-tenant acceptée';
  end if;

  -- ------------------------------------------------------------
  -- 4. audit_logs immuable
  -- ------------------------------------------------------------
  perform pg_temp.reset_role();
  failed := false;
  begin
    update public.audit_logs set action = 'falsifie' where true;
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 4a ÉCHOUÉ : update accepté sur audit_logs';
  end if;

  failed := false;
  begin
    delete from public.audit_logs where true;
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST 4b ÉCHOUÉ : delete accepté sur audit_logs';
  end if;

  -- ------------------------------------------------------------
  -- 5. Le super_admin voit tous les immeubles
  -- ------------------------------------------------------------
  perform pg_temp.impersonate(superadm, 'super_admin', marly);
  select count(*) into n from public.buildings;
  if n <> 3 then
    raise exception 'TEST 5 ÉCHOUÉ : le super_admin devrait voir 3 immeubles, en voit %', n;
  end if;
  select count(*) into n from public.residents;
  if n <> 29 then
    raise exception 'TEST 5b ÉCHOUÉ : le super_admin devrait voir 29 résidents, en voit %', n;
  end if;

  raise notice 'TOUS LES TESTS RLS SONT PASSÉS ✓';
end;
$$;

rollback;
