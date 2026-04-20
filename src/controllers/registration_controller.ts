import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { Users, VerificationCodes } from "../drizzle/schema.js"
import { EmailVerificationInput, EmailVerificationRequestInput, RegisterUserInput } from "../schema/auth_schema.js"
import { IEmailManager, EmailManager } from "../util/mail.js"
import { AppError, RequestError } from "../util/errors.js"
import { eq } from "drizzle-orm"

const emailProvider: IEmailManager = new EmailManager(false);

export const registerUser = async (req: Request<{}, {}, RegisterUserInput>, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (await verifyIsEmailInUse(email)) {
        throw new AppError(409, "This email is already in use");
    }

    const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
    });

    const [newUser] = await db.insert(Users).values({
        email: email,
        password_hash: hashedPassword,
        isActive: true,
        isVerified: false,
    }).returning({
        id: Users.id,
        email: Users.email
    });

    res.status(201).json({message: "User registration successful", user: newUser});
}

async function verifyIsEmailInUse(email: string) : Promise<boolean> {
    const existingUser = await db.query.Users.findFirst({
        where: { email: email }
    });

    return existingUser != null
}

export const requestEmailVerification = async (req: Request<{}, {}, EmailVerificationRequestInput>, res: Response) : Promise<void> => {
    const { email } = req.body;

    const success =  await emailProvider.sendVerificationCode(email);

    if (success) {
        res.status(201).json({message: "Your verification email has been sent"});
    } else {
        res.status(503).json({message: "We received your request but failed to send you an email, try again later"})
    }
}

export const verifyEmail = async (req: Request<{}, {}, EmailVerificationInput>, res: Response) : Promise<void> => {
    const { email, code } = req.body;

    const user = await db.query.Users.findFirst({
        where: { email: email }
    });

    if (!user) {
        // Mitigate enumeration
        throw new AppError(404, "No verification code was found for the requested address, please double check the spelling and try again.");
    }

    const verificationCode = await db.query.VerificationCodes.findFirst({
        where: { userId: user.id}
    });

    if (!verificationCode) {
        throw new AppError(404, "No verification code was found for the requested address, please double check the spelling and try again.");
    }

    const now = new Date(Date.now());
    if (now > verificationCode.expiresAt) {
        throw new RequestError(
            401,
            "The verification code has expired, please request a new one",
            "CODE_EXPIRED"
        );
    }

    if (verificationCode.remainingAttempts <= 0) {
        throw new RequestError(
            401,
            "You have ran out of attempts to verify your email, please request a new code",
            "OUT_OF_ATTEMPTS"
        );
    }

    if (verificationCode.code === code) {
        await db.transaction(async () => {
            await db.update(VerificationCodes)
            .set({ remainingAttempts: 0})
            .where(eq(VerificationCodes.userId, user.id));
        
            await db.update(Users)
                .set({ isVerified: true })
                .where(eq(Users.id, user.id));
        });
        
        res.status(200).json({message: "Your email has been successfully verified"});
    } else {
        await db.update(VerificationCodes)
            .set({ remainingAttempts: verificationCode.remainingAttempts--})
            .where(eq(VerificationCodes.userId, user.id));
        
        throw new RequestError(
            401,
            "The verification code is incorrect",
            "CODE_MISMATCH"
        );
    }
}

