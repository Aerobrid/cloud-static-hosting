import { createClient } from "redis";
import { downloadS3Folder, uploadDirectoryS3 } from "./aws";
import { buildProject } from "./utils";
import path from "path";
import dotenv from "dotenv";

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
                const distPath = path.join(__dirname, `../workspace/output/${id}/dist`);

                // wait + usually react apps build to 'build' or 'dist'
                // we assume 'dist' based on typical vite/react setups.
                await uploadDirectoryS3(distPath, `dist/${id}`);

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
