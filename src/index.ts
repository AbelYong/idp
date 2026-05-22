import express, { type Response } from "express";
import { globalErrorHandler } from "./handlers/error_handler.js";
import { EmailVerificationRequestSchema, EmailVerificationSchema, LoginUserSchema, RegisterUserSchema, UserRecoverySchema } from "./schema/auth_schema.js";
import { asyncHandler } from "./handlers/async_handler.js";
import { login, getInteractionDetails } from "./controllers/auth_controller.js";
import { loadDefaultRole, registerUser, requestEmailVerification, verifyEmail } from "./controllers/registration_controller.js"
import { requestUserRecovery, completeUserRecovery } from "./controllers/recovery_controller.js";
import { validateRequest } from "./validators/request_validator.js";
import { initializeOIDCProvider } from "./oidc/provider.js"
import { rabbitMQService } from "./messaging/rabbitmq.js";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

async function startServer() {
    try {
        const provider = await initializeOIDCProvider();
        app.use('/oidc', provider.callback());

        app.use(express.json());

        app.get("/api", (res: Response) => {
            res.json({ mensaje: "IdP is listening" });
        });

        await loadDefaultRole();

        app.get("/api/auth/interaction/:uid", asyncHandler(getInteractionDetails));
        app.post("/api/auth/interaction/:uid", validateRequest(LoginUserSchema), asyncHandler(login));
        app.post("/api/auth/registration", validateRequest(RegisterUserSchema), asyncHandler(registerUser));
        app.post("/api/auth/verification", validateRequest(EmailVerificationRequestSchema), asyncHandler(requestEmailVerification));
        app.patch("/api/auth/verification", validateRequest(EmailVerificationSchema), asyncHandler(verifyEmail));
        app.post("/api/auth/recovery", validateRequest(EmailVerificationRequestSchema), asyncHandler(requestUserRecovery));
        app.patch("/api/auth/recovery", validateRequest(UserRecoverySchema), asyncHandler(completeUserRecovery));

        await rabbitMQService.connect();

        app.use(globalErrorHandler);

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Identity Provider listening on ${PORT}`);
        });

    } catch (error) {
        console.error("Failure on startup:", error);
        process.exit(1);
    }
}

process.on("SIGINT", async() => {
    await rabbitMQService.close();
    process.exit(0);
});

await startServer();
