-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR');

-- CreateEnum
CREATE TYPE "PublishableStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'COMPANY_MEMBER', 'STAFF');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'CLIENT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "FileRelatedEntityType" AS ENUM ('ORDER', 'REPAIR_CASE', 'SUPPORT_TICKET', 'COMPANY', 'MEDIA_LIBRARY');

-- CreateEnum
CREATE TYPE "MediaRelatedEntityType" AS ENUM ('BRAND', 'DEVICE_MODEL', 'SERVICE', 'SERVICE_OPTION');

-- CreateEnum
CREATE TYPE "ServiceCategoryKind" AS ENUM ('REPAIR', 'CUSTOMIZATION', 'CLICK_MOUSE_MOD', 'BACK_PADDLES');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyInternalRole" AS ENUM ('OWNER', 'MANAGER', 'BUYER');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('STANDARD', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "RepairPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "OrderFinancialStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderOperationalStatus" AS ENUM ('CREATED', 'AWAITING_SHIPMENT_FROM_CLIENT', 'IN_PROGRESS', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('REGISTERED', 'INSTALLED', 'ACTIVE', 'DISABLED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "account_type" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "email_verified_at" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(60),
    "replaced_by_session_id" UUID,
    "user_agent" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "vat_number" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "internal_role" "CompanyInternalRole" NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "company_id" UUID,
    "label" TEXT,
    "recipient_name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "postal_code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "phone" TEXT,
    "is_default_billing" BOOLEAN NOT NULL DEFAULT false,
    "is_default_shipping" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_type" "AuditActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "result" "AuditResult" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" UUID NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "value_string" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_boolean" BOOLEAN,
    "value_json" JSONB,
    "is_secret_ref" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "setting_history" (
    "id" UUID NOT NULL,
    "setting_key" TEXT NOT NULL,
    "old_value_json" JSONB,
    "new_value_json" JSONB,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" UUID,

    CONSTRAINT "setting_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "visibility" "FileVisibility" NOT NULL,
    "uploaded_by_user_id" UUID,
    "related_entity_type" "FileRelatedEntityType",
    "related_entity_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "short_description" TEXT,
    "long_description" TEXT,
    "logo_file_id" UUID,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_families" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "short_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "short_description" TEXT,
    "long_description" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_variants" (
    "id" UUID NOT NULL,
    "device_model_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "device_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_revisions" (
    "id" UUID NOT NULL,
    "device_variant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ServiceCategoryKind" NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "short_description" TEXT,
    "long_description" TEXT,
    "base_price_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "default_warranty_policy_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_options" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "extra_price_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PublishableStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "price_minor" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "is_cumulative_with_discounts" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_pack_items" (
    "id" UUID NOT NULL,
    "service_pack_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "service_pack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "supplier_id" UUID,
    "purchase_cost_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "min_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_variants" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "additional_cost_minor" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "related_entity_type" "MediaRelatedEntityType" NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "alt_text" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "exclusions" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "product_family_id" UUID,
    "device_model_id" UUID,
    "device_variant_id" UUID,
    "hardware_revision_id" UUID,
    "part_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "required_service_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusion_rules" (
    "id" UUID NOT NULL,
    "service_a_id" UUID NOT NULL,
    "service_b_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exclusion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "recommended_service_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "product_family_id" UUID,
    "device_model_id" UUID,
    "device_variant_id" UUID,
    "client_type" "ClientType" NOT NULL DEFAULT 'STANDARD',
    "amount_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "valid_from" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volume_discount_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID,
    "company_id" UUID,
    "min_quantity" INTEGER NOT NULL,
    "discount_basis_points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volume_discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_pricing_overrides" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "valid_from" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_pricing_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_time_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "product_family_id" UUID,
    "device_model_id" UUID,
    "min_days" INTEGER NOT NULL,
    "max_days" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_time_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_part_requirements" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "service_part_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "company_id" UUID,
    "guest_token_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "converted_at" TIMESTAMPTZ(3),
    "converted_to_order_id" UUID,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "device_model_id" UUID NOT NULL,
    "device_variant_id" UUID NOT NULL,
    "hardware_revision_id" UUID,
    "reported_issue" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_services" (
    "cart_item_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "cart_item_services_pkey" PRIMARY KEY ("cart_item_id","service_id")
);

-- CreateTable
CREATE TABLE "cart_item_options" (
    "cart_item_id" UUID NOT NULL,
    "service_option_id" UUID NOT NULL,

    CONSTRAINT "cart_item_options_pkey" PRIMARY KEY ("cart_item_id","service_option_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "user_id" UUID,
    "company_id" UUID,
    "financial_status" "OrderFinancialStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "operational_status" "OrderOperationalStatus" NOT NULL DEFAULT 'CREATED',
    "billing_address_id" UUID,
    "shipping_address_id" UUID,
    "billing_recipient_name" VARCHAR(200) NOT NULL,
    "billing_company_name" VARCHAR(200),
    "billing_line1" VARCHAR(255) NOT NULL,
    "billing_line2" VARCHAR(255),
    "billing_postal_code" VARCHAR(20) NOT NULL,
    "billing_city" VARCHAR(120) NOT NULL,
    "billing_country" VARCHAR(2) NOT NULL,
    "billing_phone" VARCHAR(30),
    "shipping_recipient_name" VARCHAR(200) NOT NULL,
    "shipping_company_name" VARCHAR(200),
    "shipping_line1" VARCHAR(255) NOT NULL,
    "shipping_line2" VARCHAR(255),
    "shipping_postal_code" VARCHAR(20) NOT NULL,
    "shipping_city" VARCHAR(120) NOT NULL,
    "shipping_country" VARCHAR(2) NOT NULL,
    "shipping_phone" VARCHAR(30),
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL,
    "shipping_fee_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "cancelled_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "OrderOperationalStatus" NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" UUID,
    "changed_by_system" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "device_model_id" UUID NOT NULL,
    "device_variant_id" UUID NOT NULL,
    "hardware_revision_id" UUID,
    "device_model_name_snapshot" TEXT NOT NULL,
    "device_variant_name_snapshot" TEXT NOT NULL,
    "hardware_revision_label_snapshot" TEXT,
    "reported_issue_snapshot" TEXT,
    "unit_price_minor_snapshot" INTEGER NOT NULL,
    "discount_minor_snapshot" INTEGER NOT NULL DEFAULT 0,
    "tax_rate_basis_points_snapshot" INTEGER NOT NULL,
    "tax_amount_minor_snapshot" INTEGER NOT NULL,
    "total_minor_snapshot" INTEGER NOT NULL,
    "currency_snapshot" "Currency" NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_service_snapshots" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "service_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "price_minor_snapshot" INTEGER NOT NULL,

    CONSTRAINT "order_item_service_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_option_snapshots" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "service_option_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "price_minor_snapshot" INTEGER NOT NULL,

    CONSTRAINT "order_item_option_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_status_definitions" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_status_definitions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "repair_status_transitions" (
    "id" UUID NOT NULL,
    "from_status_key" TEXT NOT NULL,
    "to_status_key" TEXT NOT NULL,
    "is_system_protected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "repair_status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_cases" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "qr_token_hash" TEXT NOT NULL,
    "qr_token_revoked_at" TIMESTAMPTZ(3),
    "public_tracking_token_hash" TEXT,
    "public_tracking_token_revoked_at" TIMESTAMPTZ(3),
    "client_id" UUID,
    "company_id" UUID,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "device_model_id" UUID NOT NULL,
    "device_variant_id" UUID NOT NULL,
    "hardware_revision_id" UUID,
    "serial_number" TEXT,
    "reported_issue" TEXT,
    "technician_diagnosis" TEXT,
    "assigned_technician_id" UUID,
    "priority" "RepairPriority" NOT NULL DEFAULT 'NORMAL',
    "status_key" TEXT NOT NULL,
    "estimated_ready_at" TIMESTAMPTZ(3),
    "actual_ready_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "unrepairable_reason" TEXT,
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repair_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_status_history" (
    "id" UUID NOT NULL,
    "repair_case_id" UUID NOT NULL,
    "status_key" TEXT NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" UUID,
    "comment" TEXT,

    CONSTRAINT "repair_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_notes" (
    "id" UUID NOT NULL,
    "repair_case_id" UUID NOT NULL,
    "author_user_id" UUID,
    "visibility" "NoteVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_case_files" (
    "repair_case_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,

    CONSTRAINT "repair_case_files_pkey" PRIMARY KEY ("repair_case_id","file_id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "original_repair_case_id" UUID NOT NULL,
    "warranty_policy_id" UUID,
    "reason" TEXT NOT NULL,
    "accepted" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "correlation_id" UUID NOT NULL,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by" VARCHAR(100),
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_counters" (
    "scope" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("scope","year")
);

-- CreateTable
CREATE TABLE "extension_manifests" (
    "id" UUID NOT NULL,
    "extension_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "description" TEXT,
    "compatibility_range" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'REGISTERED',
    "installed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extension_event_logs" (
    "id" UUID NOT NULL,
    "extension_key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "message" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "users"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "company_members_company_id_user_id_key" ON "company_members"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "addresses_company_id_idx" ON "addresses"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "setting_history_setting_key_idx" ON "setting_history"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storage_key_key" ON "file_assets"("storage_key");

-- CreateIndex
CREATE INDEX "file_assets_related_entity_type_related_entity_id_idx" ON "file_assets"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_families_brand_id_slug_key" ON "product_families"("brand_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_family_id_slug_key" ON "device_models"("family_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_revisions_device_variant_id_code_key" ON "hardware_revisions"("device_variant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_options_service_id_slug_key" ON "service_options"("service_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_packs_slug_key" ON "service_packs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_pack_items_service_pack_id_service_id_key" ON "service_pack_items"("service_pack_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sku_key" ON "parts"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "part_variants_sku_key" ON "part_variants"("sku");

-- CreateIndex
CREATE INDEX "media_assets_related_entity_type_related_entity_id_idx" ON "media_assets"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "compatibility_rules_service_id_idx" ON "compatibility_rules"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_rules_service_id_required_service_id_key" ON "requirement_rules"("service_id", "required_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "exclusion_rules_service_a_id_service_b_id_key" ON "exclusion_rules"("service_a_id", "service_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_rules_service_id_recommended_service_id_key" ON "recommendation_rules"("service_id", "recommended_service_id");

-- CreateIndex
CREATE INDEX "pricing_rules_service_id_client_type_idx" ON "pricing_rules"("service_id", "client_type");

-- CreateIndex
CREATE UNIQUE INDEX "company_pricing_overrides_company_id_service_id_key" ON "company_pricing_overrides"("company_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_part_requirements_service_id_part_id_key" ON "service_part_requirements"("service_id", "part_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_guest_token_hash_key" ON "carts"("guest_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "carts_converted_to_order_id_key" ON "carts"("converted_to_order_id");

-- CreateIndex
CREATE INDEX "carts_user_id_idx" ON "carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_device_model_id_idx" ON "cart_items"("device_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_company_id_idx" ON "orders"("company_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "repair_status_transitions_from_status_key_to_status_key_key" ON "repair_status_transitions"("from_status_key", "to_status_key");

-- CreateIndex
CREATE UNIQUE INDEX "repair_cases_reference_key" ON "repair_cases"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "repair_cases_qr_token_hash_key" ON "repair_cases"("qr_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "repair_cases_public_tracking_token_hash_key" ON "repair_cases"("public_tracking_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "repair_cases_order_item_id_key" ON "repair_cases"("order_item_id");

-- CreateIndex
CREATE INDEX "repair_cases_client_id_idx" ON "repair_cases"("client_id");

-- CreateIndex
CREATE INDEX "repair_cases_company_id_idx" ON "repair_cases"("company_id");

-- CreateIndex
CREATE INDEX "repair_cases_status_key_idx" ON "repair_cases"("status_key");

-- CreateIndex
CREATE INDEX "repair_cases_assigned_technician_id_idx" ON "repair_cases"("assigned_technician_id");

-- CreateIndex
CREATE INDEX "repair_status_history_repair_case_id_idx" ON "repair_status_history"("repair_case_id");

-- CreateIndex
CREATE INDEX "repair_notes_repair_case_id_visibility_idx" ON "repair_notes"("repair_case_id", "visibility");

-- CreateIndex
CREATE INDEX "warranty_claims_original_repair_case_id_idx" ON "warranty_claims"("original_repair_case_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_manifests_extension_key_key" ON "extension_manifests"("extension_key");

-- CreateIndex
CREATE INDEX "extension_event_logs_extension_key_idx" ON "extension_event_logs"("extension_key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_history" ADD CONSTRAINT "setting_history_setting_key_fkey" FOREIGN KEY ("setting_key") REFERENCES "settings"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_families" ADD CONSTRAINT "product_families_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "product_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_variants" ADD CONSTRAINT "device_variants_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_revisions" ADD CONSTRAINT "hardware_revisions_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_default_warranty_policy_id_fkey" FOREIGN KEY ("default_warranty_policy_id") REFERENCES "warranty_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_pack_items" ADD CONSTRAINT "service_pack_items_service_pack_id_fkey" FOREIGN KEY ("service_pack_id") REFERENCES "service_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_pack_items" ADD CONSTRAINT "service_pack_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_variants" ADD CONSTRAINT "part_variants_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_product_family_id_fkey" FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_hardware_revision_id_fkey" FOREIGN KEY ("hardware_revision_id") REFERENCES "hardware_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_rules" ADD CONSTRAINT "requirement_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_rules" ADD CONSTRAINT "requirement_rules_required_service_id_fkey" FOREIGN KEY ("required_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusion_rules" ADD CONSTRAINT "exclusion_rules_service_a_id_fkey" FOREIGN KEY ("service_a_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exclusion_rules" ADD CONSTRAINT "exclusion_rules_service_b_id_fkey" FOREIGN KEY ("service_b_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_recommended_service_id_fkey" FOREIGN KEY ("recommended_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_product_family_id_fkey" FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_discount_rules" ADD CONSTRAINT "volume_discount_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_discount_rules" ADD CONSTRAINT "volume_discount_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pricing_overrides" ADD CONSTRAINT "company_pricing_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pricing_overrides" ADD CONSTRAINT "company_pricing_overrides_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_time_rules" ADD CONSTRAINT "lead_time_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_time_rules" ADD CONSTRAINT "lead_time_rules_product_family_id_fkey" FOREIGN KEY ("product_family_id") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_time_rules" ADD CONSTRAINT "lead_time_rules_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_hardware_revision_id_fkey" FOREIGN KEY ("hardware_revision_id") REFERENCES "hardware_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_services" ADD CONSTRAINT "cart_item_services_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_services" ADD CONSTRAINT "cart_item_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_options" ADD CONSTRAINT "cart_item_options_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_options" ADD CONSTRAINT "cart_item_options_service_option_id_fkey" FOREIGN KEY ("service_option_id") REFERENCES "service_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_fkey" FOREIGN KEY ("billing_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_hardware_revision_id_fkey" FOREIGN KEY ("hardware_revision_id") REFERENCES "hardware_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_service_snapshots" ADD CONSTRAINT "order_item_service_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_service_snapshots" ADD CONSTRAINT "order_item_service_snapshots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_option_snapshots" ADD CONSTRAINT "order_item_option_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_option_snapshots" ADD CONSTRAINT "order_item_option_snapshots_service_option_id_fkey" FOREIGN KEY ("service_option_id") REFERENCES "service_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_transitions" ADD CONSTRAINT "repair_status_transitions_from_status_key_fkey" FOREIGN KEY ("from_status_key") REFERENCES "repair_status_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_transitions" ADD CONSTRAINT "repair_status_transitions_to_status_key_fkey" FOREIGN KEY ("to_status_key") REFERENCES "repair_status_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_device_variant_id_fkey" FOREIGN KEY ("device_variant_id") REFERENCES "device_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_hardware_revision_id_fkey" FOREIGN KEY ("hardware_revision_id") REFERENCES "hardware_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_cases" ADD CONSTRAINT "repair_cases_status_key_fkey" FOREIGN KEY ("status_key") REFERENCES "repair_status_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_history" ADD CONSTRAINT "repair_status_history_repair_case_id_fkey" FOREIGN KEY ("repair_case_id") REFERENCES "repair_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_history" ADD CONSTRAINT "repair_status_history_status_key_fkey" FOREIGN KEY ("status_key") REFERENCES "repair_status_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_notes" ADD CONSTRAINT "repair_notes_repair_case_id_fkey" FOREIGN KEY ("repair_case_id") REFERENCES "repair_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_notes" ADD CONSTRAINT "repair_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_case_files" ADD CONSTRAINT "repair_case_files_repair_case_id_fkey" FOREIGN KEY ("repair_case_id") REFERENCES "repair_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_case_files" ADD CONSTRAINT "repair_case_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_original_repair_case_id_fkey" FOREIGN KEY ("original_repair_case_id") REFERENCES "repair_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warranty_policy_id_fkey" FOREIGN KEY ("warranty_policy_id") REFERENCES "warranty_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_event_logs" ADD CONSTRAINT "extension_event_logs_extension_key_fkey" FOREIGN KEY ("extension_key") REFERENCES "extension_manifests"("extension_key") ON DELETE CASCADE ON UPDATE CASCADE;
