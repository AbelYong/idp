import { Adapter, AdapterPayload } from "oidc-provider"
import { db } from "../drizzle/db.js"
import { OidcModels } from "../drizzle/schema.js"
import { and, eq } from "drizzle-orm";

export class DrizzleAdapter implements Adapter {
    private readonly type: string;

    constructor(name: string) {
        this.type = name;
    }

    async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<undefined | void> {
        let expiresAt: Date | undefined;

        if (expiresIn) {
            expiresAt = new Date(Date.now() + expiresIn * 1000);
        }

        await db.insert(OidcModels).values({
            id: id,
            type: this.type,
            payload: payload,
            grantId: payload.grantId,
            userCode: payload.userCode,
            uid: payload.uid,
            expiresAt: expiresAt,
        }).onConflictDoUpdate({
            target: OidcModels.id,
            set: {
                payload: payload,
                grantId: payload.grantId,
                userCode: payload.userCode,
                uid: payload.uid,
                expiresAt: expiresAt
            }
        });
    }

    async find(id: string): Promise<AdapterPayload | undefined> {
        const result = await db.query.OidcModels.findFirst({
            where: {
                id: id,
                type: this.type
            }
        });

        if (!result) {
            return undefined;
        }
        return result.payload as AdapterPayload;
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
        const result = await db.query.OidcModels.findFirst({
            where: {
                userCode: userCode
            }
        });

        if (!result) {
            return undefined;
        }
        return result.payload as AdapterPayload; 
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
        const result = await db.query.OidcModels.findFirst({
            where: {
                uid: uid
            }
        });

        if (!result) {
            return undefined;
        }
        return result.payload as AdapterPayload;
    }

    async consume(id: string): Promise<undefined | void> {
        const result = await db.query.OidcModels.findFirst({
            where: {
                id: id,
                type: this.type
            }
        });

        if (result) {
            const payload = result.payload as AdapterPayload;
            payload.consumed = Math.floor(Date.now() / 1000);

            await db.update(OidcModels)
                .set({
                    payload: payload,
                    consumedAt: new Date()
                })
                .where(eq(OidcModels.id, id));
        }
    }

    async destroy(id: string): Promise<undefined | void> {
        await db.delete(OidcModels).where(
            and(
                eq(OidcModels.id, id),
                eq(OidcModels.type, this.type)
            )
        );
    }

    async revokeByGrantId(grantId: string): Promise<undefined | void> {
        await db.delete(OidcModels).where(eq(OidcModels.grantId, grantId));
    }
}