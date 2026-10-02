-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTNER', 'MANAGER', 'JUNIOR_CA', 'ARTICLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('INDIVIDUAL', 'HUF', 'PARTNERSHIP_FIRM', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER');

-- CreateEnum
CREATE TYPE "ConstitutionType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'COMPANY', 'LLP', 'TRUST', 'SOCIETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "GstRegistrationType" AS ENUM ('REGULAR', 'COMPOSITION', 'CASUAL', 'SEZ', 'ISD');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'BOOLEAN', 'URL');

-- CreateEnum
CREATE TYPE "EngagementCategory" AS ENUM ('GST', 'INCOME_TAX', 'TDS', 'ROC_COMPLIANCE', 'AUDIT', 'PAYROLL', 'ADVISORY', 'ACCOUNTING', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONE_OFF', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TO_DO', 'IN_PROGRESS', 'AWAITING_CLIENT', 'UNDER_REVIEW', 'PARTNER_APPROVAL', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'REVIEWER_CHANGED', 'DUE_DATE_CHANGED', 'PRIORITY_CHANGED', 'CHECKLIST_ITEM_COMPLETED', 'CHECKLIST_ITEM_UNCOMPLETED', 'COMMENT_ADDED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'RECURRING_INSTANCE_CREATED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GENERAL', 'CLIENT_PROVIDED', 'WORKING_PAPER', 'FILED_RETURN', 'ACKNOWLEDGEMENT', 'ENGAGEMENT_LETTER', 'INVOICE', 'BANK_STATEMENT', 'FORM_26AS', 'AIS', 'SALARY_REGISTER', 'PURCHASE_REGISTER', 'SALES_REGISTER', 'BALANCE_SHEET', 'PROFIT_LOSS', 'AUDIT_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('TEAM_UPLOAD', 'CLIENT_UPLOAD', 'AUTO_GENERATED');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'REMINDED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'REQUESTED', 'RECEIVED', 'VERIFIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PortalType" AS ENUM ('GST', 'INCOME_TAX', 'MCA', 'TRACES', 'TDS_CPC', 'EPFO', 'ESIC', 'DGFT', 'CUSTOMS', 'RBI', 'SEBI', 'OTHER');

-- CreateEnum
CREATE TYPE "CredentialAction" AS ENUM ('VIEWED', 'COPIED', 'UPDATED', 'CREATED');

-- CreateEnum
CREATE TYPE "DscClass" AS ENUM ('CLASS_2', 'CLASS_3');

-- CreateEnum
CREATE TYPE "DscType" AS ENUM ('INDIVIDUAL', 'ORGANISATION', 'DGFT');

-- CreateEnum
CREATE TYPE "DscStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'RENEWED');

-- CreateEnum
CREATE TYPE "DscHolderType" AS ENUM ('CLIENT', 'PARTNER');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EXAM', 'TRAINING', 'PUBLIC_HOLIDAY', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_OVERDUE', 'TASK_STUCK', 'TASK_DEPENDENCY_UNBLOCKED', 'TASK_REVIEW_REQUESTED', 'TASK_APPROVAL_REQUESTED', 'TASK_SENT_BACK', 'COMMENT_MENTION', 'DOCUMENT_REQUEST_SENT', 'DOCUMENT_REQUEST_FULFILLED', 'DOCUMENT_REQUEST_OVERDUE', 'DOCUMENT_REQUEST_REMINDER', 'DSC_EXPIRY_ALERT_30', 'DSC_EXPIRY_ALERT_15', 'DSC_EXPIRY_ALERT_7', 'COMPLIANCE_DEADLINE_APPROACHING', 'COMPLIANCE_DEADLINE_MISSED', 'USER_DEACTIVATED_WITH_OPEN_TASKS', 'ASSIGNEE_ON_LEAVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ComplianceEntryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FILED', 'MISSED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "user_action_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(15),
    "full_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "avatar_url" VARCHAR(500),
    "whatsapp_number" VARCHAR(15),
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "old_role" "UserRole" NOT NULL,
    "new_role" "UserRole" NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(300),
    "entity_type" "EntityType" NOT NULL,
    "constitution" "ConstitutionType",
    "pan" VARCHAR(10),
    "tan" VARCHAR(10),
    "cin" VARCHAR(21),
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "primary_contact_name" VARCHAR(100),
    "primary_contact_phone" VARCHAR(15),
    "primary_contact_email" VARCHAR(255),
    "address" JSONB,
    "notes" TEXT,
    "tags" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "assigned_partner_id" UUID,
    "assigned_manager_id" UUID,
    "assigned_junior_id" UUID,
    "assigned_article_id" UUID,
    "onboarded_at" DATE,
    "financial_year_end" SMALLINT NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_gst_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "gstin" VARCHAR(15) NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "trade_name" VARCHAR(200),
    "registration_type" "GstRegistrationType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" DATE,
    "cancelled_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "client_gst_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "field_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[],
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "client_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deadlines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "EngagementCategory" NOT NULL,
    "applicable_to" "EntityType"[],
    "recurrence" "RecurrenceType" NOT NULL,
    "recurrence_day" SMALLINT,
    "recurrence_month" SMALLINT,
    "quarter_month_offset" SMALLINT,
    "penalty_per_day" DECIMAL(10,2),
    "penalty_flat" DECIMAL(10,2),
    "penalty_notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_engagement_type_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_deadline_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statutory_deadline_id" UUID NOT NULL,
    "period_label" VARCHAR(50) NOT NULL,
    "original_date" DATE NOT NULL,
    "extended_date" DATE NOT NULL,
    "notification_source" VARCHAR(500),
    "applied_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_deadline_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_compliance_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "statutory_deadline_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_generate_tasks" BOOLEAN NOT NULL DEFAULT true,
    "task_template_id" UUID,
    "internal_buffer_days" SMALLINT,
    "custom_due_date_day" SMALLINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "client_compliance_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_calendar_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "statutory_deadline_id" UUID NOT NULL,
    "period_label" VARCHAR(50) NOT NULL,
    "due_date" DATE NOT NULL,
    "internal_due_date" DATE NOT NULL,
    "status" "ComplianceEntryStatus" NOT NULL DEFAULT 'PENDING',
    "linked_task_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_calendar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_locker_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "portal" "PortalType" NOT NULL,
    "portal_label" VARCHAR(100),
    "username" VARCHAR(200) NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "registered_phone" VARCHAR(15),
    "registered_email" VARCHAR(255),
    "notes" TEXT,
    "last_changed_at" DATE,
    "last_accessed_at" TIMESTAMPTZ,
    "last_accessed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "credential_locker_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_access_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "accessed_by" UUID NOT NULL,
    "accessed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "action" "CredentialAction" NOT NULL,

    CONSTRAINT "credential_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID,
    "engagement_id" UUID,
    "task_id" UUID,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "document_type" "DocumentType" NOT NULL DEFAULT 'GENERAL',
    "storage_key" VARCHAR(500) NOT NULL,
    "storage_bucket" VARCHAR(100) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "version" SMALLINT NOT NULL DEFAULT 1,
    "version_of_id" UUID,
    "uploaded_by" UUID NOT NULL,
    "source" "DocumentSource" NOT NULL DEFAULT 'TEAM_UPLOAD',
    "tags" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "is_client_visible" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "engagement_id" UUID,
    "task_id" UUID,
    "requested_by" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "upload_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "upload_token_expires_at" TIMESTAMPTZ NOT NULL,
    "reminder_sent_count" SMALLINT NOT NULL DEFAULT 0,
    "last_reminder_sent_at" TIMESTAMPTZ,
    "fulfilled_by_document_id" UUID,
    "fulfilled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_checklist_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID,
    "engagement_type_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "document_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_checklist_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "document_type" "DocumentType",
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_checklist_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "template_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_checklist_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_checklist_instance_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checklist_instance_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "document_type" "DocumentType",
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "document_id" UUID,
    "document_request_id" UUID,
    "waived_reason" TEXT,
    "waived_by" UUID,
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "document_checklist_instance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsc_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "holder_type" "DscHolderType" NOT NULL,
    "client_id" UUID,
    "user_id" UUID,
    "holder_name" VARCHAR(200) NOT NULL,
    "class" "DscClass" NOT NULL,
    "type" "DscType" NOT NULL,
    "issued_by" VARCHAR(200),
    "serial_number" VARCHAR(100),
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" "DscStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewed_by_id" UUID,
    "storage_location" VARCHAR(300),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "dsc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "category" "EngagementCategory" NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'ONE_OFF',
    "default_task_template_id" UUID,
    "requires_partner_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "engagement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "engagement_type_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'ACTIVE',
    "period_label" VARCHAR(50),
    "period_start" DATE,
    "period_end" DATE,
    "assigned_partner_id" UUID,
    "assigned_manager_id" UUID,
    "assigned_team" UUID[] DEFAULT ARRAY[]::UUID[],
    "fee_amount" DECIMAL(12,2),
    "fee_currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "engagement_type_id" UUID NOT NULL,
    "field_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR(100)[],
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "engagement_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(100),
    "icai_registration" VARCHAR(20),
    "pan" VARCHAR(10),
    "gst_number" VARCHAR(15),
    "address" JSONB,
    "phone" VARCHAR(15),
    "email" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "financial_year_start" SMALLINT NOT NULL DEFAULT 4,
    "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscription_expires_at" TIMESTAMPTZ,
    "max_users" SMALLINT NOT NULL DEFAULT 3,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "failed_reason" TEXT,
    "retry_count" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "engagement_id" UUID,
    "client_id" UUID,
    "parent_task_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TO_DO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_id" UUID,
    "reviewer_id" UUID,
    "due_date" DATE,
    "internal_due_date" DATE,
    "statutory_deadline_id" UUID,
    "estimated_hours" DECIMAL(5,2),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_config" JSONB,
    "recurrence_parent_id" UUID,
    "tags" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "overdue_notified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMPTZ,
    "completed_by" UUID,
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" UUID[] DEFAULT ARRAY[]::UUID[],
    "parent_comment_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "TaskAction" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID,
    "engagement_type_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "assignee_role" "UserRole",
    "reviewer_role" "UserRole",
    "due_offset_days" SMALLINT,
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "depends_on_order" SMALLINT[] DEFAULT ARRAY[]::SMALLINT[],
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firm_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(500),
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_action_log_firm_id_occurred_at_idx" ON "user_action_log"("firm_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "user_action_log_firm_id_entity_type_entity_id_idx" ON "user_action_log"("firm_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "users_firm_id_idx" ON "users"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_email_firm" ON "users"("firm_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_role_history_firm_id_idx" ON "user_role_history"("firm_id");

-- CreateIndex
CREATE INDEX "user_role_history_user_id_idx" ON "user_role_history"("user_id");

-- CreateIndex
CREATE INDEX "clients_firm_id_idx" ON "clients"("firm_id");

-- CreateIndex
CREATE INDEX "client_gst_numbers_client_id_idx" ON "client_gst_numbers"("client_id");

-- CreateIndex
CREATE INDEX "client_gst_numbers_firm_id_idx" ON "client_gst_numbers"("firm_id");

-- CreateIndex
CREATE INDEX "client_custom_field_definitions_firm_id_idx" ON "client_custom_field_definitions"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_custom_field_definitions_firm_id_field_key_key" ON "client_custom_field_definitions"("firm_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_deadlines_code_key" ON "statutory_deadlines"("code");

-- CreateIndex
CREATE INDEX "statutory_deadline_overrides_statutory_deadline_id_idx" ON "statutory_deadline_overrides"("statutory_deadline_id");

-- CreateIndex
CREATE INDEX "client_compliance_assignments_firm_id_idx" ON "client_compliance_assignments"("firm_id");

-- CreateIndex
CREATE INDEX "client_compliance_assignments_client_id_idx" ON "client_compliance_assignments"("client_id");

-- CreateIndex
CREATE INDEX "compliance_calendar_entries_firm_id_idx" ON "compliance_calendar_entries"("firm_id");

-- CreateIndex
CREATE INDEX "compliance_calendar_entries_client_id_idx" ON "compliance_calendar_entries"("client_id");

-- CreateIndex
CREATE INDEX "compliance_calendar_entries_firm_id_due_date_status_idx" ON "compliance_calendar_entries"("firm_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "credential_locker_entries_firm_id_idx" ON "credential_locker_entries"("firm_id");

-- CreateIndex
CREATE INDEX "credential_locker_entries_client_id_idx" ON "credential_locker_entries"("client_id");

-- CreateIndex
CREATE INDEX "credential_access_log_firm_id_idx" ON "credential_access_log"("firm_id");

-- CreateIndex
CREATE INDEX "credential_access_log_credential_id_idx" ON "credential_access_log"("credential_id");

-- CreateIndex
CREATE INDEX "documents_firm_id_idx" ON "documents"("firm_id");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_engagement_id_idx" ON "documents"("engagement_id");

-- CreateIndex
CREATE INDEX "documents_task_id_idx" ON "documents"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_requests_upload_token_key" ON "document_requests"("upload_token");

-- CreateIndex
CREATE INDEX "document_requests_firm_id_idx" ON "document_requests"("firm_id");

-- CreateIndex
CREATE INDEX "document_requests_client_id_idx" ON "document_requests"("client_id");

-- CreateIndex
CREATE INDEX "document_checklist_template_items_template_id_idx" ON "document_checklist_template_items"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_checklist_instances_engagement_id_key" ON "document_checklist_instances"("engagement_id");

-- CreateIndex
CREATE INDEX "document_checklist_instances_firm_id_idx" ON "document_checklist_instances"("firm_id");

-- CreateIndex
CREATE INDEX "document_checklist_instance_items_checklist_instance_id_idx" ON "document_checklist_instance_items"("checklist_instance_id");

-- CreateIndex
CREATE INDEX "dsc_records_firm_id_idx" ON "dsc_records"("firm_id");

-- CreateIndex
CREATE INDEX "engagement_types_firm_id_idx" ON "engagement_types"("firm_id");

-- CreateIndex
CREATE INDEX "engagements_firm_id_idx" ON "engagements"("firm_id");

-- CreateIndex
CREATE INDEX "engagements_client_id_idx" ON "engagements"("client_id");

-- CreateIndex
CREATE INDEX "engagement_custom_field_definitions_firm_id_idx" ON "engagement_custom_field_definitions"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_custom_field_definitions_engagement_type_id_fiel_key" ON "engagement_custom_field_definitions"("engagement_type_id", "field_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_status_created_at_idx" ON "notifications"("recipient_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_firm_id_idx" ON "notifications"("firm_id");

-- CreateIndex
CREATE INDEX "tasks_firm_id_idx" ON "tasks"("firm_id");

-- CreateIndex
CREATE INDEX "tasks_engagement_id_idx" ON "tasks"("engagement_id");

-- CreateIndex
CREATE INDEX "tasks_client_id_idx" ON "tasks"("client_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "task_checklists_task_id_idx" ON "task_checklists"("task_id");

-- CreateIndex
CREATE INDEX "task_checklists_firm_id_idx" ON "task_checklists"("firm_id");

-- CreateIndex
CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies"("task_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_task_id_idx" ON "task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "task_activity_log_task_id_idx" ON "task_activity_log"("task_id");

-- CreateIndex
CREATE INDEX "task_templates_firm_id_idx" ON "task_templates"("firm_id");

-- CreateIndex
CREATE INDEX "task_template_items_template_id_idx" ON "task_template_items"("template_id");

-- CreateIndex
CREATE INDEX "leave_records_firm_id_idx" ON "leave_records"("firm_id");

-- CreateIndex
CREATE INDEX "leave_records_user_id_idx" ON "leave_records"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_history" ADD CONSTRAINT "user_role_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_gst_numbers" ADD CONSTRAINT "client_gst_numbers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_deadline_overrides" ADD CONSTRAINT "statutory_deadline_overrides_statutory_deadline_id_fkey" FOREIGN KEY ("statutory_deadline_id") REFERENCES "statutory_deadlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_compliance_assignments" ADD CONSTRAINT "client_compliance_assignments_statutory_deadline_id_fkey" FOREIGN KEY ("statutory_deadline_id") REFERENCES "statutory_deadlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_calendar_entries" ADD CONSTRAINT "compliance_calendar_entries_statutory_deadline_id_fkey" FOREIGN KEY ("statutory_deadline_id") REFERENCES "statutory_deadlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_access_log" ADD CONSTRAINT "credential_access_log_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credential_locker_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_checklist_template_items" ADD CONSTRAINT "document_checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_checklist_instances" ADD CONSTRAINT "document_checklist_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_checklist_instance_items" ADD CONSTRAINT "document_checklist_instance_items_checklist_instance_id_fkey" FOREIGN KEY ("checklist_instance_id") REFERENCES "document_checklist_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_types" ADD CONSTRAINT "engagement_types_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_engagement_type_id_fkey" FOREIGN KEY ("engagement_type_id") REFERENCES "engagement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_custom_field_definitions" ADD CONSTRAINT "engagement_custom_field_definitions_engagement_type_id_fkey" FOREIGN KEY ("engagement_type_id") REFERENCES "engagement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "task_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity_log" ADD CONSTRAINT "task_activity_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
