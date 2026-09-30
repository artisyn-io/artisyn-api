import { JsonResource } from ".";

/**
 * Transform a SupportTicket model into the API shape.
 * Only exposes the requester summary and messages loaded by the controller.
 */
export const transformSupportTicket = (ticket: any) => ({
    id: ticket.id,
    reference: ticket.reference,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    jobId: ticket.jobId,
    listingId: ticket.listingId,
    requester: ticket.requester
        ? { id: ticket.requester.id, firstName: ticket.requester.firstName, lastName: ticket.requester.lastName }
        : null,
    messages: ticket.messages?.map((message: any) => ({
        id: message.id,
        body: message.body,
        isStaff: message.isStaff,
        author: message.author
            ? { id: message.author.id, firstName: message.author.firstName, lastName: message.author.lastName }
            : null,
        createdAt: message.createdAt,
    })),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
});

/**
 * SupportTicketResource
 */
export default class extends JsonResource {
    data() {
        return transformSupportTicket(this.resource);
    }
}
