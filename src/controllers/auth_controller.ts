import argon2 from "argon2"
import { Request, Response } from "express"
import { db } from "../drizzle/db.js"
import { Users } from "../drizzle/schema.js"
import { LoginUserInput, RegisterUserInput } from "../schema/auth_schema.js"
import { AppError } from "../util/errors.js"
import { getProvider } from "../oidc/provider.js"

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
    }).returning({
        id: Users.id,
        email: Users.email
    });

    res.status(201).json({
        message: "User registration successful",
        user: newUser
    });
}

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

    const isPasswordValid = await argon2.verify(user.password_hash, password);

    if (!isPasswordValid) {
        throw new AppError(401, "Email or password are incorrect");
    }

    if (!user.isActive) {
        throw new AppError(403, "This account has been suspended");
    }

    const result = {
        login: {
            accountId: user.id
        }
    };

    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
}

async function verifyIsEmailInUse(email: string) : Promise<boolean> {
    const existingUser = await db.query.Users.findFirst({
        where: { email: email }
    });

    return existingUser != null
}
