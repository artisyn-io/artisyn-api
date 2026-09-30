import { JsonResource, Resource } from ".";
import { transformJobRequest } from "./JobRequestResource";

/**
 * JobRequestCollection
 */
export default class extends JsonResource {
    data(): Resource {
        const items = Array.isArray(this.resource.data) ? this.resource.data : [];

        return {
            data: items.map(transformJobRequest),
            pagination: this.resource.pagination,
        };
    }
}
