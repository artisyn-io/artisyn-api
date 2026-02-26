import { $Enums } from "@prisma/client";

// Enums
export enum UserRole {
  USER = 'USER',
  CURATOR = 'CURATOR',
  ADMIN = 'ADMIN'
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export enum ArtisanType {
  PERSON = 'PERSON',
  BUSINESS = 'BUSINESS'
}

export enum TipStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  ACTION_TAKEN = 'ACTION_TAKEN'
}

export enum ReportReason {
  SPAM = 'SPAM',
  INAPPROPRIATE = 'INAPPROPRIATE',
  FAKE = 'FAKE',
  HARASSMENT = 'HARASSMENT',
  OFF_TOPIC = 'OFF_TOPIC',
  OTHER = 'OTHER'
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

// Interfaces
export interface IUser {
  id: string;
  email: string;
  password: string;
  walletAddress: string | null;
  firstName: string;
  lastName: string;
  role: $Enums.UserRole;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  locationId: string | null;
  emailVerifiedAt: Date | string | null;
  emailVerificationCode: string | null;

  // Relations
  curator: ICurator | null;
  media: IMedia[];
  // artisans: IArtisan[]
  // reviews: IReview[]
  // receivedReviews: IReview[]
  // sentTips: ITip[]
  // receivedTips: ITip[]
  // location: ILocation
  // personalAccessTokens: PersonalAccessToken[];
}

export interface ICurator {
  id: string;
  userId: string;
  verificationStatus: $Enums.VerificationStatus
  specialties: string[];
  experience: number;
  portfolio?: string | null;
  certificates: string[];
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubcategory {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPriceRange {
  min: number;
  max: number;
}

export interface IArtisan {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar: string | null;
  type: ArtisanType;
  description: string;
  price?: number;
  priceRange?: IPriceRange;
  images: string[];
  curatorId: string;
  categoryId: string;
  subcategoryId?: string;
  locationId: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplication {
  id: string;
  listingId: string;
  applicantId: string;
  status: ApplicationStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILocation {
  id: string;
  address?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview {
  id: string;
  rating: number;
  comment?: string;
  authorId: string;
  targetId: string;
  artisanId?: string;
  status: ReviewStatus;
  moderatedBy?: string;
  moderatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  response?: IReviewResponse;
  reports?: IReviewReport[];
}

export interface IReviewResponse {
  id: string;
  reviewId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewReport {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewAggregation {
  targetId: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ITip {
  id: string;
  amount: number;
  currency: string;
  message?: string;
  status: TipStatus;
  senderId: string;
  receiverId: string;
  artisanId?: string;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface IMedia {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string | null;
  provider: string;
  userId: string | null;
  tags: string[];
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICuratorVerificationApplication {
  id: string;
  curatorId: string;
  status: VerificationStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  documents?: ICuratorVerificationDocument[];
  history?: ICuratorVerificationHistory[];
}

export interface ICuratorVerificationDocument {
  id: string;
  applicationId: string;
  mediaId: string;
  documentType: string;
  documentName: string;
  createdAt: Date;
  media?: IMedia;
}

export interface ICuratorVerificationHistory {
  id: string;
  curatorId: string;
  applicationId: string | null;
  action: string;
  status: VerificationStatus | null;
  performedBy: string | null;
  notes: string | null;
  metadata: any;
  createdAt: Date;
}
