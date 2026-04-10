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
            .regex(/[^A-Za-z0-9]/, { error: "Password must have at least one symbol." })
    })
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>["body"]

export const LoginUserSchema = z.object({
    body: z.object({
        email: z.email({ error: "Email has the wrong format"}),
        password: z.string()
            .min(1, { error: "Password is required"})
    })
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>["body"];
