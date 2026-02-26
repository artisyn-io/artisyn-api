import { JsonResource, Resource } from ".";

/**
 * ApplicationCollection
 *
 * Transforms a collection of Application models into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object for a collection of applications
     * @returns Collection of applications formatted for API response
     */
    data(): Resource {
        const applications = Array.isArray(this.resource.data) ? this.resource.data : this.resource;

        return {
            data: Array.isArray(applications) ? applications.map((application: any) => ({
                id: application.id,
                listingId: application.listingId,
                applicantId: application.applicantId,
                status: application.status,
                message: application.message,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt,
                listing: application.listing ? {
                    id: application.listing.id,
                    name: application.listing.name,
                    description: application.listing.description,
                    curatorId: application.listing.curatorId
                } : undefined,
                applicant: application.applicant ? {
                    id: application.applicant.id,
                    firstName: application.applicant.firstName,
                    lastName: application.applicant.lastName,
                    email: application.applicant.email,
                    avatar: application.applicant.avatar,
                    phone: application.applicant.phone
                } : undefined
            })) : [],
            pagination: this.resource.pagination,
        };
    }
}
