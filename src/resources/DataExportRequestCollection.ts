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
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data

        return {
            data: data.map(
                (e: Resource) => new DataExportRequestResource(this.request, this.response, e).data()
            )
        }
    }
}
