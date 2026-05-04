import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || "",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

// prefix: output/id/
export async function downloadS3Folder(prefix: string) {
    const bucket = process.env.R2_BUCKET_NAME || "vercel-clone";
    
    // list objects in the bucket with the given prefix (e.g output/id)
    // it will contain .env, src folder, index.html, etc.
    const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
    });

    const allObjects = await s3.send(listCommand);

    if (!allObjects.Contents) return;

    // for each key, download the object and save it to workspace/output/id (could do dist if you want to)
    // [workspace/output/id/index.css, workspace/output/id/src, workspace/output/id/index.html, ...(all the other files)]
    const allPromises = allObjects.Contents.map(async (file) => {
        if (!file.Key) return;
        const finalOutputPath = path.join(__dirname, "..", "workspace", file.Key);
        
        // ensure directory exists (recursively)
        const dirName = path.dirname(finalOutputPath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }

        // get file from s3 -> save in local file
        const getObjectCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: file.Key,
        });

        const { Body } = await s3.send(getObjectCommand);
        if (Body) {
            const writeStream = fs.createWriteStream(finalOutputPath);
            // we know body is a readable stream
            (Body as NodeJS.ReadableStream).pipe(writeStream);

            // when the file is fully written -> resolve the promise
            return new Promise((resolve) => writeStream.on("finish", resolve));
        }
    });

    // allPromises = [Promise<void>, Promise<void>, ...(all the other promises)]
    // wait for all files to be downloaded (await all promises)
    await Promise.all(allPromises.filter(x => x !== undefined));
}

// get all files in a directory recursively
const getAllFiles = (folderPath: string): string[] => {
    let response: string[] = [];
    const allFilesAndFolders = fs.readdirSync(folderPath);

    allFilesAndFolders.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        
        // if it's a directory, recursively call getAllFiles and concatenate the results
        if (fs.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath));
        } else {
            // if it's a file, add it to the response
            response.push(fullFilePath);
        }
    });

    // return all files
    return response;
};

export async function uploadDirectoryS3(localDirPath: string, s3Prefix: string) {
    const files = getAllFiles(localDirPath);
    
    const uploadPromises = files.map(async (file) => {
        // file is an absolute path. make it relative to localDirPath
        // this is used for the key of the file in s3
        // Example: if localDirPath = "workspace/output/id/dist" and file = "workspace/output/id/dist/index.css", 
        // then relativePath = "index.css" and s3Key = "dist/id/index.css"
        const relativePath = path.relative(localDirPath, file).replace(/\\/g, '/');
        // path.join joins all the arguments to form a path
        // s3Prefix is "dist/id"
        // relativePath is "index.css"
        // so s3Key = "dist/id/index.css"
        const s3Key = `${s3Prefix}/${relativePath}`;
        
        const fileStream = fs.createReadStream(file);
        
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || "vercel-clone",
            Key: s3Key,
            Body: fileStream,
        });

        // sends the file to s3
        await s3.send(command);
    });

    await Promise.all(uploadPromises);
}
