import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { Roles, UserRoles, Users, VerificationCodes, PendingRegistrations } from "../drizzle/schema.js"
import { EmailVerificationInput, EmailVerificationRequestInput, RegisterUserInput } from "../schema/auth_schema.js"
import { IEmailManager, EmailManager } from "../util/mail.js"
import { AppError, RequestError } from "../util/errors.js"
import { eq } from "drizzle-orm"
import { publishUserRegisteredEvent } from "../messaging/publisher.js"
import { UserRegisteredMsg } from "../messaging/messages.js"

const emailProvider: IEmailManager = new EmailManager(false);

const defaultRoleName = process.env["DEFAULT_ROLE"]?.trim() || "volunteer";
const allowDevRoleRegistration = process.env["ALLOW_DEV_ROLE_REGISTRATION"] === "true";
let defaultRoleId: string | null = null;

async function loadOrCreateRole(roleName: string): Promise<string> {
    let defaultDbRole = await db.query.Roles.findFirst({
        where: { name: roleName }
    });

    if (!defaultDbRole) {
        await db.insert(Roles)
            .values({
                name: roleName,
                description: roleName === defaultRoleName
                    ? "Default role assigned during user registration"
                    : "Role available for development and moderation flows",
            })
            .onConflictDoNothing({ target: Roles.name });

        defaultDbRole = await db.query.Roles.findFirst({
            where: { name: roleName }
        });
    }

    if (!defaultDbRole) {
        throw new Error(`Could not load or create role "${roleName}"`);
    }

    return defaultDbRole.id;
}

export async function loadDefaultRole(): Promise<void> {
    defaultRoleId = await loadOrCreateRole(defaultRoleName);
    if (allowDevRoleRegistration) {
        await loadOrCreateRole("editor");
    }
    console.log(`Default registration role loaded: ${defaultRoleName}`);
}

export const registerUser = async (req: Request<{}, {}, RegisterUserInput>, res: Response): Promise<void> => {
    const { email, password, name, parentalSurname, maternalSurname } = req.body;
    const selectedRoleName = allowDevRoleRegistration && req.body.role ? req.body.role : defaultRoleName;

    // Check if email is already in use by an actual account
    const existingUser = await db.query.Users.findFirst({
        where: { email: email }
    });

    if (existingUser) {
        throw new AppError(409, "This email is already in use");
    }

    const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
    });

    // Import generateSecureOTP
    const { generateSecureOTP } = await import("../util/crypto.js");
    const code = generateSecureOTP();
    const expirationTime = new Date(Date.now());
    expirationTime.setMinutes(expirationTime.getMinutes() + 15);

    // Check if there's an existing pending registration
    const existingPending = await db.query.PendingRegistrations.findFirst({
        where: { email: email }
    });

    // Save to PendingRegistrations (update if exists, insert if new)
    try {
        if (existingPending) {
            // Update existing pending registration with new data and new code
            await db.update(PendingRegistrations)
                .set({
                    password_hash: hashedPassword,
                    name,
                    parentalSurname: parentalSurname || null,
                    maternalSurname: maternalSurname || null,
                    role: selectedRoleName,
                    code,
                    remainingAttempts: 3,
                    expiresAt: expirationTime
                })
                .where(eq(PendingRegistrations.email, email));
        } else {
            // Insert new pending registration
            await db.insert(PendingRegistrations).values({
                email,
                password_hash: hashedPassword,
                name,
                parentalSurname: parentalSurname || null,
                maternalSurname: maternalSurname || null,
                role: selectedRoleName,
                code,
                remainingAttempts: 3,
                expiresAt: expirationTime
            });
        }
    } catch (error) {
        throw new AppError(409, "An error occurred during registration, please try again later");
    }

    // Send verification email directly (without using emailProvider which looks for Users)
    try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env["IDP_EMAIL_ADDRESS"],
                pass: process.env["IDP_EMAIL_PASS"],
            }
        });

        const mailOptions = {
            from: '"Gazella" <gazella.noreply@gmail.com>',
            to: email,
            subject: 'Your security verification code',
            text: `Your verification code is: ${code}. It will expire in 15 minutes`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Verify your account</h2>
                <p>Your six-digit verification code is:</p>
                <h1 style="color: #399fc1; letter-spacing: 5px;">${code}</h1>
                <p><em>This code will expire in 15 minutes. If you did not request it, ignore this email</em></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Verification code successfully sent to: ${email}: ${info.messageId}`);
        res.status(201).json({ message: "Please check your email and verify your code to complete registration" });
    } catch (error) {
        // Clean up pending registration if email fails
        await db.delete(PendingRegistrations).where(eq(PendingRegistrations.email, email));
        console.error("Failed to send verification email:", error);
        res.status(503).json({ message: "We failed to send you a verification email, try again later", code: "EMAIL_NOT_SENT" });
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

    // Check if it's a pending registration
    const pendingRegistration = await db.query.PendingRegistrations.findFirst({
        where: { email: email }
    });

    if (pendingRegistration) {
        // Generate new code for pending registration
        const { generateSecureOTP } = await import("../util/crypto.js");
        const code = generateSecureOTP();
        const expirationTime = new Date(Date.now());
        expirationTime.setMinutes(expirationTime.getMinutes() + 15);

        try {
            await db.update(PendingRegistrations)
                .set({ code, expiresAt: expirationTime, remainingAttempts: 3 })
                .where(eq(PendingRegistrations.email, email));
        } catch (error) {
            console.error("Failed to update pending registration code", error);
            res.status(503).json({message: "We received your request but failed to send you an email, try again later"});
            return;
        }

        // Send the email
        try {
            const mailOptions = {
                from: '"Gazella" <gazella.noreply@gmail.com>',
                to: email,
                subject: 'Your security verification code',
                text: `Your verification code is: ${code}. It will expire in 15 minutes`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Verify your account</h2>
                    <p>Your six-digit verification code is:</p>
                    <h1 style="color: #399fc1; letter-spacing: 5px;">${code}</h1>
                    <p><em>This code will expire in 15 minutes. If you did not request it, ignore this email</em></p>
                    </div>
                `
            };

            const transporter = (await import("nodemailer")).default.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: process.env["IDP_EMAIL_ADDRESS"],
                    pass: process.env["IDP_EMAIL_PASS"],
                }
            });

            await transporter.sendMail(mailOptions);
            res.status(201).json({message: "Your verification email has been sent"});
        } catch (error) {
            // Revert the code
            await db.update(PendingRegistrations)
                .set({ code: pendingRegistration.code, expiresAt: pendingRegistration.expiresAt, remainingAttempts: pendingRegistration.remainingAttempts })
                .where(eq(PendingRegistrations.email, email));
            
            console.error("Failed to send verification email", error);
            res.status(503).json({message: "We received your request but failed to send you an email, try again later"});
        }
        return;
    }

    // Otherwise, try to send to existing user
    const success = await emailProvider.sendVerificationCode(email);

    if (success) {
        res.status(201).json({message: "Your verification email has been sent"});
    } else {
        res.status(503).json({message: "We received your request but failed to send you an email, try again later"});
    }
}

export const verifyEmail = async (req: Request<{}, {}, EmailVerificationInput>, res: Response) : Promise<void> => {
    const { email, code } = req.body;

    // First, check if this is a pending registration
    const pendingRegistration = await db.query.PendingRegistrations.findFirst({
        where: { email: email }
    });

    if (pendingRegistration) {
        // Handle pending registration verification
        const now = new Date(Date.now());
        if (now > pendingRegistration.expiresAt) {
            // Delete expired pending registration
            await db.delete(PendingRegistrations).where(eq(PendingRegistrations.email, email));
            throw new RequestError(
                401,
                "The verification code has expired, please register again",
                "CODE_EXPIRED"
            );
        }

        if (pendingRegistration.remainingAttempts <= 0) {
            throw new RequestError(
                401,
                "You have ran out of attempts to verify your email, please register again",
                "OUT_OF_ATTEMPTS"
            );
        }

        if (pendingRegistration.code === code) {
            // Code is correct, create the user account
            const roleId = await loadOrCreateRole(pendingRegistration.role);
            
            await db.transaction(async (tx) => {
                // Create user
                const [newUser] = await tx.insert(Users).values({
                    email: pendingRegistration.email,
                    password_hash: pendingRegistration.password_hash,
                    isActive: true,
                    isVerified: true, // Set to verified immediately
                }).returning({
                    id: Users.id,
                    email: Users.email,
                    updatedAt: Users.updatedAt
                });

                // Assign role
                await tx.insert(UserRoles).values({
                    userId: newUser.id,
                    roleId
                });

                // Delete pending registration
                await tx.delete(PendingRegistrations).where(eq(PendingRegistrations.email, email));

                // Publish event
                const message = new UserRegisteredMsg(
                    pendingRegistration.email,
                    pendingRegistration.name,
                    pendingRegistration.parentalSurname || undefined,
                    pendingRegistration.maternalSurname || undefined,
                    pendingRegistration.role,
                    newUser.updatedAt,
                    newUser.id
                );
                publishUserRegisteredEvent(message);
            });

            res.status(200).json({message: "Your account has been successfully created and verified"});
        } else {
            // Code is incorrect
            await db.update(PendingRegistrations)
                .set({ remainingAttempts: pendingRegistration.remainingAttempts - 1})
                .where(eq(PendingRegistrations.email, email));
            
            throw new RequestError(
                401,
                "The verification code is incorrect",
                "CODE_MISMATCH"
            );
        }
        return;
    }

    // Otherwise, handle existing user verification
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
            .set({ remainingAttempts: verificationCode.remainingAttempts - 1})
            .where(eq(VerificationCodes.userId, user.id));
        
        throw new RequestError(
            401,
            "The verification code is incorrect",
            "CODE_MISMATCH"
        );
    }
}


