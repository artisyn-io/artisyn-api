import { Request, Response } from 'express';

export class Resource {
    protected req: Request;
    protected res: Response;
    protected data: any;

    constructor(req: Request, res: Response, data: any) {
        this.req = req;
        this.res = res;
        this.data = data;
    }

    toArray(): any {
        return this.data;
    }
}

export class ResourceCollection {
    protected req: Request;
    protected res: Response;
    protected collection: any[];
    protected meta: any;

    constructor(req: Request, res: Response, data: { data: any[], pagination?: any }) {
        this.req = req;
        this.res = res;
        this.collection = data.data;
        this.meta = data.pagination;
    }

    toArray(): any {
        return {
            data: this.collection,
            meta: this.meta
        };
    }
}

export default Resource;
