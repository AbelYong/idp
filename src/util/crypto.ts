import crypto from "node:crypto"

const MASTER_KEY_HEX = process.env.DB_ENCRYPTION_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const MASTER_KEY = Buffer.from(MASTER_KEY_HEX, "hex");
const ALGORITHM = "aes-256-gcm";

export function encryptSecret(plainSecret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

    let encrypted = cipher.update(plainSecret, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
        throw new Error("The secret has the wrong format");
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
