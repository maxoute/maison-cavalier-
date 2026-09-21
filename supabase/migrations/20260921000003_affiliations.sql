-- ============================================================
-- Recommandations : affiliation partenaire et suivi du devenir
-- de chaque partage (PRD §6.1.5, §6.3.4).
-- ============================================================

alter table public.recommendations
  add constraint recommendations_commission_range
    check (commission_rate is null or commission_rate between 0 and 100),
  add constraint recommendations_partner_rate
    check (not is_partner or commission_rate is not null);

alter table public.recommendation_shares
  -- Montant de la réservation déclaré par le résident ou le partenaire.
  add column booking_amount_cents integer
    check (booking_amount_cents is null or booking_amount_cents between 0 and 100000000),
  -- Commission figée au moment de la réservation : le taux du partenaire
  -- peut changer ensuite, les revenus déjà acquis ne bougent pas.
  add column commission_cents integer
    check (commission_cents is null or commission_cents >= 0),
  add column status_changed_at timestamptz;

-- Cycle de vie d'un partage : proposée → consultée → réservée, refus
-- possible tant que rien n'est réservé. Aucun retour en arrière.
create function public.share_transition() returns trigger
language plpgsql set search_path = public as $$
declare rate numeric(5,2); partner boolean;
begin
  if tg_op = 'INSERT' then
    new.status_changed_at := now();
    new.booking_amount_cents := null;
    new.commission_cents := null;
    return new;
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'proposee' and new.status in ('consultee', 'refusee'))
         or (old.status = 'consultee' and new.status in ('reservee', 'refusee'))) then
      raise exception 'Transition de recommandation invalide' using errcode = '23514';
    end if;
    new.status_changed_at := now();
    if new.status = 'reservee' then
      if new.booking_amount_cents is null then
        raise exception 'Montant de la réservation requis' using errcode = '23514';
      end if;
      select r.is_partner, r.commission_rate into partner, rate
        from public.recommendations r
       where r.id = new.recommendation_id and r.building_id = new.building_id;
      new.commission_cents := case when partner and rate is not null
        then round(new.booking_amount_cents * rate / 100) else 0 end;
    else
      new.booking_amount_cents := old.booking_amount_cents;
      new.commission_cents := old.commission_cents;
    end if;
  else
    -- Hors transition, le montant et la commission acquis sont figés.
    new.booking_amount_cents := old.booking_amount_cents;
    new.commission_cents := old.commission_cents;
    new.status_changed_at := old.status_changed_at;
  end if;
  return new;
end;
$$;
create trigger recommendation_share_transition
  before insert or update on public.recommendation_shares
  for each row execute function public.share_transition();

create trigger audit_recommendations
  after insert or update or delete on public.recommendations
  for each row execute function public.write_audit_log();
create trigger audit_recommendation_shares
  after insert or update or delete on public.recommendation_shares
  for each row execute function public.write_audit_log();

update public.recommendation_shares set status_changed_at = created_at where status_changed_at is null;
