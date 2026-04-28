import { Request, Response, Router } from "express";

import AccountLinkingController from 'src/controllers/AccountLinkingController';
import CategoryController from 'src/controllers/CategoryController';
import DataExportController from 'src/controllers/DataExportController';
import FriendshipController from 'src/controllers/FriendshipController';
import PreferencesController from 'src/controllers/PreferencesController';
import PrivacySettingsController from 'src/controllers/PrivacySettingsController';
import ProfileController from 'src/controllers/ProfileController';
import ReviewController from "src/controllers/ReviewController";
import SearchController from "src/controllers/SearchController";
import { authenticateOptionalToken, authenticateToken } from "src/utils/helpers";
import { accountLinkingRateLimiter, privacyRateLimiter } from "src/middleware/rateLimiter";

const router = Router();
const reviewController = new ReviewController();
const searchController = new SearchController();

router.get("/", (req: Request, res: Response) => {
  res.json({
    data: {
      message: "Welcome to Artisyn API",
      version: "1.0.0",
    },
    status: "success",
    message: "OK",
    code: 200,
  });
});

// Categories routes
router.get('/categories', new CategoryController().index);
router.get('/categories/:id', new CategoryController().show);
router.get("/categories", new CategoryController().index);

// Search routes (Public)
router.get("/search", searchController.index);
router.get("/search/suggestions", searchController.suggestions);


// Artisan search and listing endpoints
router.use("/artisans", (await import("./api/artisans")).default);

// Listing applications management
router.use("/", (await import("./api/applications")).default);

// Get reviews for a specific curator
router.get("/curators/:id/reviews", reviewController.curatorReviews);

// Profile routes
router.get('/profile', authenticateToken, new ProfileController().getProfile);
router.post('/profile', authenticateToken, new ProfileController().updateProfile);
router.get('/profile/completion', authenticateToken, new ProfileController().getProfileCompletion);
router.get('/profile/:userId/public', new ProfileController().getPublicProfile);
router.delete('/profile', authenticateToken, new ProfileController().deleteProfile);

// Preferences routes
router.get('/preferences', authenticateToken, new PreferencesController().getPreferences);
router.post('/preferences', authenticateToken, new PreferencesController().updatePreferences);
router.post('/preferences/notifications', authenticateToken, new PreferencesController().updateNotifications);
router.post('/preferences/two-factor/toggle', authenticateToken, new PreferencesController().toggleTwoFactor);
router.post('/preferences/reset', authenticateToken, new PreferencesController().resetPreferences);

// Privacy Settings routes (writes are limited to 20 per hour per user)
const privacyController = new PrivacySettingsController();
router.get('/privacy', authenticateToken, privacyController.getPrivacySettings);
router.post('/privacy', authenticateToken, privacyRateLimiter, privacyController.updatePrivacySettings);
router.post('/privacy/visibility', authenticateToken, privacyRateLimiter, privacyController.updateProfileVisibility);
router.post('/privacy/block', authenticateToken, privacyRateLimiter, privacyController.blockUser);
router.post('/privacy/unblock', authenticateToken, privacyRateLimiter, privacyController.unblockUser);
router.get('/privacy/blocklist', authenticateToken, privacyController.getBlockList);
router.post('/privacy/retention', authenticateToken, privacyRateLimiter, privacyController.updateDataRetention);
router.post('/privacy/restrict', authenticateToken, privacyRateLimiter, privacyController.addToRestrictedList);
router.post('/privacy/unrestrict', authenticateToken, privacyRateLimiter, privacyController.removeFromRestrictedList);
router.get('/privacy/restricted-list', authenticateToken, privacyController.getRestrictedList);
router.post('/privacy/custom-rules', authenticateToken, privacyRateLimiter, privacyController.updateCustomPrivacyRules);
router.get('/privacy/custom-rules/default', authenticateToken, privacyController.getDefaultCustomRules);

// Friendship management routes
router.get('/friends', authenticateToken, new FriendshipController().getFriends);
router.post('/friends/request', authenticateToken, new FriendshipController().sendFriendRequest);
router.get('/friends/requests/pending', authenticateToken, new FriendshipController().getPendingRequests);
router.get('/friends/requests/sent', authenticateToken, new FriendshipController().getSentRequests);
router.post('/friends/requests/accept', authenticateToken, new FriendshipController().acceptFriendRequest);
router.post('/friends/requests/decline', authenticateToken, new FriendshipController().declineFriendRequest);
router.post('/friends/remove', authenticateToken, new FriendshipController().removeFriend);
router.post('/friends/block', authenticateToken, new FriendshipController().blockUser);
router.post('/friends/unblock', authenticateToken, new FriendshipController().unblockUser);
router.get('/friends/blocked', authenticateToken, new FriendshipController().getBlockedUsers);

// Account Linking routes (writes are limited to 10 per hour per user)
const accountLinkingController = new AccountLinkingController();
router.get('/account-links', authenticateToken, accountLinkingController.getLinkedAccounts);
router.post('/account-links', authenticateToken, accountLinkingRateLimiter, accountLinkingController.linkAccount);
router.post('/account-links/check-availability', authenticateToken, accountLinkingRateLimiter, accountLinkingController.checkAvailability);
router.post('/account-links/verify', authenticateToken, accountLinkingRateLimiter, accountLinkingController.verifyAccountLink);
router.get('/account-links/:provider', authenticateToken, accountLinkingController.checkProviderLinked);
router.delete('/account-links/:provider', authenticateToken, accountLinkingRateLimiter, accountLinkingController.unlinkAccount);

// Data Export routes (GDPR compliance)
router.post('/data-export/request', authenticateToken, new DataExportController().requestDataExport);
router.get('/data-export/requests', authenticateToken, new DataExportController().getExportRequests);
router.get('/data-export/:requestId/status', authenticateToken, new DataExportController().getExportStatus);
router.get('/data-export/:requestId/download', authenticateToken, new DataExportController().downloadExport);
router.post('/data-export/:requestId/cancel', authenticateToken, new DataExportController().cancelExport);
router.post('/account/deletion-request', authenticateToken, new DataExportController().requestAccountDeletion);
router.post('/account/cancel-deletion', authenticateOptionalToken, new DataExportController().cancelAccountDeletion);

export default router; 
