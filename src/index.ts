
import express, { type Response } from "express";
import { globalErrorHandler } from "./handlers/error_handler.js";
import { LoginUserSchema, RegisterUserSchema } from "./schema/auth_schema.js";
import { asyncHandler } from "./handlers/async_handler.js";
import { registerUser, login, getInteractionDetails } from "./controllers/auth_controller.js";
import { validateRequest } from "./validators/request_validator.js";
import { initializeOIDCProvider } from "./oidc/provider.js"

const app = express();

app.use(express.json());

app.get("/api", (res: Response) => {
  res.json({ mensaje: "IdP is listening" });
});

app.post("/api/auth/register", validateRequest(RegisterUserSchema), asyncHandler(registerUser));

app.get("/api/auth/interaction/:uid", asyncHandler(getInteractionDetails));

app.post("/api/auth/interaction/:uid/login", validateRequest(LoginUserSchema), asyncHandler(login));

async function startServer() {
    try {
        const provider = await initializeOIDCProvider();

        app.use('/oidc', provider.callback());

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

await startServer();
