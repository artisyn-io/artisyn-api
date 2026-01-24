import { JsonResource, Resource } from ".";

/**
 * ReviewCollection
 *
 * Transforms a collection of Review models into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object for a collection of reviews
     * @returns Collection of reviews formatted for API response
     */
    data(): Resource {
        const reviews = Array.isArray(this.resource.data) ? this.resource.data : this.resource;

        return {
            data: Array.isArray(reviews) ? reviews.map((review: any) => ({
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                status: review.status,
                authorId: review.authorId,
                targetId: review.targetId,
                artisanId: review.artisanId,
                moderatedBy: review.moderatedBy,
                moderatedAt: review.moderatedAt,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                author: review.author ? {
                    id: review.author.id,
                    firstName: review.author.firstName,
                    lastName: review.author.lastName,
                    avatar: review.author.avatar,
                } : undefined,
                target: review.target ? {
                    id: review.target.id,
                    firstName: review.target.firstName,
                    lastName: review.target.lastName,
                    avatar: review.target.avatar,
                } : undefined,
                artisan: review.artisan ? {
                    id: review.artisan.id,
                    name: review.artisan.name,
                    avatar: review.artisan.avatar,
                } : undefined,
                response: review.response ? {
                    id: review.response.id,
                    content: review.response.content,
                    createdAt: review.response.createdAt,
                    updatedAt: review.response.updatedAt,
                } : undefined,
            })) : [],
            pagination: this.resource.pagination,
        };
    }
}
