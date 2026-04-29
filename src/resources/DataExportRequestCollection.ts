import { JsonResource, Resource } from ".";

import DataExportRequestResource from "./DataExportRequestResource";

/**
 * DataExportRequestCollection
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data () {
        const source = Array.isArray(this.resource) ? this.resource : this.resource.data

        return {
            data: source.map(
                (e: Resource) => new DataExportRequestResource(this.request, this.response, e).data()
            ),
            pagination: Array.isArray(this.resource) ? undefined : this.resource.pagination,
        }
    }
}
