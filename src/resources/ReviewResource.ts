import { JsonResource } from ".";

/**
 * ReviewResource
 *
 * Transforms a single Review model into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns Review data formatted for API response
     */
    data() {
        return {
            id: this.id,
            rating: this.rating,
            comment: this.comment,
            // Access status through resource to avoid conflict with status() method
            status: this.resource.status,
            authorId: this.authorId,
            targetId: this.targetId,
            artisanId: this.artisanId,
            moderatedBy: this.moderatedBy,
            moderatedAt: this.moderatedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include relations if available
            author: this.author ? {
                id: this.author.id,
                firstName: this.author.firstName,
                lastName: this.author.lastName,
                avatar: this.author.avatar,
            } : undefined,
            target: this.target ? {
                id: this.target.id,
                firstName: this.target.firstName,
                lastName: this.target.lastName,
                avatar: this.target.avatar,
            } : undefined,
            artisan: this.artisan ? {
                id: this.artisan.id,
                name: this.artisan.name,
                avatar: this.artisan.avatar,
            } : undefined,
            // Access response through resource to avoid conflict with Express Response
            response: this.resource.response ? {
                id: this.resource.response.id,
                content: this.resource.response.content,
                createdAt: this.resource.response.createdAt,
                updatedAt: this.resource.response.updatedAt,
            } : undefined,
        };
    }
}
