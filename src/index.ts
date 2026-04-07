import express from "express";
import cors from "cors";
import path from "path";
import simpleGit from "simple-git";
import { generateRandomId } from "./utils";

import { getAllFiles } from "./files";
import { uploadFile } from "./aws";
import { createClient } from "redis";

// Initialize Redis Client
const subscriber = createClient();
subscriber.connect();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/deploy", async (req, res) => {
    const repoUrl = req.body.repoUrl;
    
    if (!repoUrl) {
        return res.status(400).json({ error: "No repository URL provided" });
    }

    const id = generateRandomId();
    const outputDir = path.join(__dirname, `../dist/repos/${id}`);

    try {
        console.log(`Cloning ${repoUrl} to ${outputDir}...`);
        
        // 1. Clone the repository
        await simpleGit().clone(repoUrl, outputDir);
        
        // 2. Fetch all files from the cloned directory recursively
        const files = getAllFiles(outputDir);

        // 3. Upload each file to Cloudflare R2
        console.log(`Uploading ${files.length} files to Cloudflare R2...`);
        const uploadPromises = files.map(file => {
            // Remove the absolute path prefix to store it cleanly in R2
            // e.g., transforms 'C:\...\dist\repos\id123\src\index.js' -> 'id123/src/index.js'
            const r2FileName = file.slice(outputDir.length + 1).replace(/\\/g, '/');
            return uploadFile(`output/${id}/${r2FileName}`, file);
        });

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        // 4. Push job to Redis queue for the Deploy Service to pick up
        console.log(`Pushing job ${id} to Redis...`);
        await subscriber.lPush("build-queue", id);
        // Optional: Update status in another redis key
        await subscriber.hSet("status", id, "uploaded");

        res.json({ id: id, status: "uploaded" });
    } catch (error) {
        console.error("Deploy error:", error);
        res.status(500).json({ error: "Deployment failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Upload service running on port ${PORT}`);
});
