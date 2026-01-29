import { JsonResource } from ".";

/**
 * CuratorResource
 * 
 * Formats a single Curator profile for API responses.
 * Includes user information and curator-specific details.
 */
export default class extends JsonResource {
    /**
     * Transform the resource into an object for the response
     * @returns Formatted curator data
     */
    data() {
        return {
            id: this.id,
            userId: this.userId,
            verificationStatus: this.verificationStatus,
            specialties: this.specialties,
            experience: this.experience,
            portfolio: this.portfolio,
            certificates: this.certificates,
            verifiedAt: this.verifiedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include user information if loaded
            user: this.user ? {
                id: this.user.id,
                email: this.user.email,
                firstName: this.user.firstName,
                lastName: this.user.lastName,
                role: this.user.role,
                avatar: this.user.avatar,
                bio: this.user.bio,
                phone: this.user.phone,
                emailVerifiedAt: this.user.emailVerifiedAt,
            } : undefined,
        };
    }
}
