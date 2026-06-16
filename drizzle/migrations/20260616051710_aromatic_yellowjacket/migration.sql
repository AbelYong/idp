CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" varchar NOT NULL,
	"value" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_name" varchar(255) NOT NULL UNIQUE,
	"client_secret" varchar,
	"redirect_uris" jsonb,
	"allowed_grants" jsonb,
	"is_private" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_models" (
	"id" varchar(255) PRIMARY KEY,
	"type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"grant_id" varchar(255),
	"user_code" varchar(255),
	"uid" varchar(255),
	"expires_at" timestamp,
	"consumed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(128) NOT NULL UNIQUE,
	"password_hash" varchar NOT NULL,
	"name" varchar(128) NOT NULL,
	"paternal_surname" varchar(128),
	"maternal_surname" varchar(128),
	"role" varchar(64) NOT NULL,
	"code" varchar(6) NOT NULL,
	"remaining_attempts" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(6),
	"remaining_attempts" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_claims" (
	"role_id" uuid,
	"claim_id" uuid,
	CONSTRAINT "role_claims_pkey" PRIMARY KEY("role_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(64) NOT NULL UNIQUE,
	"description" varchar(512)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid,
	"role_id" uuid,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(128) NOT NULL,
	"password_hash" varchar NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(6) NOT NULL,
	"remaining_attempts" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "type_value_unqIdx" ON "claims" ("type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_email_unqIdx" ON "pending_registrations" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_unqIdx" ON "users" ("email");--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "role_claims" ADD CONSTRAINT "role_claims_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "role_claims" ADD CONSTRAINT "role_claims_claim_id_claims_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id");--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");