import * as nodemailer from "nodemailer"
import { generateSecureOTP } from "./crypto.js";
import { db } from "../drizzle/db.js"
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { RecoveryCodes, VerificationCodes } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

export interface IEmailManager {
    sendVerificationCode(userEmail: string) : Promise<boolean>;
    sendRecoveryCode(userEmail: string) : Promise<boolean>;
}

export class EmailManager implements IEmailManager {
    private readonly transporter : nodemailer.Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>

    constructor(private readonly startTLS : boolean) {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: this.startTLS ? 587 : 465,
            secure: !this.startTLS, 
            auth: {
                user: process.env["IDP_EMAIL_ADDRESS"],
                pass: process.env["IDP_EMAIL_PASS"],
            }
        });
    }

    private getMinutesFromNowTimestamp(minutes: number) : Date {
        const expirationTime: Date = new Date(Date.now());
        expirationTime.setMinutes(expirationTime.getMinutes() + minutes);
        return expirationTime;
    }

    /**
     * sendVerificationCode
     * userEmail: string  : Promise<boolean>    */
    public async sendVerificationCode(userEmail: string) : Promise<boolean> {
        const user = await db.query.Users.findFirst({
            where: { email: userEmail }
        });

        if (!user) {
            return true; // Mitigate enumeration
        }

        const code = generateSecureOTP();
        await this.setVerificationCodeInDb(user.id, code);
        
        try {
            const mailOptions = {
                from: '"Gazella" <gazella.noreply@gmail.com>',
                to: userEmail,
                subject: 'Your security verification code',
                text: `Your verification code is: ${code}. It will expire in 15 minutes`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Verify your account</h2>
                    <p>Your six-digit verification code is:</p>
                    <h1 style="color: #399fc1; letter-spacing: 5px;">${code}</h1>
                    <p><em>This code will expire in 15 minutes. If you did not requested it, ignore this email</em></p>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`Verification code succesfully sent to: ${userEmail}: ${info.messageId}`);
            return true;

        } catch (error) {
            this.removeVerificationCodeFromDb(user.id)
            console.error("Failed to send verification code: ", error);
            return false;
        }
    }

    private async setVerificationCodeInDb(userId: string, code: string) {
        const existingVerificationCode = await db.query.VerificationCodes.findFirst({
            where: { userId: userId }
        });

        const expirationTime = this.getMinutesFromNowTimestamp(15);
        const defaultAttempts = 3;

        if (existingVerificationCode) {
            await db.update(VerificationCodes)
                .set({ code: code, expiresAt: expirationTime, remainingAttempts: defaultAttempts })
                .where(eq(VerificationCodes.userId, userId))
        } else {
            await db.insert(VerificationCodes).values({
                code: code,
                remainingAttempts: defaultAttempts,
                expiresAt: expirationTime,
                userId: userId
            });
        }
    }

    private async removeVerificationCodeFromDb(userId: string) {
        await db.delete(VerificationCodes)
            .where(eq(VerificationCodes.userId, userId));
    }

    /**
     * sendRecoveryCode
     * userEmail: string  : Promise<boolean>    */
    public async sendRecoveryCode(userEmail: string) : Promise<boolean> {
        const user = await db.query.Users.findFirst({
            where: { email: userEmail }
        });

        if (!user) {
            return true; // Mitigate enumeration
        }

        const code = generateSecureOTP();
        await this.setRecoveryCodeInDb(user.id, code);
        
        try {
            const mailOptions = {
                from: '"Gazella" <gazella.noreply@gmail.com>',
                to: userEmail,
                subject: 'Recover your account',
                text: `Your code to recover your accoint is: ${code}. It will expire in 15 minutes`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Recover your account</h2>
                    <p>Your six-digit recovery code is:</p>
                    <h1 style="color: #399fc1; letter-spacing: 5px;">${code}</h1>
                    <p><em>This code will expire in 15 minutes. If you did not requested it, ignore this email</em></p>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`Account recovery code succesfully sent to: ${userEmail}: ${info.messageId}`);
            return true;

        } catch (error) {
            this.removeRecoveryCodeFromDb(user.id);
            console.error("Failed to send account recovery code: ", error);
            return false;
        }
    }

    private async setRecoveryCodeInDb(userId: string, code: string) {
        const existingRecoveryCode = await db.query.RecoveryCodes.findFirst({
            where: { userId: userId }
        });

        const expirationTime = this.getMinutesFromNowTimestamp(15);
        const defaultAttempts = 3;

        if (existingRecoveryCode) {
            await db.update(RecoveryCodes)
                .set({ code: code, expiresAt: expirationTime, remainingAttempts: defaultAttempts })
                .where(eq(RecoveryCodes.userId, userId))
        } else {
            await db.insert(RecoveryCodes).values({
                code: code,
                expiresAt: expirationTime,
                remainingAttempts: defaultAttempts,
                userId: userId
            });
        }
    }

    private async removeRecoveryCodeFromDb(userId: string) {
        await db.delete(RecoveryCodes)
            .where(eq(RecoveryCodes.userId, userId));
    }
}