import { ApiResource, JsonResource, Resource } from ".";
import MediaResource from "./MediaResource";

/**
 * MediaCollection
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data() {
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data

        return {
            data: data.map(
                (e: Resource) => ApiResource(new MediaResource(this.request, this.response, e)).data()
            )
        }
    }
}
