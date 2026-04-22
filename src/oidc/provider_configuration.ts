import { FindAccount, Configuration } from "oidc-provider"
import { db } from "../drizzle/db.js"

const defaultResource: string = process.env.DEFAULT_RESOURCE || "";

export const loadExistingGrant: Configuration["loadExistingGrant"] = async (ctx) => {
    const grantId = (ctx.oidc.result?.consent?.grantId) || ctx.oidc.entities.Interaction?.grantId;
    if (grantId) {
        return ctx.oidc.provider.Grant.find(grantId);
    }

    const accountId = ctx.oidc.session?.accountId;
    const clientId = ctx.oidc.client?.clientId;

    if (!clientId || !accountId) {
        return undefined;
    }

    const client = await db.query.Clients.findFirst({
        where: { clientName: clientId }
    });

    if (client?.isPrivate) { 
        const grant = new ctx.oidc.provider.Grant({
            clientId: clientId,
            accountId: accountId,
        });

        const params = ctx.oidc.params || ctx.oidc.entities.Interaction?.params || {};
            
        const requestedScopes = (params.scope as string) || "openid";
        const scopesArray = requestedScopes.split(' ');
            
        for (const scope of scopesArray) {
            grant.addOIDCScope(scope);
        }

        const requestedResource = params.resource;
            
        if (requestedResource) {
            const resources = Array.isArray(requestedResource) 
                ? requestedResource 
                : [requestedResource as string];
                    
            for (const res of resources) {
                grant.addResourceScope(res, requestedScopes);
            }
        } else if (defaultResource) {
            grant.addResourceScope(defaultResource, requestedScopes);
        }

        await grant.save();
        return grant;
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