import express from "express";
import { getFileStream } from "./aws";
import mime from "mime-types";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.get("/*", async (req, res) => {
    // Extract subdomain: id.vercel.com -> id
    const host = req.hostname;
    // We assume the id is the first part of the hostname
    const id = host.split(".")[0];
    
    // Extract file path. If root, serve index.html
    const filePath = req.path === "/" ? "/index.html" : req.path;
    
    // Construct the S3 key: dist/{id}/{filePath}
    const s3Key = `dist/${id}${filePath}`;

    try {
        const fileStream = await getFileStream(s3Key);
        
        // Determine the content type
        const type = mime.lookup(filePath);
        if (type) {
            res.set("Content-Type", type);
        }

        // Pipe the S3 stream directly to the Express response
        fileStream.pipe(res);
    } catch (error) {
        console.error(`Error streaming file ${s3Key}:`, error);
        res.status(404).send("File not found");
    }
});

const PORT = 3001;

app.listen(PORT, () => {
    console.log(`Request handler running on port ${PORT}`);
});
