import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Initialize S3 client for Cloudflare R2
const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || "https://example.com", // Provide a fallback so it's strictly a string
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const uploadFile = async (fileName: string, localFilePath: string) => {
    const fileStream = fs.createReadStream(localFilePath);
    
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || "vercel-clone",
        Key: fileName,
        Body: fileStream,
    });

    try {
        await s3.send(command);
    } catch (error) {
        console.error(`Failed to upload ${fileName} to R2:`, error);
        throw error;
    }
};

// Minimal stub to satisfy worker usage during local testing.
export const downloadS3Folder = async (prefix: string, localPath: string) => {
    try {
        fs.mkdirSync(localPath, { recursive: true });
        // Create a small marker file so downstream code finds at least one file to upload
        const marker = path.join(localPath, "__downloaded_placeholder.txt");
        fs.writeFileSync(marker, `Stubbed download of ${prefix}`);
    } catch (err) {
        console.error("downloadS3Folder stub error:", err);
        throw err;
    }
};
