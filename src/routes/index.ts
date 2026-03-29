import { fileURLToPath, pathToFileURL } from 'url';
import path, { join, relative } from 'path';
import { readdirSync, statSync } from 'fs';

import { Router } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const routesPath = __dirname;

/**
 * Route files that are explicitly mounted by a parent route module and
 * must therefore be skipped by the recursive loader to avoid duplicate
 * endpoint registration.
 *
 * Paths are relative to the routes directory and use forward slashes
 * (e.g. "api/applications").
 */
const manuallyMountedRoutes = new Set([
    'api/applications',
    'api/artisans',
]);

/**
 * Tracks every mount path registered by the loader so tests can assert
 * that no duplicates exist.
 */
export const registeredMountPaths: string[] = [];

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
            const relPath = relative(routesPath, fullPath).replace(/\.(ts|js)$/, '');

            // Skip files that are already mounted by their parent route module
            const normalizedRel = relPath.replace(/\\/g, '/');
            if (manuallyMountedRoutes.has(normalizedRel)) {
                continue;
            }

            // Use dynamic import() instead of require()
            const fileUrl = pathToFileURL(fullPath).href;
            const routeModule = await import(fileUrl);
            const route = routeModule.default;

            if (route && typeof route === 'function') {
                let mountPath = '/' + normalizedRel;

                // Special case: web.ts mounts at "/"
                if (mountPath === '/web') mountPath = '/';

                if (mountPath.includes('/__')) mountPath = mountPath.replace(/\/__\w+/g, '')

                router.use(mountPath, route);
                registeredMountPaths.push(mountPath);
            }
        }
    }
}

export default router;