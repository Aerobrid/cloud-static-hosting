import { createClient } from "redis";
import { downloadS3Folder, uploadDirectoryS3 } from "./aws";
import { buildProject } from "./utils";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const subscriber = createClient();
subscriber.on('error', err => console.log('Redis Client Error', err));

async function main() {
    await subscriber.connect();
    console.log("Deploy service connected to Redis. Waiting for jobs...");

    while (true) {
        try {
            // brPop blocks until a value is available on the queue
            const res = await subscriber.brPop("build-queue", 0);
            
            if (res) {
                // In redis v4, brPop returns { key: string, element: string }
                const id = res.element;
                
                console.log(`Picked up job: ${id}`);
                await subscriber.hSet("status", id, "processing");

                console.log(`Downloading source from S3...`);
                // The prefix where the upload-service stored it is 'output/{id}'
                await downloadS3Folder(`output/${id}`);
                
                console.log(`Building project ${id}...`);
                await buildProject(id);

                console.log(`Uploading built project ${id} to S3...`);
                const basePath = path.join(__dirname, `../workspace/output/${id}`);
                const distPath = path.join(basePath, "dist");
                const buildPath = path.join(basePath, "build");

                // React apps usually build to 'build' (Create React App) or 'dist' (Vite)
                const finalOutputDir = fs.existsSync(buildPath) ? buildPath : distPath;

                await uploadDirectoryS3(finalOutputDir, `dist/${id}`);

                console.log(`Cleaning up local workspace...`);
                fs.rmSync(basePath, { recursive: true, force: true });

                console.log(`Finished job: ${id}`);
                await subscriber.hSet("status", id, "deployed");
            }
        } catch (error) {
            console.error("Error processing job:", error);
        }
    }
}

// call main after the file is loaded
main().catch(err => {
    console.error("Failed to start deploy service:", err);
    process.exit(1);
});
