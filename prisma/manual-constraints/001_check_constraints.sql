-- Contraintes SQL complementaires que Prisma ne peut pas exprimer
-- nativement dans schema.prisma (voir section 23 du prompt et ADR-023).
--
-- A APPLIQUER MANUELLEMENT apres la premiere migration Prisma (voir
-- section 24 du prompt : "inspecte le SQL produit, ajoute manuellement
-- les contraintes SQL necessaires"). Ce fichier n'a PAS ete execute dans
-- l'environnement de generation de cette phase (meme blocage reseau
-- Prisma que documente dans le rapport de fin de phase) : il est prepare
-- et revu manuellement, a executer des que la premiere migration reelle
-- aura ete appliquee.

-- Montants toujours positifs ou nuls
ALTER TABLE services ADD CONSTRAINT chk_services_base_price_non_negative CHECK (base_price_minor >= 0);
ALTER TABLE service_options ADD CONSTRAINT chk_service_options_extra_price_non_negative CHECK (extra_price_minor >= 0);
ALTER TABLE parts ADD CONSTRAINT chk_parts_purchase_cost_non_negative CHECK (purchase_cost_minor >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_orders_amounts_non_negative CHECK (
  subtotal_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0 AND shipping_fee_minor >= 0 AND total_minor >= 0
);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_amounts_non_negative CHECK (
  unit_price_minor_snapshot >= 0 AND discount_minor_snapshot >= 0 AND tax_amount_minor_snapshot >= 0 AND total_minor_snapshot >= 0
);

-- Taux de TVA (points de base) dans une plage realiste [0, 10000] (0% a 100%)
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_tax_rate_range CHECK (
  tax_rate_basis_points_snapshot >= 0 AND tax_rate_basis_points_snapshot <= 10000
);

-- Remises quantitatives entre 0 et 100% (10000 points de base)
ALTER TABLE volume_discount_rules ADD CONSTRAINT chk_volume_discount_range CHECK (
  discount_basis_points >= 0 AND discount_basis_points <= 10000
);

-- Quantite strictement positive
ALTER TABLE service_part_requirements ADD CONSTRAINT chk_service_part_requirements_quantity_positive CHECK (quantity > 0);
ALTER TABLE volume_discount_rules ADD CONSTRAINT chk_volume_discount_min_quantity_positive CHECK (min_quantity > 0);

-- Dates de validite coherentes (bornes de validite d'une regle de prix)
ALTER TABLE pricing_rules ADD CONSTRAINT chk_pricing_rules_valid_range CHECK (
  valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until
);
ALTER TABLE company_pricing_overrides ADD CONSTRAINT chk_company_overrides_valid_range CHECK (
  valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until
);

-- Delai estime coherent (minimum <= maximum)
ALTER TABLE lead_time_rules ADD CONSTRAINT chk_lead_time_rules_range CHECK (min_days >= 0 AND min_days <= max_days);

-- Exactement un proprietaire (utilisateur OU entreprise, jamais les deux, jamais aucun) pour une adresse
ALTER TABLE addresses ADD CONSTRAINT chk_addresses_single_owner CHECK (
  (user_id IS NOT NULL AND company_id IS NULL) OR (user_id IS NULL AND company_id IS NOT NULL)
);

-- Un panier appartient a un utilisateur OU est un panier invite (jamais les deux a la fois sans utilisateur)
-- Etats valides exactement (voir tests/e2e/raw-sql-proof/run.mjs pour la
-- preuve executee contre PostgreSQL reel, y compris tous les cas
-- invalides) : (1) utilisateur particulier, avec ou sans entreprise
-- associee (un employe agissant pour son entreprise reste identifie
-- individuellement — exception metier justifiee) ; (2) invite protege par
-- jeton, sans utilisateur ni entreprise.
ALTER TABLE carts ADD CONSTRAINT chk_carts_ownership CHECK (
  (user_id IS NOT NULL AND guest_token_hash IS NULL)
  OR
  (user_id IS NULL AND company_id IS NULL AND guest_token_hash IS NOT NULL)
);
