
export class AppError extends Error {
    public readonly statusCode : number = 500;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class RequestError extends Error {
    constructor(public readonly statusCode: number, public readonly message: string, public readonly code: {}) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;

        Error.captureStackTrace(this, this.constructor);
    }
}
