import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { appUrl } from './helpers';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export interface StorageOptions {
    folder?: string;
    tags?: string[];
    optimize?: boolean;
    width?: number;
    height?: number;
}

export interface UploadResult {
    url: string;
    path: string;
    provider: string;
    metadata?: any;
}

export interface IStorageProvider {
    upload(file: Express.Multer.File, options?: StorageOptions): Promise<UploadResult>;
    delete(filePath: string): Promise<void>;
}

export class LocalStorageProvider implements IStorageProvider {
    private baseDir: string;

    constructor() {
        this.baseDir = path.join(process.cwd(), 'public');

        // Ensure uploads directory exists
        const uploadsDir = path.join(this.baseDir, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    }

    async upload(file: Express.Multer.File, options?: StorageOptions): Promise<UploadResult> {
        const folder = options?.folder || 'uploads';
        const targetDir = path.join(this.baseDir, folder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const isImage = file.mimetype.startsWith('image/');
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${isImage && options?.optimize ? '.webp' : path.extname(file.originalname)}`;
        const relativePath = path.join(folder, filename);
        const fullPath = path.join(this.baseDir, relativePath);

        let metadata: any = {};

        if (isImage && options?.optimize) {
            let pipeline = sharp(file.buffer || file.path);

            if (options.width || options.height) {
                pipeline = pipeline.resize(options.width, options.height, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }

            const buffer = await pipeline
                .webp({ quality: 80 })
                .toBuffer();

            await writeFile(fullPath, buffer);

            const sharpMeta = await sharp(buffer).metadata();
            metadata = {
                width: sharpMeta.width,
                height: sharpMeta.height,
                format: 'webp',
            };
        } else {
            if (file.buffer) {
                await writeFile(fullPath, file.buffer);
            } else if (file.path) {
                fs.copyFileSync(file.path, fullPath);
            } else {
                throw new Error('No file content found');
            }

            if (isImage) {
                const sharpMeta = await sharp(file.buffer || file.path).metadata();
                metadata = {
                    width: sharpMeta.width,
                    height: sharpMeta.height,
                    format: sharpMeta.format,
                };
            }
        }

        return {
            url: appUrl(relativePath.replace(/\\/g, '/')),
            path: fullPath,
            provider: 'local',
            metadata,
        };
    }

    async delete(filePath: string): Promise<void> {
        if (fs.existsSync(filePath)) {
            await unlink(filePath);
        }
    }
}

export class StorageService {
    private static instance: StorageService;
    private provider: IStorageProvider;

    private constructor() {
        // Default to LocalStorageProvider, can be extended to use S3/Cloudinary based on env
        this.provider = new LocalStorageProvider();
    }

    public static getInstance(): StorageService {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService();
        }
        return StorageService.instance;
    }

    async upload(file: Express.Multer.File, options?: StorageOptions): Promise<UploadResult> {
        return this.provider.upload(file, options);
    }

    async delete(filePath: string): Promise<void> {
        return this.provider.delete(filePath);
    }
}

export default StorageService.getInstance();
