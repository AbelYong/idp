import { Request, Response, NextFunction } from "express"
import { z } from "zod"

export const validateRequest = (schema: z.ZodTypeAny) =>
    async (req: Request, res: Response, next: NextFunction) : Promise<void> => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });

            return next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: "Invalid Input",
                    details: error.issues.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
                return;
            }
            return next(error);
        }
    };