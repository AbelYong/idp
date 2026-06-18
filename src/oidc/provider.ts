import { Provider, ClientMetadata, Configuration, JWKS, interactionPolicy, KoaContextWithOIDC, Client } from "oidc-provider";
import { DrizzleAdapter } from "./drizzle_adapter.js"
import { findAccount, jwt, loadExistingGrant } from "./provider_configuration.js"
import { db } from "../drizzle/db.js"
import { decryptSecret } from "../util/crypto.js"
import { Clients } from "../drizzle/schema.js"


const defaultResource = process.env.DEFAULT_RESOURCE || "";
const defaultScopes: string = process.env.DEFAULT_SCOPES || "";
const defaultResourceScope = process.env.DEFAULT_RESOURCE_SCOPE || "";

const scopes: string[] = defaultScopes.split(",").map(item => item.trim());

let providerInstance: Provider;

async function loadDefaultClient(): Promise<void> {
    const clientName = process.env.OIDC_CLIENT_ID?.trim() || "gazella-client";
    const redirectURIs = (
        process.env.OIDC_CLIENT_REDIRECT_URIS
        || [
            "com.gazella.client://callback",
        ].join(",")
    )
        .split(",")
        .map((uri) => uri.trim())
        .filter(Boolean);

    await db.insert(Clients)
        .values({
            clientName,
            clientSecret: null,
            redirectURIs,
            allowedGrants: ["authorization_code"],
            isPrivate: false,
        })
        .onConflictDoUpdate({
            target: Clients.clientName,
            set: {
                clientSecret: null,
                redirectURIs,
                allowedGrants: ["authorization_code"],
                isPrivate: false,
            },
        });
}

export async function initializeOIDCProvider() : Promise<Provider> {
    const jwks: JWKS = JSON.parse(process.env.OIDC_JWKS || '{"keys": []}');

    if (jwks.keys.length === 0) {
        console.warn("Warning: No JWKS were found on the environment");
    }
    
    await loadDefaultClient();
    const dbClients = await db.query.Clients.findMany();

    const mappedClients: ClientMetadata[] = dbClients.map(c => {
        let plainSecret = undefined;
        if (c.clientSecret && c.clientSecret.length > 0) {
            try {
                plainSecret = decryptSecret(c.clientSecret);
            } catch (err) {
                console.error(`Failed to decrypt client secret for: ${c.clientName}, ${err}`);
            }
        }

        return {
            application_type: "native",
            client_id: c.clientName,
            client_secret: plainSecret,
            token_endpoint_auth_method: plainSecret ? "client_secret_basic" : "none",
            redirect_uris: c.redirectURIs as string[],
            response_types: ["code"],
            grant_types: (c.allowedGrants as string[]) || ["authorization_code", "refresh_token"]
        };
    });

    const policy = interactionPolicy.base();
    policy.get("consent")?.checks.remove("native_client_prompt");

    const configuration : Configuration = {
        adapter: DrizzleAdapter,
        clients: mappedClients,
        jwks: jwks,
        scopes: scopes,
        cookies: {
            keys: [process.env.COOKIE_SECRET || 'dev-secret-key'],
            short: { secure: false }, 
            long: { secure: false }
        },
        ttl: {
            Interaction: 60 * 30,
            Grant: 7 * 24 * 60 * 60,
            Session: 7 * 24 * 60 * 60,
            AccessToken: 2 * 60 * 60,
            IdToken: 2 * 60 * 60,
            AuthorizationCode: 10 * 60,
        },
        interactions: {
            policy: policy,
            url(_ctx, interaction) {
                const interactionId = interaction.jti;
                return `/api/auth/interaction/${interactionId}`;
            },
        },
        conformIdTokenClaims: false,
        features: {
            devInteractions: { enabled: false },
            resourceIndicators: {
                enabled: true,
                useGrantedResource(_ctx: any, _model: any) {
                    return true;
                },
                defaultResource(_ctx: any, _client: any) {
                    return defaultResource; 
                },
                getResourceServerInfo(_ctx: any, resource: string, _client: any) {
                    return {
                        scope: defaultResourceScope,
                        accessTokenFormat: "jwt",
                        audience: resource,
                        jwt: {
                            sign: { alg: 'RS256' },
                        },
                    };
                },
            },
        } as any,
        formats: {
            customizers: {
                jwt: jwt
            }
        },
        loadExistingGrant: loadExistingGrant,
        claims: {
            openid: ["sub"],
            email: ["email"],
            account: ["roles", "permissions"]
        },
        findAccount: findAccount,
        clientBasedCORS(_ctx, origin, _client) {
            const allowedOrigins = [
                "http://localhost:4173",
                "http://localhost:5173",
                "http://localhost:4000",
            ];

            return allowedOrigins.includes(origin);
        },
    }

    const oidcBaseUrl = process.env.ISSUER_URL || "http://localhost:4000/oidc";
    providerInstance = new Provider(oidcBaseUrl, configuration);
    
    providerInstance.proxy = true;

    return providerInstance;
}

export function getProvider(): Provider {
    if (!providerInstance) {
        throw new Error("The OIDC provider hasn't been yet initialized");
    }
    return providerInstance;
}
