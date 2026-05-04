import { exec } from "child_process";

export function buildProject(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // run npm install and npm run build in the downloaded workspace directory
        const child = exec(`npm install && npm run build`, {
            cwd: __dirname + `/../workspace/output/${id}`
        });

        // logging stdout
        child.stdout?.on('data', function(data) {
            console.log('stdout: ' + data);
        });

        // logging stderr
        child.stderr?.on('data', function(data) {
            console.log('stderr: ' + data);
        });

        // on exit
        child.on('close', function(code) {
            if (code !== 0) {
                console.error(`Build process exited with code ${code}`);
                reject(new Error(`Build failed with code ${code}`));
            } else {
                console.log("Build successful!");
                resolve();
            }
        });
    });
}
