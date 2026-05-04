import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

export const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || "",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const getFileStream = async (key: string) => {
    const bucket = process.env.R2_BUCKET_NAME || "vercel-clone";

    const getObjectCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    const response = await s3.send(getObjectCommand);
    return response.Body as NodeJS.ReadableStream;
};
