import { TipStatus, UserRole, VerificationStatus, ReviewStatus, ReportStatus, ReportReason, ApplicationStatus, JobStatus } from './interfaces';
import { body, param, query } from 'express-validator';
import { JobRequestStatus, JobRequestUrgency, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';

const toUpper = (value: unknown) => typeof value === 'string' ? value.toUpperCase() : value;

// User validation
export const userValidation = {
  create: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('walletAddress').optional().isString().withMessage('Wallet address must be a string'),
    body('bio').optional().isString().withMessage('Bio must be a string'),
    body('phone').optional().isString().withMessage('Phone must be a string'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid user ID is required'),
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('walletAddress').optional().isString().withMessage('Wallet address must be a string'),
    body('bio').optional().isString().withMessage('Bio must be a string'),
    body('phone').optional().isString().withMessage('Phone must be a string'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid user ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid user ID is required'),
  ],
};

// Curator validation
export const curatorValidation = {
  create: [
    body('specialties').isArray().withMessage('Specialties must be an array'),
    body('specialties.*').isString().withMessage('Each specialty must be a string'),
    body('experience').isInt({ min: 0 }).withMessage('Experience must be a positive integer'),
    body('portfolio').optional().isURL().withMessage('Portfolio must be a valid URL'),
    body('certificates').optional().isArray().withMessage('Certificates must be an array'),
    body('certificates.*').optional().isURL().withMessage('Each certificate must be a valid URL'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid curator ID is required'),
    body('specialties').optional().isArray().withMessage('Specialties must be an array'),
    body('specialties.*').optional().isString().withMessage('Each specialty must be a string'),
    body('experience').optional().isInt({ min: 0 }).withMessage('Experience must be a positive integer'),
    body('portfolio').optional().isURL().withMessage('Portfolio must be a valid URL'),
    body('certificates').optional().isArray().withMessage('Certificates must be an array'),
    body('certificates.*').optional().isURL().withMessage('Each certificate must be a valid URL'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('verificationStatus').optional().isIn(Object.values(VerificationStatus)).withMessage('Invalid verification status'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid curator ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid curator ID is required'),
  ],
};

// Category validation
export const categoryValidation = {
  create: [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('icon').optional().isURL().withMessage('Icon must be a valid URL'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid category ID is required'),
    body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('icon').optional().isURL().withMessage('Icon must be a valid URL'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid category ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid category ID is required'),
  ],
};

// Subcategory validation
export const subcategoryValidation = {
  create: [
    body('name').notEmpty().withMessage('Subcategory name is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('categoryId').isUUID().withMessage('Valid category ID is required'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid subcategory ID is required'),
    body('name').optional().notEmpty().withMessage('Subcategory name cannot be empty'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid subcategory ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid subcategory ID is required'),
  ],
};

// Artisan (Listing) validation
export const artisanValidation = {
  create: [
    // Required fields
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('phone').isString().notEmpty().withMessage('Phone number is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('categoryId').isUUID().withMessage('Valid category ID is required'),
    body('locationId').isUUID().withMessage('Valid location ID is required'),
    body('images').isArray({ min: 1 }).withMessage('Images must be an array with at least one image'),
    body('images.*').isURL().withMessage('Each image must be a valid URL'),

    // Optional fields
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('priceRange').optional().isObject().withMessage('Price range must be an object'),
    body('priceRange.min').optional().isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
    body('priceRange.max').optional().isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
    body('subcategoryId').optional().isUUID().withMessage('Valid subcategory ID is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid listing ID is required'),
    body('name').optional().isString().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().isString().notEmpty().withMessage('Phone number cannot be empty'),
    body('description').optional().isString().notEmpty().withMessage('Description cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
    body('locationId').optional().isUUID().withMessage('Valid location ID is required'),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('images.*').optional().isURL().withMessage('Each image must be a valid URL'),
    body('subcategoryId').optional().isUUID().withMessage('Valid subcategory ID is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
    query('subcategoryId').optional().isUUID().withMessage('Valid subcategory ID is required'),
    query('curatorId').optional().isUUID().withMessage('Valid curator ID is required'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid listing ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid listing ID is required'),
  ],
};

// Location validation
export const locationValidation = {
  create: [
    body('address').optional().isString().withMessage('Address must be a string'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('postalCode').optional().isString().withMessage('Postal code must be a string'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid location ID is required'),
    body('address').optional().isString().withMessage('Address must be a string'),
    body('city').optional().notEmpty().withMessage('City cannot be empty'),
    body('state').optional().notEmpty().withMessage('State cannot be empty'),
    body('country').optional().notEmpty().withMessage('Country cannot be empty'),
    body('postalCode').optional().isString().withMessage('Postal code must be a string'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid location ID is required'),
  ],
};

// Review validation
export const reviewValidation = {
  create: [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString().isLength({ max: 1000 }).withMessage('Comment must be a string with max 1000 characters'),
    body('targetId').isUUID().withMessage('Valid target user ID is required'),
    body('artisanId').optional().isUUID().withMessage('Valid artisan ID is required'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid review ID is required'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString().isLength({ max: 1000 }).withMessage('Comment must be a string with max 1000 characters'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('authorId').optional().isUUID().withMessage('Valid author ID is required'),
    query('targetId').optional().isUUID().withMessage('Valid target ID is required'),
    query('artisanId').optional().isUUID().withMessage('Valid artisan ID is required'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    query('status').optional().isIn(Object.values(ReviewStatus)).withMessage('Invalid review status'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid review ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid review ID is required'),
  ],
  // Moderation (admin only)
  moderate: [
    param('id').isUUID().withMessage('Valid review ID is required'),
    body('status').isIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED]).withMessage('Status must be APPROVED or REJECTED'),
  ],
  // Curator response
  respond: [
    param('id').isUUID().withMessage('Valid review ID is required'),
    body('content').isString().isLength({ min: 1, max: 500 }).withMessage('Response must be between 1 and 500 characters'),
  ],
  updateResponse: [
    param('id').isUUID().withMessage('Valid review ID is required'),
    body('content').isString().isLength({ min: 1, max: 500 }).withMessage('Response must be between 1 and 500 characters'),
  ],
  // Report abuse
  report: [
    param('id').isUUID().withMessage('Valid review ID is required'),
    body('reason').isIn(Object.values(ReportReason)).withMessage('Invalid report reason'),
    body('details').optional().isString().isLength({ max: 500 }).withMessage('Details must be max 500 characters'),
  ],
  // Resolve report (admin only)
  resolveReport: [
    param('id').isUUID().withMessage('Valid report ID is required'),
    body('status').isIn([ReportStatus.DISMISSED, ReportStatus.ACTION_TAKEN]).withMessage('Status must be DISMISSED or ACTION_TAKEN'),
    body('resolution').optional().isString().isLength({ max: 500 }).withMessage('Resolution must be max 500 characters'),
  ],
  // Aggregation
  aggregation: [
    param('targetId').isUUID().withMessage('Valid target user ID is required'),
  ],
};

// Tip validation
export const tipValidation = {
  create: [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('message').optional().isString().withMessage('Message must be a string'),
    body('receiverId').isUUID().withMessage('Valid receiver ID is required'),
    body('artisanId').optional().isUUID().withMessage('Valid artisan ID is required'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid tip ID is required'),
    body('status').isIn(Object.values(TipStatus)).withMessage('Invalid tip status'),
    body('txHash').optional().isString().withMessage('Transaction hash must be a string'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('senderId').optional().isUUID().withMessage('Valid sender ID is required'),
    query('receiverId').optional().isUUID().withMessage('Valid receiver ID is required'),
    query('artisanId').optional().isUUID().withMessage('Valid artisan ID is required'),
    query('status').optional().isIn(Object.values(TipStatus)).withMessage('Invalid tip status'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid tip ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid tip ID is required'),
  ],
};

// Application validation (merged for listings and generic application routes)
export const applicationValidation = {
  list: [
    query('scope').optional().isIn(['mine', 'received', 'all']).withMessage('Scope must be one of: mine, received, all'),
    query('status').optional().customSanitizer(toUpper).isIn(Object.values(ApplicationStatus)).withMessage('Invalid application status'),
    query('listingId').optional().isUUID().withMessage('Valid listing ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  listByListing: [
    param('listingId').isUUID().withMessage('Valid listing ID is required'),
    query('status').optional().customSanitizer(toUpper).isIn(Object.values(ApplicationStatus)).withMessage('Invalid application status')
  ],
  updateStatus: [
    param('id').isUUID().withMessage('Valid application ID is required'),
    body('status').customSanitizer(toUpper).isIn(Object.values(ApplicationStatus)).withMessage('Invalid application status')
  ],
  create: [
    body('listingId').isUUID().withMessage('Valid listing ID is required'),
    body('message').optional().isString().isLength({ max: 1000 }).withMessage('Message must be a string with max 1000 characters'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('status').optional().isIn(Object.values(ApplicationStatus)).withMessage('Invalid status'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid application ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid application ID is required'),
  ],
};

export const jobValidation = {
  list: [
    query('status').optional().isIn(Object.values(JobStatus)).withMessage('Invalid job status filter'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid job ID is required'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid job ID is required'),
    body('status').isIn(Object.values(JobStatus)).withMessage('Valid job status is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid job ID is required'),
  ],
};

// Authentication validation
export const authValidation = {
  login: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  register: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('walletAddress').optional().isString().withMessage('Wallet address must be a string'),
  ],
  forgotPassword: [
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  resetPassword: [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
};

// Search validation
export const searchValidation = {
  search: [
    query('q').optional().isString().withMessage('Search query must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
    query('subcategoryId').optional().isUUID().withMessage('Valid subcategory ID is required'),
    query('city').optional().isString().withMessage('City must be a string'),
    query('state').optional().isString().withMessage('State must be a string'),
    query('country').optional().isString().withMessage('Country must be a string'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
    query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    query('radius').optional().isFloat({ min: 0 }).withMessage('Radius must be a positive number'),
  ],
  suggestions: [
    query('q').isString().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  ],
};

// Media validation
export const mediaValidation = {
  upload: [
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid media ID is required'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
  ],
  getAll: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('Per page must be between 1 and 100'),
    query('userId').optional().isUUID().withMessage('Valid user ID is required'),
    query('tags').optional().isString().withMessage('Tags must be a string'),
  ],
  getOne: [
    param('id').isUUID().withMessage('Valid media ID is required'),
  ],
  delete: [
    param('id').isUUID().withMessage('Valid media ID is required'),
  ],
};

const strongPassword = (field: string) =>
  body(field)
    .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
    .withMessage('Password must be at least 8 characters and include upper, lower case letters and a number');

// Account security validation
export const accountSecurityValidation = {
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    strongPassword('password'),
    body('password').custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage('New password must be different from the current password'),
    body('passwordConfirmation').custom((value, { req }) => value === req.body.password)
      .withMessage('Password confirmation does not match'),
  ],
  confirmTwoFactor: [
    body('code').matches(/^\d{6}$/).withMessage('A 6-digit authentication code is required'),
  ],
  disableTwoFactor: [
    body('password').notEmpty().withMessage('Password is required'),
    body('otp').optional().matches(/^\d{6}$/).withMessage('Authentication code must be 6 digits'),
    body('recoveryCode').optional().isString(),
    body().custom((value) => !!(value?.otp || value?.recoveryCode))
      .withMessage('An authentication code or recovery code is required'),
  ],
  revokeSession: [
    param('id').isUUID().withMessage('Valid session ID is required'),
  ],
};

// Job request validation
const jobRequestFields = (optional: boolean) => {
  const field = (name: string) => optional ? body(name).optional() : body(name);
  return [
    field('title').isString().trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3-150 characters'),
    field('description').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
    body('categoryId').optional({ values: 'null' }).isUUID().withMessage('Valid category ID is required'),
    body('budgetMin').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat().withMessage('Minimum budget must be a positive number'),
    body('budgetMax').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat().withMessage('Maximum budget must be a positive number')
      .custom((value, { req }) => req.body.budgetMin == null || value >= Number(req.body.budgetMin))
      .withMessage('Maximum budget must be greater than or equal to minimum budget'),
    body('currency').optional().isISO4217().withMessage('Currency must be a valid ISO 4217 code'),
    body('location').optional({ values: 'null' }).isString().isLength({ max: 255 }).withMessage('Location must be at most 255 characters'),
    body('urgency').optional().customSanitizer(toUpper).isIn(Object.values(JobRequestUrgency)).withMessage('Invalid urgency'),
    body('status').optional().customSanitizer(toUpper).isIn([JobRequestStatus.DRAFT, JobRequestStatus.OPEN, JobRequestStatus.CLOSED])
      .withMessage('Status must be one of: DRAFT, OPEN, CLOSED'),
  ];
};

export const jobRequestValidation = {
  create: jobRequestFields(false),
  update: [param('id').isUUID().withMessage('Valid job request ID is required'), ...jobRequestFields(true)],
  getOne: [param('id').isUUID().withMessage('Valid job request ID is required')],
  list: [
    query('status').optional().customSanitizer(toUpper).isIn(Object.values(JobRequestStatus)).withMessage('Invalid status'),
    query('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
    query('location').optional().isString(),
    query('urgency').optional().customSanitizer(toUpper).isIn(Object.values(JobRequestUrgency)).withMessage('Invalid urgency'),
    query('minBudget').optional().isFloat({ min: 0 }).withMessage('Minimum budget must be a positive number'),
    query('maxBudget').optional().isFloat({ min: 0 }).withMessage('Maximum budget must be a positive number'),
    query('sort').optional().isIn(['newest', 'oldest', 'budget_high', 'budget_low']).withMessage('Invalid sort'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  createProposal: [
    param('id').isUUID().withMessage('Valid job request ID is required'),
    body('message').isString().trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be 10-2000 characters'),
    body('proposedAmount').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat().withMessage('Proposed amount must be a positive number'),
    body('estimatedDuration').optional({ values: 'null' }).isString().isLength({ max: 100 }),
  ],
  proposal: [
    param('id').isUUID().withMessage('Valid job request ID is required'),
    param('proposalId').isUUID().withMessage('Valid proposal ID is required'),
  ],
};

// Support ticket validation
const supportTicketFields = [
  body('subject').isString().trim().isLength({ min: 3, max: 150 }).withMessage('Subject must be 3-150 characters'),
  body('message').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Message must be 10-5000 characters'),
  body('category').optional().customSanitizer(toUpper).isIn(Object.values(SupportTicketCategory)).withMessage('Invalid category'),
];

export const supportValidation = {
  contact: [
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    ...supportTicketFields,
    // Honeypot: must be left empty by humans
    body('website').optional().isEmpty().withMessage('Invalid submission'),
  ],
  create: [
    ...supportTicketFields,
    body('jobId').optional().isUUID().withMessage('Valid job ID is required'),
    body('listingId').optional().isUUID().withMessage('Valid listing ID is required'),
  ],
  list: [
    query('status').optional().customSanitizer(toUpper).isIn(Object.values(SupportTicketStatus)).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  getOne: [param('id').isUUID().withMessage('Valid ticket ID is required')],
  reply: [
    param('id').isUUID().withMessage('Valid ticket ID is required'),
    body('message').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
  ],
  triage: [
    param('id').isUUID().withMessage('Valid ticket ID is required'),
    body('status').optional().customSanitizer(toUpper).isIn(Object.values(SupportTicketStatus)).withMessage('Invalid status'),
    body('priority').optional().customSanitizer(toUpper).isIn(Object.values(SupportTicketPriority)).withMessage('Invalid priority'),
  ],
};

// Saved artisan validation
export const savedArtisanValidation = {
  save: [
    param('artisanId').isUUID().withMessage('Valid artisan ID is required'),
  ],
  remove: [
    param('artisanId').isUUID().withMessage('Valid artisan ID is required'),
  ],
  getOne: [
    param('artisanId').isUUID().withMessage('Valid artisan ID is required'),
  ],
  list: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('categoryId').optional().isUUID().withMessage('Valid category ID is required'),
    query('search').optional().isString().withMessage('Search query must be a string'),
  ],
  ids: [
    query('ids').optional().isString().withMessage('IDs filter must be a string'),
    query('artisanIds').optional().isString().withMessage('artisanIds filter must be a string'),
  ],
};

