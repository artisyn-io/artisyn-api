import { JsonResource, Resource } from ".";

/**
 * JobCollection
 *
 * Formats paginated Job lists for API responses.
 */
export default class extends JsonResource {
  data(): Resource {
    const jobs = Array.isArray(this.resource.data) ? this.resource.data : this.resource;

    return {
      data: Array.isArray(jobs)
        ? jobs.map((job: any) => ({
            id: job.id,
            listingId: job.listingId,
            applicationId: job.applicationId,
            applicantId: job.applicantId,
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            listing: job.listing
              ? {
                  id: job.listing.id,
                  name: job.listing.name,
                  curatorId: job.listing.curatorId,
                }
              : undefined,
            applicant: job.applicant
              ? {
                  id: job.applicant.id,
                  firstName: job.applicant.firstName,
                  lastName: job.applicant.lastName,
                  email: job.applicant.email,
                  avatar: job.applicant.avatar,
                  phone: job.applicant.phone,
                }
              : undefined,
          }))
        : [],
      pagination: this.resource.pagination,
    };
  }
}
