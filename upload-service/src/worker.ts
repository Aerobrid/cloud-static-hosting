import { createClient } from "redis";
import { downloadS3Folder } from "./aws";
import { buildProject } from "./build";
import { uploadFile } from "./aws";
import { getAllFiles } from "./files";
import path from "path";

const subscriber = createClient();
subscriber.connect();

async function main() {
    console.log("Worker is running and waiting for jobs...");

    while (true) {
        // brPop blocks the connection until something is pushed to the queue
        const response = await subscriber.brPop("build-queue", 0);
        
        if (response) {
            // response looks like { key: 'build-queue', element: 'id12345' }
            const id = response.element;
            console.log(`\n=== Picked up new deployment job: ${id} ===`);

            try {
                // 1. Download all the raw source files from Cloudflare R2
                console.log("Downloading source code from R2...");
                const localDownloadPath = path.join(__dirname, `../dist/repos/${id}`);
                await downloadS3Folder(`output/${id}`, localDownloadPath);

                console.log("Download complete. Starting build process...");
                
                // 2. Build the project (npm install && npm run build)
                await buildProject(id);
                console.log("Build successful!");

                // 3. Upload exactly the compiled build/dist files back to R2
                console.log("Uploading compiled files back to R2...");
                const buildOutputDir = path.join(localDownloadPath, "dist"); // Or "build" for CRA
                const compiledFiles = getAllFiles(buildOutputDir);

                const uploadPromises = compiledFiles.map(file => {
                    const r2FileName = file.slice(buildOutputDir.length + 1).replace(/\\/g, '/');
                    return uploadFile(`dist/${id}/${r2FileName}`, file);
                });

                await Promise.all(uploadPromises);

                // 4. Mark job as complete
                await subscriber.hSet("status", id, "deployed");
                console.log(`=== Finished deploying: ${id} ===`);
            } catch (error) {
                console.error(`Failed to process job ${id}:`, error);
                await subscriber.hSet("status", id, "failed");
            }
        }
    }
}

main();
