import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { Roles, UserRoles, Users, VerificationCodes } from "../drizzle/schema.js"
import { EmailVerificationInput, EmailVerificationRequestInput, RegisterUserInput } from "../schema/auth_schema.js"
import { IEmailManager, EmailManager } from "../util/mail.js"
import { AppError, RequestError } from "../util/errors.js"
import { eq } from "drizzle-orm"
import { publishUserRegisteredEvent } from "../messaging/publisher.js"
import { UserRegisteredMsg } from "../messaging/messages.js"

const emailProvider: IEmailManager = new EmailManager(false);

const defaultRoleName = process.env["DEFAULT_ROLE"]?.trim() || "volunteer";
let defaultRoleId: string | null = null;

export async function loadDefaultRole(): Promise<void> {
    let defaultDbRole = await db.query.Roles.findFirst({
        where: { name: defaultRoleName }
    });

    if (!defaultDbRole) {
        await db.insert(Roles)
            .values({
                name: defaultRoleName,
                description: "Default role assigned during user registration",
            })
            .onConflictDoNothing({ target: Roles.name });

        defaultDbRole = await db.query.Roles.findFirst({
            where: { name: defaultRoleName }
        });
    }

    if (!defaultDbRole) {
        throw new Error(`Could not load or create the default role "${defaultRoleName}"`);
    }

    defaultRoleId = defaultDbRole.id;
    console.log(`Default registration role loaded: ${defaultRoleName}`);
}

export const registerUser = async (req: Request<{}, {}, RegisterUserInput>, res: Response): Promise<void> => {
    const { email, password, name, parentalSurname, maternalSurname } = req.body;
    const roleId = defaultRoleId;

    if (!roleId) {
        throw new Error("The default registration role has not been initialized");
    }

    if (await verifyIsEmailInUse(email)) {
        throw new AppError(409, "This email is already in use");
    }

    const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
    });
    
    const newUser = await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(Users).values({
            email: email,
            password_hash: hashedPassword,
            isActive: true,
            isVerified: false,
        }).returning({
            id: Users.id,
            email: Users.email,
            registratedAt: Users.updatedAt
        });

        await tx.insert(UserRoles).values({
            userId: newUser.id,
            roleId
        });
        return newUser;
    });

    const wasEmailSent =  await emailProvider.sendVerificationCode(email);
    if (wasEmailSent) {
        res.status(201).json({message: "User registration successful, a verification code has been sent to your inbox", user: newUser});
        
        const message = new UserRegisteredMsg(
            email,
            name,
            parentalSurname,
            maternalSurname,
            defaultRoleName,
            newUser.registratedAt,
            newUser.id
        );
        publishUserRegisteredEvent(message);
    } else {
        res.status(503).json({message: "We managed to registrate you but failed to send you an email, please request one later", code: "EMAIL_NOT_SENT"});
    }
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
        res.status(503).json({message: "We received your request but failed to send you an email, try again later"});
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

