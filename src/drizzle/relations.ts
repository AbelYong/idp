import * as schema from "./schema.js"
import { defineRelations } from "drizzle-orm"

export const relations = defineRelations(schema, (r) => ({
    Users: {
        userRoles: r.many.UserRoles()
    },
    Roles: {
        userRoles: r.many.UserRoles(),
        roleClaims: r.many.RoleClaims()
    },
    UserRoles: {
        user: r.one.Users({
            from: r.UserRoles.userId,
            to: r.Users.id
        }),
        role: r.one.Roles({
            from: r.UserRoles.roleId,
            to: r.Roles.id
        })
    },
    Claims: {
        roleClaims: r.many.RoleClaims()
    },
    RoleClaims: {
        role: r.one.Roles({
            from: r.RoleClaims.roleId,
            to: r.Roles.id
        }),
        claim: r.one.Claims({
            from: r.RoleClaims.claimId,
            to: r.Claims.id
        })
    },
    VerificationCodes: {
        user: r.one.Users({
            from: r.VerificationCodes.userId,
            to: r.Users.id
        }),
    },
    RecoveryCodes: {
        user: r.one.Users({
            from: r.RecoveryCodes.userId,
            to: r.Users.id
        }),
    }
}));
