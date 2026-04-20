import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { LoginUserInput } from "../schema/auth_schema.js"
import { AppError, RequestError } from "../util/errors.js"
import { getProvider } from "../oidc/provider.js"

export const getInteractionDetails = async (req: Request, res: Response) : Promise<void> => {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);

    res.status(200).json({
        message: "Interaccion started succesfully",
        action_required: "Please follow up with a POST request to this URL with your credentials",
        interactionId: details.jti, 
        prompt_type: details.prompt.name
    });
}

export const login = async (req: Request, res: Response): Promise<void> => {
    const provider = getProvider();
    await provider.interactionDetails(req, res);

    const { email, password } = req.body as LoginUserInput;

    const user = await db.query.Users.findFirst({
        where: { email: email }
    });

    if (!user) {
        throw new AppError(401, "Email or password are incorrect");
    }

    if (!user.isVerified) {
        throw new RequestError(
            401,
            "Only email-verified users can log-in and this account is not verified",
            "NOT_VERIFIED"
        );
    }

    if (!user.isActive) {
        throw new RequestError(
            403,
            "This account has been suspended",
            "USER_SUSPENDED"
        );
    }

    const isPasswordValid = await argon2.verify(user.password_hash, password);

    if (!isPasswordValid) {
        throw new AppError(401, "Email or password are incorrect");
    }

    const result = {
        login: {
            accountId: user.id
        }
    };

    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
}
