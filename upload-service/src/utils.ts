import crypto from "crypto";

const MAX_LEN = 9;

export function generateRandomId(length: number = MAX_LEN): string {
    // Randomly generating same id -> Collision (could overwrite a previous deployment)
    // So use cryptographically (rather than Math.random()) secure random ID generator (16^MAX_LEN possibilities)
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
}
