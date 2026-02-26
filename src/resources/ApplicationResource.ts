import { JsonResource } from ".";

/**
 * ApplicationResource
 *
 * Transforms a single Application model into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns Application data formatted for API response
     */
    data() {
        return {
            id: this.id,
            listingId: this.listingId,
            applicantId: this.applicantId,
            status: this.resource.status,
            message: this.message,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include relations if available
            listing: this.listing ? {
                id: this.listing.id,
                name: this.listing.name,
                description: this.listing.description,
                curatorId: this.listing.curatorId
            } : undefined,
            applicant: this.applicant ? {
                id: this.applicant.id,
                firstName: this.applicant.firstName,
                lastName: this.applicant.lastName,
                email: this.applicant.email,
                avatar: this.applicant.avatar,
                phone: this.applicant.phone
            } : undefined
        };
    }
}
