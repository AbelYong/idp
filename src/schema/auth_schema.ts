import { z } from "zod"

export const RegisterUserSchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format" })
            .max(128, { error: "Email is too long" }),
        password: z.string()
            .min(8, { error: "Password must have at least eight characters." })
            .regex(/[A-Z]/, { error: "Password must have at least one uppercase letter." })
            .regex(/[a-z]/, { error: "Password must have at least one lowercase letter." })
            .regex(/\d/, { error: "Password must have at least one digit." })
            .regex(/[^A-Za-z0-9]/, { error: "Password must have at least one symbol." }),
        name: z.string()
            .trim()
            .min(2, { error: "Name cannot be empty or be only blank space" })
            .max(32,{ error: "Name cannot be longer than 32 characters"})
            .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/, { 
                error: "Numbers, symbols and contiguous blank spaces are not allowed" 
            }),
        parentalSurname: z.string()
            .trim()
            .max(32,{ error: "Parental surname cannot be longer than 32 characters"})
            .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$|^$/, { 
                error: "Numbers, symbols and contiguous blank spaces are not allowed" 
            }),
        maternalSurname: z.string()
            .trim()
            .max(32,{ error: "Maternal surname cannot be longer than 32 characters"})
            .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$|^$/, { 
                error: "Numbers, symbols and contiguous blank spaces are not allowed" 
            }),
    })
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>["body"]

export const EmailVerificationRequestSchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format" })
            .max(128, ({ error: "Email is too long" })),
    })
});

export type EmailVerificationRequestInput = z.infer<typeof EmailVerificationRequestSchema>["body"]

export const EmailVerificationSchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format" })
            .max(128, ({ error: "Email is too long" })),
        code: z.string()
            .min(6, { error: "Verification code should be exactly 6 digits long."})
            .max(6, { error: "Verification code should be exactly 6 digits long."})
    })
});

export type EmailVerificationInput = z.infer<typeof EmailVerificationSchema>["body"]

export const LoginUserSchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format"}),
        password: z.string()
            .min(1, { error: "Password is required"})
    })
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>["body"];

export const UserRecoverySchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format" })
            .max(128, { error: "Email is too long" }),
        password: z.string()
            .min(8, { error: "Password must have at least eight characters." })
            .regex(/[A-Z]/, { error: "Password must have at least one uppercase letter." })
            .regex(/[a-z]/, { error: "Password must have at least one lowercase letter." })
            .regex(/\d/, { error: "Password must have at least one digit." })
            .regex(/[^A-Za-z0-9]/, { error: "Password must have at least one symbol." }),
        code: z.string()
            .min(6, { error: "Verification code should be exactly 6 digits long."})
            .max(6, { error: "Verification code should be exactly 6 digits long."})
    })
});

export type UserRecoveryInput = z.infer<typeof UserRecoverySchema>["body"];
