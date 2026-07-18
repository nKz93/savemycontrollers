-- Sous-ensemble hand-translated du schema Prisma (colonnes mappees via
-- @map, voir prisma/schema.prisma) utilise pour PROUVER contre un vrai
-- PostgreSQL 16 local que la convention de nommage et les requetes SQL
-- brutes (ReferenceGeneratorService, OutboxRepository) sont correctes,
-- independamment du blocage du moteur Prisma dans ce sandbox.

CREATE TABLE reference_counters (
  scope varchar(20) NOT NULL,
  year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, year)
);

CREATE TYPE outbox_status AS ENUM ('PENDING','PROCESSING','PROCESSED','FAILED');

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  payload_encrypted boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status outbox_status NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  correlation_id uuid NOT NULL,
  locked_at timestamptz,
  locked_by varchar(100),
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON outbox_events (status, next_attempt_at);

-- Table minimale pour prouver la conversion panier->commande idempotente
CREATE TABLE carts_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  converted_at timestamptz,
  converted_to_order_id uuid
);

CREATE TABLE orders_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(30) UNIQUE NOT NULL,
  subtotal_minor integer NOT NULL,
  tax_minor integer NOT NULL,
  total_minor integer NOT NULL,
  CONSTRAINT chk_orders_min_amounts_non_negative CHECK (subtotal_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0)
);

-- Contraintes de la section 4 du prompt, testees directement
CREATE TABLE volume_discount_rules_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_quantity integer NOT NULL,
  discount_basis_points integer NOT NULL,
  CONSTRAINT chk_vd_min_quantity_positive CHECK (min_quantity > 0),
  CONSTRAINT chk_vd_discount_range CHECK (discount_basis_points >= 0 AND discount_basis_points <= 10000)
);

CREATE TABLE lead_time_rules_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_days integer NOT NULL,
  max_days integer NOT NULL,
  CONSTRAINT chk_lead_time_range CHECK (min_days >= 0 AND min_days <= max_days)
);

CREATE TABLE addresses_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid,
  CONSTRAINT chk_addresses_single_owner CHECK (
    (user_id IS NOT NULL AND company_id IS NULL) OR (user_id IS NULL AND company_id IS NOT NULL)
  )
);

CREATE TABLE carts_owner_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid,
  guest_token_hash text,
  -- Etats valides exactement : (1) utilisateur particulier, avec ou sans
  -- entreprise associee (un employe agissant pour son entreprise reste
  -- identifie individuellement — exception metier justifiee) ; (2) invite
  -- protege par jeton, sans utilisateur ni entreprise. Toute combinaison
  -- melangeant jeton invite et identite (utilisateur ou entreprise) est
  -- rejetee, de meme qu'une entreprise seule sans utilisateur responsable,
  -- et qu'un panier totalement sans identite.
  CONSTRAINT chk_carts_ownership CHECK (
    (user_id IS NOT NULL AND guest_token_hash IS NULL)
    OR
    (user_id IS NULL AND company_id IS NULL AND guest_token_hash IS NOT NULL)
  )
);
