import express from "express"
import request from "supertest"
import { vi, test, expect } from "vitest"
import { registerUser } from "../../src/controllers/registration_controller";
import { validateRequest } from "../../src/validators/request_validator";
import { RegisterUserSchema } from "../../src/schema/auth_schema";
import { asyncHandler } from "../../src/handlers/async_handler";
import { globalErrorHandler } from "../../src/handlers/error_handler";

const { mockFindFirst, mockReturning, mockHash } = vi.hoisted(() => ({
    mockFindFirst: vi.fn(),
    mockReturning: vi.fn(),
    mockHash: vi.fn().mockResolvedValue('mock_hash')
}));

vi.mock('argon2', () => ({
    default: {
        hash: mockHash,
        argon2id: 2
    }
}));

vi.mock('../../src/drizzle/db', () => ({
    db: {
        query: {
            Users: {
                findFirst: mockFindFirst
            }
        },
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        transaction: vi.fn().mockReturnThis(),
        returning: mockReturning,
    }
}));

vi.mock("../../src/oidc/provider", () => ({
    getProvider: vi.fn().mockReturnValueOnce({
        interactionDetails: vi.fn().mockResolvedValue({ prompt: { name: 'login' }, jti: '123' }),
        interactionFinished: vi.fn().mockResolvedValue(undefined)
    })
}));

const app = express();
app.use(express.json());
app.post('/api/auth/register', validateRequest(RegisterUserSchema), asyncHandler(registerUser));
app.use(globalErrorHandler);

test("Valid registration request returns 201 and new user", async () => {
    const validPayload = {
        email: "test@example.com",
        password: "Valid_Pass123",
        name: "test"
    };

    mockFindFirst.mockResolvedValueOnce(undefined);
    mockReturning.mockResolvedValueOnce([{ id: 'uuid-1234', email: validPayload.email}]);

    const response = await request(app)
        .post('/api/auth/register')
        .send(validPayload);
        
    expect(response.statusCode).toBe(201);
    expect(response.body.user).toHaveProperty('id', 'uuid-1234');
});

test("Valid registration email already in use returns 409 does not call database", async () => {
    const validPayload = {
        email: "test@example.com",
        password: "Valid_Pass123",
        name: "test"
    };

    mockFindFirst.mockResolvedValueOnce([{ id: 'existing_uuid', email: validPayload.email }]);

    const response = await request(app)
        .post('/api/auth/register')
        .send(validPayload);
        
    expect(response.statusCode).toBe(409);
    expect(mockReturning).not.toHaveBeenCalled();
});

test("Invalid registration password wrong format, returns 400 does not query for email", async () => {
    const invalidPayload = {
        email: "test@example",
        password: "invalidpass",
        name: "test"
    };

    const response = await request(app)
        .post('/api/auth/register')
        .send(invalidPayload);
        
    expect(response.statusCode).toBe(400);
    expect(mockFindFirst).not.toHaveBeenCalled();
});

test("Database error during registration returns 500", async () => {
    const validPayload = {
        email: "test@example.com",
        password: "Valid_Pass123",
        name: "test"
    };

    mockFindFirst.mockRejectedValueOnce(new Error("Database disconnected"));

    const response = await request(app)
        .post('/api/auth/register')
        .send(validPayload);
        
    expect(response.statusCode).toBe(500);
    expect(mockReturning).not.toHaveBeenCalled();
});
