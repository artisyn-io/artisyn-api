import type { InitialRules } from 'simple-body-validator';

import { ValidationError } from './errors';

const supportedSocialPlatforms = [
    'twitter',
    'linkedin',
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'github',
] as const;

export type SocialPlatform = (typeof supportedSocialPlatforms)[number];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

const socialLinkValidationMessage = 'socialLinks must be an object keyed by supported platforms with non-empty string values.';

/**
 * Validation rules for User Profile
 */
export const profileValidationRules: InitialRules = {
    bio: ['string', 'max:500'],
    dateOfBirth: ['date'],
    gender: ['string', 'in:MALE,FEMALE,OTHER,PREFER_NOT_TO_SAY'],
    profilePictureUrl: ['url'],
    coverPhotoUrl: ['url'],
    website: ['url'],
    socialLinks: ['nullable'],
    occupation: ['string', 'max:100'],
    companyName: ['string', 'max:100'],
    location: ['string', 'max:100'],
    timezone: ['string'],
    language: ['string', 'in:en,es,fr,de,it,pt,ja,zh,ar'],
    isPublic: ['boolean'],
    isProfessional: ['boolean'],
};

/**
 * Validation rules for User Preferences
 */
export const preferencesValidationRules: InitialRules = {
    emailNotifications: ['boolean'],
    pushNotifications: ['boolean'],
    smsNotifications: ['boolean'],
    marketingEmails: ['boolean'],
    activityEmails: ['boolean'],
    digestFrequency: ['string', 'in:daily,weekly,monthly,never'],
    theme: ['string', 'in:light,dark,system'],
    language: ['string', 'in:en,es,fr,de,it,pt,ja,zh,ar'],
    currencyPreference: ['string', 'min:3,max:3'],
    twoFactorEnabled: ['boolean'],
    dataCollectionConsent: ['boolean'],
    analyticsTracking: ['boolean'],
};

/**
 * Validation rules for Privacy Settings
 */
export const privacySettingsValidationRules: InitialRules = {
    profileVisibility: ['string', 'in:PUBLIC,PRIVATE,FRIENDS_ONLY,CUSTOM'],
    showEmail: ['boolean'],
    showPhone: ['boolean'],
    showLocation: ['boolean'],
    showOnlineStatus: ['boolean'],
    allowDirectMessages: ['boolean'],
    allowProfileComments: ['boolean'],
    searchEngineIndexing: ['boolean'],
    dataRetentionMonths: ['numeric', 'min:1,max:240'],
};

/**
 * Validation rules for Account Linking
 */
export const accountLinkValidationRules: InitialRules = {
    provider: ['string', 'required', 'in:GOOGLE,FACEBOOK,GITHUB,APPLE,TWITTER,LINKEDIN'],
    providerUserId: ['string', 'required'],
    accessToken: ['string', 'required'],
    refreshToken: ['string'],
    expiresAt: ['date'],
    providerEmail: ['email'],
    providerName: ['string', 'max:255'],
};

/**
 * Validation rules for checking provider account availability
 */
export const checkAvailabilityValidationRules: InitialRules = {
    provider: ['string', 'required', 'in:GOOGLE,FACEBOOK,GITHUB,APPLE,TWITTER,LINKEDIN'],
    providerUserId: ['string', 'required'],
};

/**
 * Validation rules for verifying an account link
 */
export const accountLinkVerifyValidationRules: InitialRules = {
    provider: ['string', 'required', 'in:GOOGLE,FACEBOOK,GITHUB,APPLE,TWITTER,LINKEDIN'],
};

/**
 * Validation rules for Data Export
 */
export const dataExportValidationRules: InitialRules = {
    format: ['string', 'in:json,csv'],
};

export const normalizeSocialLinks = (value: unknown): SocialLinks | undefined => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new ValidationError('Validation failed', {
            socialLinks: [socialLinkValidationMessage],
        });
    }

    const entries = Object.entries(value);
    const normalized: SocialLinks = {};

    for (const [platform, linkValue] of entries) {
        if (!supportedSocialPlatforms.includes(platform as SocialPlatform)) {
            throw new ValidationError('Validation failed', {
                socialLinks: [
                    `${platform} is not a supported social platform. Supported platforms: ${supportedSocialPlatforms.join(', ')}.`,
                ],
            });
        }

        if (typeof linkValue !== 'string') {
            throw new ValidationError('Validation failed', {
                socialLinks: [socialLinkValidationMessage],
            });
        }

        const normalizedValue = linkValue.trim();

        if (!normalizedValue || normalizedValue.length > 255) {
            throw new ValidationError('Validation failed', {
                socialLinks: [socialLinkValidationMessage],
            });
        }

        normalized[platform as SocialPlatform] = normalizedValue;
    }

    return normalized;
};
