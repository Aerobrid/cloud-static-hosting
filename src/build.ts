import path from "path";
import fs from "fs";

// Minimal buildProject stub to simulate a build for local testing.
export const buildProject = async (id: string) => {
    const repoPath = path.join(__dirname, `../dist/repos/${id}`);
    const outDir = path.join(repoPath, "dist");
    try {
        fs.mkdirSync(outDir, { recursive: true });
        // Create a tiny index.html so the worker's upload step finds files
        const index = path.join(outDir, "index.html");
        fs.writeFileSync(index, `<!doctype html><meta charset="utf-8"><title>Built ${id}</title>`);
    } catch (err) {
        console.error("buildProject stub error:", err);
        throw err;
    }
};
