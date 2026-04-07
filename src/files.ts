import fs from "fs";
import path from "path";

// Recursively fetches all files from a directory
export const getAllFiles = (folderPath: string): string[] => {
    let response: string[] = [];
    const allFilesAndFolders = fs.readdirSync(folderPath);

    allFilesAndFolders.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if (fs.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath));
        } else {
            response.push(fullFilePath);
        }
    });

    return response;
};
