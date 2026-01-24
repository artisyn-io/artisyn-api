import { Response } from 'express';

const ApiResource = (resource: any) => {
    let additionalData: any = {};
    let responseCode = 200;

    return {
        json: () => {
            const data = resource.toArray ? resource.toArray() : resource.data();
            return {
                status: (code: number) => {
                    responseCode = code;
                    return {
                        additional: (obj: any) => {
                            additionalData = obj;

                            // Send the complete response
                            resource['res'].status(responseCode).json({
                                status: additionalData.status || (responseCode >= 200 && responseCode < 300 ? 'success' : 'error'),
                                code: additionalData.code || responseCode,
                                message: additionalData.message || 'Success',
                                data: data.data || data,
                                meta: data.meta
                            });
                        }
                    };
                }
            };
        }
    };
};

export default ApiResource;
