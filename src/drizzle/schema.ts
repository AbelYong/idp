import * as pg from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const Users = pgTable(
    "users", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        email: pg.varchar("email", { length: 128} ).notNull(),
        password_hash: pg.varchar("password_hash").notNull(),
        isVerified: pg.boolean("is_verified").notNull().default(false),
        isActive: pg.boolean("is_active").notNull().default(false),
        updatedAt: pg.timestamp("updated_at").notNull().defaultNow()
    }, (table) => [
        pg.uniqueIndex("email_unqIdx").on(table.email)
    ]
);

export const VerificationCodes = pgTable(
    "verification_codes", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        code: pg.varchar("code", { length: 6 } ).notNull(),
        remainingAttempts: pg.integer("remaining_attempts").notNull(),
        expiresAt: pg.timestamp("expires_at").notNull(),
        userId: pg.uuid("user_id").references(() => Users.id).notNull()        
    }
);

export const PendingRegistrations = pgTable(
    "pending_registrations", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        email: pg.varchar("email", { length: 128 }).notNull().unique(),
        password_hash: pg.varchar("password_hash").notNull(),
        name: pg.varchar("name", { length: 128 }).notNull(),
        parentalSurname: pg.varchar("paternal_surname", { length: 128 }),
        maternalSurname: pg.varchar("maternal_surname", { length: 128 }),
        role: pg.varchar("role", { length: 64 }).notNull(),
        code: pg.varchar("code", { length: 6 }).notNull(),
        remainingAttempts: pg.integer("remaining_attempts").notNull(),
        expiresAt: pg.timestamp("expires_at").notNull(),
        createdAt: pg.timestamp("created_at").notNull().defaultNow()
    }, (table) => [
        pg.uniqueIndex("pending_email_unqIdx").on(table.email)
    ]
);

export const RecoveryCodes = pgTable(
    "recovery_codes", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        code: pg.varchar("code", { length: 6 } ),
        remainingAttempts: pg.integer("remaining_attempts").notNull(),
        expiresAt: pg.timestamp("expires_at").notNull(),
        userId: pg.uuid("user_id").references(() => Users.id).notNull()
    }
);

export const Roles = pgTable(
    "roles", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        name: pg.varchar("name", {length: 64} ).notNull().unique(),
        description: pg.varchar("description", { length: 512} )
    }
);

export const UserRoles = pgTable(
    "user_roles", {
        userId: pg.uuid("user_id").references(() => Users.id).notNull(),
        roleId: pg.uuid("role_id").references(() => Roles.id).notNull()
    }, (table) => [
        pg.primaryKey({ columns: [table.userId, table.roleId] })
    ]
);

export const Claims = pgTable(
    "claims", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        type: pg.varchar("type").notNull(),
        value: pg.varchar("value").notNull()
    }, (table) => [
        pg.uniqueIndex("type_value_unqIdx").on(table.type, table.value)
    ]
);

export const RoleClaims = pgTable(
    "role_claims", {
        roleId: pg.uuid("role_id").references(() => Roles.id).notNull(),
        claimId: pg.uuid("claim_id").references(() => Claims.id).notNull()
    }, (table) => [
        pg.primaryKey({ columns: [table.roleId, table.claimId] })
    ]
);

export const Clients = pgTable(
    "clients", {
        id: pg.uuid("id").primaryKey().defaultRandom(),
        clientName: pg.varchar("client_name", { length: 255} ).notNull().unique(),
        clientSecret: pg.varchar("client_secret"),
        redirectURIs: pg.jsonb("redirect_uris"),
        allowedGrants: pg.jsonb("allowed_grants"),
        isPrivate: pg.boolean("is_private").notNull().default(false)
    }
);

export const OidcModels = pgTable(
    "oidc_models", {
        id: pg.varchar("id", { length: 255 }).primaryKey(),
        type: pg.varchar("type", { length: 128 }).notNull(),
        payload: pg.jsonb("payload").notNull(),
        grantId: pg.varchar("grant_id", { length: 255 }),
        userCode: pg.varchar("user_code", { length: 255 }),
        uid: pg.varchar("uid", { length: 255 }),
        expiresAt: pg.timestamp("expires_at"),
        consumedAt: pg.timestamp("consumed_at")
    }
);