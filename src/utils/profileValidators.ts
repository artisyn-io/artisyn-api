import type { InitialRules } from 'simple-body-validator';

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
};

/**
 * Validation rules for Data Export
 */
export const dataExportValidationRules: InitialRules = {
    format: ['string', 'in:json,csv'],
};
