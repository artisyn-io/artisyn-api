import { Request, Response } from 'express';

// Default Resource function (original pattern)
const Resource = (req: Request, res: Response, resource: any) => {
    return {
        json: () => {
            return {
                status: (code: number) => {
                    return {
                        additional: (obj: any) => {
                            res.status(code).json({
                                ...obj,
                                data: resource.data
                            });
                        }
                    };
                }
            };
        }
    };
};

export default Resource;

// Named exports for new resources
export { default as ApiResource } from './ApiResource';
export { default as JsonResource } from './JsonResource';
export { Resource as ResourceClass, ResourceCollection } from './Resource';
export { default as UserResource } from './UserResource';
export { default as CategoryResource } from './CategoryResource';
export { default as CategoryCollection } from './CategoryCollection';
export { default as MediaResource } from './MediaResource';
export { default as MediaCollection } from './MediaCollection';
export { default as ArtisanResource } from './ArtisanResource';
export { default as ArtisanCollection } from './ArtisanCollection';
