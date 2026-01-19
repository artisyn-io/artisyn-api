import { fileURLToPath, pathToFileURL } from 'url';
import path, { join, relative } from 'path';
import { readdirSync, statSync } from 'fs';

import { Router } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const routesPath = __dirname;

export const loadRoutes = async (dirPath: string) => {
    const files = readdirSync(dirPath);

    for (const file of files) {
        const fullPath = join(dirPath, file);
        const stats = statSync(fullPath);

        if (file.startsWith('__tests__')) {
            continue;
        }

        if (stats.isDirectory()) {
            // Recurse into subdirectory
            await loadRoutes(fullPath);
        } else if (stats.isFile() && !file.startsWith('index') && /\.(ts|js)$/.test(file)) {
            // Use dynamic import() instead of require()
            const fileUrl = pathToFileURL(fullPath).href;
            const routeModule = await import(fileUrl);
            const route = routeModule.default;

            if (route && typeof route === 'function') {
                const relPath = relative(routesPath, fullPath).replace(/\.(ts|js)$/, '');
                let mountPath = '/' + relPath.replace(/\\/g, '/');

                // Special case: web.ts mounts at "/"
                if (mountPath === '/web') mountPath = '/';

                if (mountPath.includes('/__')) mountPath = mountPath.replace(/\/__\w+/g, '')

                router.use(mountPath, route);
            }
        }
    }
}

export default router;