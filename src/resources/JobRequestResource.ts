import { JsonResource } from ".";

/**
 * Transform a JobRequest model (with optional relations) into the API shape.
 */
export const transformJobRequest = (jobRequest: any) => ({
    id: jobRequest.id,
    type: "job_request",
    title: jobRequest.title,
    description: jobRequest.description,
    status: jobRequest.status,
    urgency: jobRequest.urgency,
    budget: {
        min: jobRequest.budgetMin,
        max: jobRequest.budgetMax,
        currency: jobRequest.currency,
    },
    location: jobRequest.location,
    categoryId: jobRequest.categoryId,
    category: jobRequest.category
        ? { id: jobRequest.category.id, name: jobRequest.category.name, icon: jobRequest.category.icon }
        : null,
    clientId: jobRequest.clientId,
    client: jobRequest.client
        ? {
            id: jobRequest.client.id,
            firstName: jobRequest.client.firstName,
            lastName: jobRequest.client.lastName,
            avatar: jobRequest.client.avatar,
        }
        : undefined,
    proposalCount: jobRequest._count?.proposals,
    myProposal: jobRequest.proposals?.[0]
        ? { id: jobRequest.proposals[0].id, status: jobRequest.proposals[0].status }
        : null,
    engagementId: jobRequest.engagement?.id ?? null,
    publishedAt: jobRequest.publishedAt,
    closedAt: jobRequest.closedAt,
    createdAt: jobRequest.createdAt,
    updatedAt: jobRequest.updatedAt,
});

/**
 * JobRequestResource
 */
export default class extends JsonResource {
    data() {
        return transformJobRequest(this.resource);
    }
}
