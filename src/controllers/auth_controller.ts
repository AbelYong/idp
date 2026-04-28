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

    const accountId = user.id;
    const interaction = await provider.interactionDetails(req, res);
    const params = interaction.params;

    const grant = new provider.Grant({
        clientId: params.client_id as string,
        accountId: accountId,
    });

    const requestedScopes = (params.scope as string) || "openid";
    const requestedResource = params.resource || process.env.DEFAULT_RESOURCE;

    grant.addOIDCScope(requestedScopes);

    if (requestedResource) {
        const resources = Array.isArray(requestedResource) ? requestedResource : [requestedResource as string];
        for (const res of resources) {
            grant.addResourceScope(res, requestedScopes);
        }
    }

    const grantId = await grant.save();

    const result = {
        login: { accountId: accountId },
        consent: {
            grantId: grantId,
        }
    };

    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
}
