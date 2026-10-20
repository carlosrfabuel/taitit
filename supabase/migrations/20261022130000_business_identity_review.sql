-- Client decision (2026-10-19): an approved optician who changes the identity TAITIT approved
-- (business name, legal name or tax ID) goes back to "pending" until TAITIT reviews the account
-- again. Contact details (phone, address, postal code, city, province) can change freely.
-- Only the customer's own edits count, and only changes of a value TAITIT saw: filling in a field
-- that was empty (accounts approved before business details existed) keeps the approval. Blank and
-- spaces-only values count as empty, so saving the form unchanged (or only trimming spaces) is no change.

create or replace function private.review_business_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved'
     and new.status = 'approved'
     and new.role = 'customer'
     and auth.uid() = new.id
     and (nullif(btrim(old.business_name), '') is not null
          and nullif(btrim(new.business_name), '') is distinct from nullif(btrim(old.business_name), '')
       or nullif(btrim(old.legal_name), '') is not null
          and nullif(btrim(new.legal_name), '') is distinct from nullif(btrim(old.legal_name), '')
       or nullif(btrim(old.tax_id), '') is not null
          and nullif(btrim(new.tax_id), '') is distinct from nullif(btrim(old.tax_id), ''))
  then
    new.status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

revoke all on function private.review_business_identity() from public, anon, authenticated;

create trigger profiles_business_identity_review
  before update of business_name, legal_name, tax_id on public.profiles
  for each row execute function private.review_business_identity();
