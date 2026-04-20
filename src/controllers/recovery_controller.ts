import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { RecoveryCodes, Users } from "../drizzle/schema.js"
import { EmailVerificationRequestInput, UserRecoveryInput } from "../schema/auth_schema.js"
import { IEmailManager, EmailManager } from "../util/mail.js"
import { AppError, RequestError } from "../util/errors.js"
import { eq } from "drizzle-orm"

const emailProvider: IEmailManager = new EmailManager(false);

export const requestUserRecovery = async (req: Request<{}, {}, EmailVerificationRequestInput>, res: Response) : Promise<void> =>{
    const { email } = req.body;

    const success = await emailProvider.sendRecoveryCode(email);

    if (success) {
        res.status(201).json({message: "Your account recovery email has been sent"});
    } else {
        res.status(503).json({message: "We received your request but failed to send you an email, try again later"})
    }
}

export const completeUserRecovery = async (req: Request<{}, {}, UserRecoveryInput>, res: Response) : Promise<void> => {
    const { email, password, code } = req.body;

    const user = await db.query.Users.findFirst({
        where: { email: email }
    });

    if (!user) {
        // Mitigate enumeration
        throw new AppError(404, "No account recovery code was found for the requested address, please double check the spelling and try again.");
    }

    const recoveryCode = await db.query.RecoveryCodes.findFirst({
        where: { userId: user.id}
    });

    if (!recoveryCode) {
        throw new AppError(404, "No account recovery code was found for the requested address, please double check the spelling and try again.");
    }

    const now = new Date(Date.now());
    if (now > recoveryCode.expiresAt) {
        throw new RequestError(
            401,
            "The account recovery code has expired, please request a new one",
            "CODE_EXPIRED"
        );
    }

    if (recoveryCode.remainingAttempts <= 0) {
        throw new RequestError(
            401,
            "You have ran out of attempts to recover your account, please request a new code",
            "OUT_OF_ATTEMPTS"
        );
    }

    if (recoveryCode.code === code) {
        const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 3,
            parallelism: 1
        });

        await db.transaction(async () => {
            await db.update(RecoveryCodes)
                .set({ remainingAttempts: 0})
                .where(eq(RecoveryCodes.userId, user.id));

            await db.update(Users)
                .set({ password_hash: hashedPassword })
                .where(eq(Users.id, user.id));
        });
        
        res.status(200).json({message: "Your password has been updated"});
    } else {
        await db.update(RecoveryCodes)
            .set({ remainingAttempts: recoveryCode.remainingAttempts--})
            .where(eq(RecoveryCodes.userId, user.id));
        
        throw new RequestError(
            401,
            "The verification code is incorrect",
            "CODE_MISMATCH"
        );
    }
}

