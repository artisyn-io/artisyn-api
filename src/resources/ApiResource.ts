import { Response } from 'express';

const ApiResource = (resource: any) => {
    return {
        json: () => {
            const data = resource.toArray ? resource.toArray() : resource.data();
            return {
                status: (code: number) => {
                    resource['res'].status(code).json({
                        status: code >= 200 && code < 300 ? 'success' : 'error',
                        code,
                        message: 'Success',
                        data: data.data || data,
                        meta: data.meta
                    });
                    return {
                        additional: (obj: any) => {
                            // Already sent json, essentially no-op or we could merge but express sent result.
                            // In a real implementation this would delay sending.
                            // For now, simple implementation.
                        }
                    }
                }
            }
        }
    }
}

export default ApiResource;
