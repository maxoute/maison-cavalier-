-- ============================================================
-- Reporting mensuel du syndic (PRD §6.2, §7.4).
--
-- Le syndic n'a AUCUNE policy sur residents, service_requests,
-- intervention_incidents ou announcements : l'isolation reste celle de la
-- base. Son rapport passe donc par cette unique fonction SECURITY DEFINER,
-- qui ne renvoie que des agrégats du mois — jamais un nom, un e-mail, un
-- téléphone, un montant ni le contenu d'une demande.
--
-- Le mois est un mois calendaire d'Europe/Paris : le rapport de septembre
-- couvre [1er sept. 00h00 Paris, 1er oct. 00h00 Paris[, quel que soit le
-- fuseau du serveur applicatif.
-- ============================================================

create or replace function public.syndic_monthly_report(p_building_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  period_start timestamptz;
  period_end timestamptz;
  requests_total integer;
  requests_completed integer;
  requests_urgent integer;
  by_service jsonb;
  sla_measured integer;
  sla_respected integer;
  incidents_total integer;
  incidents_grave integer;
  incidents_resolved integer;
  announcements_total integer;
  announcements_urgent integer;
  messages_total integer;
  messages_incidents integer;
  satisfaction numeric;
  satisfaction_rated integer;
  residents_total integer;
  trend jsonb;
begin
  -- Habilitation : le super-admin voit tous les immeubles ; le syndic, le
  -- concierge et l'admin uniquement celui de leur JWT. Tout le reste échoue.
  if not (
    public.is_super_admin()
    or (public.auth_building_id() = p_building_id
        and public.auth_role() in ('syndic', 'concierge', 'admin'))
  ) then
    raise exception 'Reporting réservé aux comptes de cet immeuble'
      using errcode = '42501';
  end if;
  if p_building_id is null or p_month is null then
    raise exception 'Immeuble et mois requis' using errcode = '22023';
  end if;

  period_start := (date_trunc('month', p_month))::timestamp at time zone 'Europe/Paris';
  period_end := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Europe/Paris';

  select
    count(*),
    count(*) filter (where sr.status = 'termine'),
    count(*) filter (where sr.priority = 'urgente'),
    -- SLA : clôture horodatée par le workflow ; les demandes reprises avant
    -- l'horodatage de clôture retombent sur leur dernière mise à jour.
    count(*) filter (where sr.status = 'termine' and sr.sla_deadline is not null),
    count(*) filter (where sr.status = 'termine' and sr.sla_deadline is not null
                       and coalesce(sr.completed_at, sr.updated_at) <= sr.sla_deadline)
  into requests_total, requests_completed, requests_urgent, sla_measured, sla_respected
  from public.service_requests sr
  where sr.building_id = p_building_id
    and sr.created_at >= period_start and sr.created_at < period_end;

  select coalesce(jsonb_object_agg(s.service, s.total), '{}'::jsonb)
  into by_service
  from (
    select sr.service::text as service, count(*) as total
    from public.service_requests sr
    where sr.building_id = p_building_id
      and sr.created_at >= period_start and sr.created_at < period_end
    group by sr.service
  ) s;

  select count(*),
         count(*) filter (where i.severity = 'grave'),
         count(*) filter (where i.resolved_at is not null)
  into incidents_total, incidents_grave, incidents_resolved
  from public.intervention_incidents i
  where i.building_id = p_building_id
    and i.created_at >= period_start and i.created_at < period_end;

  select count(*), count(*) filter (where a.urgent)
  into announcements_total, announcements_urgent
  from public.announcements a
  where a.building_id = p_building_id
    and a.created_at >= period_start and a.created_at < period_end;

  select count(*), count(*) filter (where m.is_incident)
  into messages_total, messages_incidents
  from public.syndic_messages m
  where m.building_id = p_building_id
    and m.created_at >= period_start and m.created_at < period_end;

  -- Satisfaction : la moyenne de l'immeuble, jamais une note individuelle.
  select round(avg(r.satisfaction_score), 2),
         count(*) filter (where r.satisfaction_score is not null),
         count(*)
  into satisfaction, satisfaction_rated, residents_total
  from public.residents r
  where r.building_id = p_building_id;

  select jsonb_agg(point order by point ->> 'month')
  into trend
  from (
    select jsonb_build_object(
      'month', to_char(m.start_month, 'YYYY-MM'),
      'total', (
        select count(*)
        from public.service_requests sr
        where sr.building_id = p_building_id
          and sr.created_at >= (m.start_month)::timestamp at time zone 'Europe/Paris'
          and sr.created_at < (m.start_month + interval '1 month')::timestamp at time zone 'Europe/Paris'
      )
    ) as point
    from generate_series(
      date_trunc('month', p_month) - interval '11 months',
      date_trunc('month', p_month),
      interval '1 month'
    ) as m(start_month)
  ) points;

  return jsonb_build_object(
    'building_id', p_building_id,
    'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
    'period_start', period_start,
    'period_end', period_end,
    'requests', jsonb_build_object(
      'total', requests_total,
      'completed', requests_completed,
      'urgent', requests_urgent,
      'by_service', by_service
    ),
    'sla', jsonb_build_object(
      'measured', sla_measured,
      'respected', sla_respected,
      'rate', case when sla_measured > 0
        then round(sla_respected::numeric / sla_measured, 4) else null end
    ),
    'incidents', jsonb_build_object(
      'total', incidents_total,
      'grave', incidents_grave,
      'resolved', incidents_resolved
    ),
    'announcements', jsonb_build_object('total', announcements_total, 'urgent', announcements_urgent),
    'syndic_messages', jsonb_build_object('total', messages_total, 'incidents', messages_incidents),
    'satisfaction', jsonb_build_object('average', satisfaction, 'rated_residents', satisfaction_rated),
    'residents', residents_total,
    'trend', coalesce(trend, '[]'::jsonb)
  );
end;
$$;

comment on function public.syndic_monthly_report(uuid, date) is
  'Rapport mensuel agrégé d’un immeuble pour le portail syndic : aucun nom, contact, montant ni contenu de demande (PRD §6.2, §7.4).';

-- Aucune exécution anonyme : le rapport suppose un JWT portant rôle et immeuble.
revoke all on function public.syndic_monthly_report(uuid, date) from public;
revoke all on function public.syndic_monthly_report(uuid, date) from anon;
grant execute on function public.syndic_monthly_report(uuid, date) to authenticated;
grant execute on function public.syndic_monthly_report(uuid, date) to service_role;
