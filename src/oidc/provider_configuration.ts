import { FindAccount, Configuration, JWTStructured, KoaContextWithOIDC, AccessToken, ClientCredentials } from "oidc-provider"
import { db } from "../drizzle/db.js"

const defaultResource: string = process.env.DEFAULT_RESOURCE || "";
const defaultOidcScopes: string = process.env.OIDC_SCOPES || ""

export const loadExistingGrant: Configuration["loadExistingGrant"] = async (ctx) => {
    const grantId = (ctx.oidc.result?.consent?.grantId) || ctx.oidc.entities.Interaction?.grantId;
    if (grantId) {
        return ctx.oidc.provider.Grant.find(grantId);
    }

    return undefined; 
};

export const findAccount: FindAccount = async (_ctx : KoaContextWithOIDC, id: string) => {
    return {
        accountId: id,
        async claims(_use, _scope, _claims, _rejected) {
            const user = await db.query.Users.findFirst({
                where: {
                    id: id
                },
                with: {
                    userRoles: {
                        with: {
                            role: {
                                with: {
                                    roleClaims: {
                                        with: {
                                            claim: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!user) {
                return { sub: id };
            }

            const roles: string[] = [];
            const permissions: string[] = [];

            for (const ur of user.userRoles) {
                if (ur.role != null) {
                    roles.push(ur.role.name);
                    for (const rc of ur.role.roleClaims) {
                        if (rc.claim != null && typeof rc.claim.type === "string" && typeof rc.claim.value === "string") {
                            permissions.push(`${rc.claim.type}:${rc.claim.value}`);
                        }
                    }
                }
            }

            return {
                sub: id,
                email: user.email,
                roles: roles,
                permissions: permissions
            }
        }
    }
};

export const jwt = async (ctx: KoaContextWithOIDC, token: AccessToken | ClientCredentials, parts: JWTStructured) => {
    if (token.kind === 'AccessToken') {
        if (!token.accountId) {
            return parts;
        }
        const account = await findAccount(ctx, token.accountId, token);
        if (!account) {
            return parts;
        }
        const claims = await account.claims("access_token", token.scope || '', {}, []);
        if (claims.email) {
            parts.payload.email = claims.email;
        }
        if (claims.roles) {
            parts.payload.roles = claims.roles;
        }
        if (claims.permissions) {
            parts.payload.permissions = claims.permissions;
        }
    }
    return parts;
}
