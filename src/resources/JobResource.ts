import { JsonResource } from ".";

/**
 * JobResource
 *
 * Transforms a single Job model into the standardized API response format.
 */
export default class extends JsonResource {
  data() {
    return {
      id: this.id,
      listingId: this.listingId,
      applicationId: this.applicationId,
      applicantId: this.applicantId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      listing: this.listing
        ? {
            id: this.listing.id,
            name: this.listing.name,
            curatorId: this.listing.curatorId,
          }
        : undefined,
      applicant: this.applicant
        ? {
            id: this.applicant.id,
            firstName: this.applicant.firstName,
            lastName: this.applicant.lastName,
            email: this.applicant.email,
            avatar: this.applicant.avatar,
            phone: this.applicant.phone,
          }
        : undefined,
    };
  }
}
