import argon2 from "argon2"
import { db } from "./db.js";
import { RecoveryCodes, Roles, UserRoles, Users, VerificationCodes } from "./schema.js";
import { eq, isNotNull } from "drizzle-orm";

export async function seed() {
    console.log("[SEED] Sedding users...");

    const testUserId = "5c593443-f3c5-4b42-8d6f-2543dc6e9cb4";
    const existingUser = await db.query.Users.findFirst({
        where: { id: testUserId }
    })

    const password = "Password_1";
    const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 3,
            parallelism: 1
        });

    if (!existingUser) {
        await db.transaction(async (tx) => {
            await tx.insert(Users).values({
                id: testUserId,
                email: "moderator@test.com",
                password_hash: hashedPassword,
                isVerified: true,
                isActive: true
            });

            const moderatorRoleId = "759bc119-2006-477f-969b-3ac1c995ea33";
            const moderatorRole = await db.query.Roles.findFirst({
                where: { id: moderatorRoleId }
            })

            if (!moderatorRole) {
                await tx.insert(Roles).values({
                    id: moderatorRoleId,
                    name: "moderator",
                    description: "Can remove comments, suspend users and register editors or organizers"
                });
            }

            await tx.insert(UserRoles).values({
                roleId: moderatorRoleId,
                userId: testUserId
            });
        });
    }

    const nonRegistratedUserEmail = "nonRegistrated@test.com";
    const nonRegistratedUser = await db.query.Users.findFirst({
        where: { email: nonRegistratedUserEmail }
    });

    if (nonRegistratedUser) {
        await db.delete(Users).where(
            eq(Users.email, nonRegistratedUserEmail)
        );
    }

    await db.delete(VerificationCodes).where(
        isNotNull(VerificationCodes.userId)
    );
    await db.delete(RecoveryCodes).where(
        isNotNull(RecoveryCodes.userId)
    );

    const unverifiedUserId = "b8b46004-9a34-4974-8692-b102ac5c0fdd";
    const unverifiedUser = await db.query.Users.findFirst({
        where: { id: unverifiedUserId }
    });

    if (unverifiedUser) {
        await db.delete(Users).where(
            eq(Users.id, unverifiedUserId)
        )
    }

    await db.insert(Users).values({
        id: unverifiedUserId,
        email: "unverified@test.com",
        password_hash: hashedPassword,
        isVerified: false,
        isActive: false
    });

    const forgottenPasswordUserId = "dba08067-b32d-4ace-a3f1-8bc8322b5d4a";
    const forgottenPasswordUser = await db.query.Users.findFirst({
        where: { id: forgottenPasswordUserId }
    });

    if (forgottenPasswordUser) {
        await db.delete(Users).where(
            eq(Users.id, forgottenPasswordUserId)
        )
    }

    await db.insert(Users).values({
        id: forgottenPasswordUserId,
        email: "forgottenPass@test.com",
        password_hash: hashedPassword,
        isVerified: true,
        isActive: true
    });

    console.log("[SEED] sedding verification codes...");

    let oneMonthPlus = new Date();
    oneMonthPlus.setMonth(oneMonthPlus.getMonth() +1 );

    await db.insert(VerificationCodes).values({
        code: "123456",
        remainingAttempts: 3,
        expiresAt: oneMonthPlus,
        userId: unverifiedUserId
    })

    console.log("[SEED seeding recovery codes...");

    await db.insert(RecoveryCodes).values({
        code: "123456",
        remainingAttempts: 3,
        expiresAt: oneMonthPlus,
        userId: forgottenPasswordUserId
    });
}
