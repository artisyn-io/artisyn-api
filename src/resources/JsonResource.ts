/**
 * Base JSON Resource
 */
export default class JsonResource {
    [key: string]: any;

    constructor(resource: any) {
        if (resource) {
            Object.assign(this, resource);
            this.resource = resource;
        }
    }

    data() {
        return this.resource;
    }
}
