import { FindAccount, Configuration } from "oidc-provider"
import { db } from "../drizzle/db.js"

const defaultResource: string = process.env.DEFAULT_RESOURCE || "";
const defaultScopes: string = process.env.DEFAULT_SCOPES || "";

const scopes: string[] = defaultScopes.split(",").map(val => val.trim()).filter(Boolean);

export const loadExistingGrant: Configuration["loadExistingGrant"] = async (ctx) => {
    const grantId = (ctx.oidc.result?.consent?.grantId) || ctx.oidc.entities.Interaction?.grantId;

    if (grantId) {
        return ctx.oidc.provider.Grant.find(grantId);
    }

    if (ctx.oidc.client != null && ctx.oidc.session != null) {

        const client = await db.query.Clients.findFirst({
            where: { clientName: ctx.oidc.client.clientId }
        });

        if (client?.isPrivate) { 
            const grant = new ctx.oidc.provider.Grant({
                clientId: ctx.oidc.client.clientId,
                accountId: ctx.oidc.session.accountId,
            });

            for (const scope of scopes) {
                grant.addOIDCScope(scope);
            }

            const spacedScopes = scopes.join(" ");
            grant.addResourceScope(defaultResource, spacedScopes);

            await grant.save();
            return grant;
        }
    }

    return undefined; 
};

export const findAccount: FindAccount = async (ctx, id) => {
    return {
        accountId: id,
        async claims(use, scope, claims, rejected) {
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