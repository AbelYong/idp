import Provider, { ClientMetadata, Configuration, JWKS } from "oidc-provider"
import { DrizzleAdapter } from "./drizzle_adapter.js"
import { findAccount, loadExistingGrant } from "./provider_configuration.js"
import { db } from "../drizzle/db.js"
import { decryptSecret } from "../util/crypto.js"

const defaultResource = process.env.DEFAULT_RESOURCE || "";
const defaultScopes: string = process.env.DEFAULT_SCOPES || "";

const scopes: string = defaultScopes.split(",").map(val => val.trim()).filter(Boolean).join(" ");

let providerInstance: Provider;

export async function initializeOIDCProvider() : Promise<Provider> {
    const jwks: JWKS = JSON.parse(process.env.OIDC_JWKS || '{"keys": []}');

    if (jwks.keys.length === 0) {
        console.warn("Warning: No JWKS were found on the environment");
    }
    
    const dbClients = await db.query.Clients.findMany();

    const mappedClients: ClientMetadata[] = dbClients.map(c => {
        let plainSecret = undefined;
        if (c.clientSecret) {
            try {
                plainSecret = decryptSecret(c.clientSecret);
            } catch (err) {
                console.error(`Failed to decrypt client secret for: ${c.clientName}, ${err}`);
            }
        }

        return {
            client_id: c.clientName,
            client_secret: plainSecret,
            token_endpoint_auth_method: plainSecret ? "client_secret_basic" : "none",
            redirect_uris: c.redirectURIs as string[],
            response_types: ["code"],
            grant_types: (c.allowedGrants as string[]) || ["authorization_code", "refresh_token"]
        };
    });

    const configuration : Configuration = {
        adapter: DrizzleAdapter,
        clients: mappedClients,
        jwks: jwks,
        ttl: {
            Interaction: 60 * 30,
            Grant: 7 * 24 * 60 * 60,
            Session: 7 * 24 * 60 * 60,
            AccessToken: 2 * 60 * 60,
            IdToken: 2 * 60 * 60,
            AuthorizationCode: 10 * 60,
        },
        interactions: {
            url(ctx, interaction) {
                const interactionId = interaction.jti;
                return `/api/auth/interaction/${interactionId}`;
            },
        },
        conformIdTokenClaims: false,
        features: {
            devInteractions: { enabled: false },
            resourceIndicators: {
                enabled: true,
                defaultResource(ctx, client) {
                    return defaultResource; 
                },
                getResourceServerInfo(ctx, resource, client) {
                    return {
                        scope: scopes,
                        audience: resource,
                        jwt: {
                            sign: { alg: 'RS256' },
                        },
                    };
                },
            },
        },
        formats: {
            customizers: {
                async jwt(ctx, token, parts) {
                    if ("accountId" in token && token.accountId) {
                        
                        const account = await findAccount(ctx, token.accountId, token);
                        if (account != undefined) {
                            const claims = await account.claims("access_token", token.scope || '', {}, []);

                            parts.payload.email = claims.email;
                            parts.payload.roles = claims.roles;
                            parts.payload.permissions = claims.permissions;
                        }
                    }
                    
                    return parts;
                }
            }
        },
        loadExistingGrant: loadExistingGrant,
        claims: {
            openid: ["sub"],
            email: ["email"],
            account: ["roles", "permissions"]
        },
        findAccount: findAccount
    }

    const oidcBaseUrl = process.env.ISSUER_URL || "http://localhost:3000/oidc";
    providerInstance = new Provider(oidcBaseUrl, configuration);
    return providerInstance;
}

export function getProvider(): Provider {
    if (!providerInstance) {
        throw new Error("The OIDC provider hasn't been yet initialized");
    }
    return providerInstance;
}
