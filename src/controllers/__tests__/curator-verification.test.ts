import { UserRole, VerificationStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../../index";
import fs from "fs";
import { generateAccessToken } from "src/utils/helpers";
import path from "path";
import { prisma } from "src/db";
import request from "supertest";

vi.mock("src/utils/StorageService", () => ({
    default: {
        upload: vi.fn().mockImplementation(() => {
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            return Promise.resolve({
                url: `https://example.com/test-file-${uniqueId}.pdf`,
                path: `verification-documents/test-file-${uniqueId}.pdf`,
                provider: "local",
                metadata: {}
            });
        }),
        delete: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock("src/mailer/mailer", () => ({
    sendMail: vi.fn().mockResolvedValue(undefined)
}));

describe("Curator Verification System", () => {
    let curatorToken: string;
    let adminToken: string;
    let curatorId: string;
    let adminId: string;
    let curatorUserId: string;
    let applicationId: string;
    let testPdfPath: string;
    let testImagePath: string;

    beforeAll(async () => {
        // Cleanup stale data
        await prisma.curatorVerificationHistory.deleteMany({});
        await prisma.curatorVerificationDocument.deleteMany({});
        await prisma.curatorVerificationApplication.deleteMany({});
        await prisma.personalAccessToken.deleteMany({});
        await prisma.curator.deleteMany({});
        await prisma.media.deleteMany({
            where: {
                tags: { has: 'curator_verification' }
            }
        });
        await prisma.user.deleteMany({
            where: {
                email: { in: ['curator-verification-test@test.com', 'admin-verification-test@test.com', 'curator-reject-test@test.com'] }
            }
        });

        // Create curator user
        const curatorUser = await prisma.user.create({
            data: {
                email: 'curator-verification-test@test.com',
                password: 'hash',
                firstName: 'Test',
                lastName: 'Curator',
                role: UserRole.CURATOR
            }
        });
        curatorUserId = curatorUser.id;

        // Create curator profile
        const curator = await prisma.curator.create({
            data: {
                userId: curatorUser.id,
                specialties: ["Art", "Crafts"],
                experience: 5,
            },
        });
        curatorId = curator.id;

        // Create admin user
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin-verification-test@test.com',
                password: 'hash',
                firstName: 'Test',
                lastName: 'Admin',
                role: UserRole.ADMIN
            }
        });
        adminId = adminUser.id;

        // Generate tokens
        const curatorAuth = generateAccessToken({
            username: curatorUser.email,
            id: curatorUser.id,
            index: 1
        });
        curatorToken = curatorAuth.token;
        await prisma.personalAccessToken.create({
            data: {
                token: curatorAuth.token,
                name: 'Test Curator Token',
                userId: curatorUser.id,
                expiresAt: new Date(curatorAuth.jwt.exp! * 1000)
            }
        });

        const adminAuth = generateAccessToken({
            username: adminUser.email,
            id: adminUser.id,
            index: 2
        });
        adminToken = adminAuth.token;
        await prisma.personalAccessToken.create({
            data: {
                token: adminAuth.token,
                name: 'Test Admin Token',
                userId: adminUser.id,
                expiresAt: new Date(adminAuth.jwt.exp! * 1000)
            }
        });

        // Create test files
        testPdfPath = path.join(process.cwd(), "test-document.pdf");
        testImagePath = path.join(process.cwd(), "test-image.jpg");

        fs.writeFileSync(testPdfPath, Buffer.from("PDF test content"));
        fs.writeFileSync(testImagePath, Buffer.from("JPEG test content"));
    });

    afterAll(async () => {
        await prisma.curatorVerificationHistory.deleteMany({});
        await prisma.curatorVerificationDocument.deleteMany({});
        await prisma.curatorVerificationApplication.deleteMany({});
        await prisma.personalAccessToken.deleteMany({});
        await prisma.curator.deleteMany({});
        await prisma.media.deleteMany({
            where: {
                tags: { has: 'curator_verification' }
            }
        });
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [
                        'curator-verification-test@test.com',
                        'admin-verification-test@test.com',
                        'curator-reject-test@test.com'
                    ]
                }
            }
        });

        if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);
        if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    });

    describe("Curator - Submit Verification Application", () => {
        it("should successfully submit verification application with documents", async () => {
            const documents = [
                {
                    document_type: "government_id",
                    document_name: "National ID Card"
                },
                {
                    document_type: "professional_certificate",
                    document_name: "Art Certification"
                }
            ];

            const response = await request(app)
                .post("/api/curator/verification/submit")
                .set("Authorization", `Bearer ${curatorToken}`)
                .field("documents", JSON.stringify(documents))
                .attach("documents", testPdfPath)
                .attach("documents", testImagePath);

            expect(response.status).toBe(201);
            expect(response.body.status).toBe("success");
            expect(response.body.data).toHaveProperty("id");
            expect(response.body.data.status).toBe(VerificationStatus.PENDING);
            expect(response.body.data.documents).toHaveLength(2);

            applicationId = response.body.data.id;
        });

        it("should fail to submit application without documents", async () => {
            const response = await request(app)
                .post("/api/curator/verification/submit")
                .set("Authorization", `Bearer ${curatorToken}`)
                .field("documents", JSON.stringify([]));

            expect(response.status).toBe(400);
        });

        it("should fail to submit application if one already pending", async () => {
            const documents = [
                {
                    document_type: "government_id",
                    document_name: "Passport"
                }
            ];

            const response = await request(app)
                .post("/api/curator/verification/submit")
                .set("Authorization", `Bearer ${curatorToken}`)
                .field("documents", JSON.stringify(documents))
                .attach("documents", testPdfPath);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain("pending");
        });

        it("should get verification status", async () => {
            const response = await request(app)
                .get("/api/curator/verification/status")
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty("applications");
            expect(response.body.data).toHaveProperty("history");
            expect(response.body.data.applications).toHaveLength(1);
            expect(response.body.data.applications[0].status).toBe(VerificationStatus.PENDING);
        });
    });

    describe("Admin - Review Applications", () => {
        it("should list all pending applications", async () => {
            const response = await request(app)
                .get("/api/admin/curator-verifications")
                .set("Authorization", `Bearer ${adminToken}`)
                .query({ page: 1, limit: 15 });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.meta?.pagination).toBeDefined();
        });

        it("should get single application with all details", async () => {
            const response = await request(app)
                .get(`/api/admin/curator-verifications/${applicationId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty("id", applicationId);
            expect(response.body.data).toHaveProperty("curator");
            expect(response.body.data).toHaveProperty("documents");
            expect(response.body.data).toHaveProperty("history");
            expect(response.body.data.documents).toHaveLength(2);
        });

        it("should approve application", async () => {
            const response = await request(app)
                .put(`/api/admin/curator-verifications/${applicationId}/approve`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    notes: "All documents verified successfully"
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.status).toBe(VerificationStatus.VERIFIED);
            expect(response.body.data.reviewedBy).toBe(adminId);

            const curatorProfile = await prisma.curator.findFirst({
                where: { userId: curatorUserId }
            });
            expect(curatorProfile?.verificationStatus).toBe(VerificationStatus.VERIFIED);
            expect(curatorProfile?.verifiedAt).not.toBeNull();
        });

        it("should fail to review already reviewed application", async () => {
            const response = await request(app)
                .put(`/api/admin/curator-verifications/${applicationId}/approve`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    notes: "Trying to approve again"
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain("already been reviewed");
        });
    });

    describe("Admin - Reject Application", () => {
        let rejectionApplicationId: string;
        let newCuratorToken: string;
        let newCuratorUserId: string;

        beforeAll(async () => {
            // Create new curator user for rejection test
            const newCuratorUser = await prisma.user.create({
                data: {
                    email: 'curator-reject-test@test.com',
                    password: 'hash',
                    firstName: 'Reject',
                    lastName: 'Test',
                    role: UserRole.CURATOR
                }
            });
            newCuratorUserId = newCuratorUser.id;

            // Create curator profile
            await prisma.curator.create({
                data: {
                    userId: newCuratorUser.id,
                    specialties: ["Photography"],
                    experience: 3,
                },
            });

            // Generate token
            const curatorAuth = generateAccessToken({
                username: newCuratorUser.email,
                id: newCuratorUser.id,
                index: 3
            });
            newCuratorToken = curatorAuth.token;
            await prisma.personalAccessToken.create({
                data: {
                    token: curatorAuth.token,
                    name: 'Test New Curator Token',
                    userId: newCuratorUser.id,
                    expiresAt: new Date(curatorAuth.jwt.exp! * 1000)
                }
            });

            const documents = [
                {
                    document_type: "government_id",
                    document_name: "Driver License"
                }
            ];

            const submitResponse = await request(app)
                .post("/api/curator/verification/submit")
                .set("Authorization", `Bearer ${newCuratorToken}`)
                .field("documents", JSON.stringify(documents))
                .attach("documents", testPdfPath);

            rejectionApplicationId = submitResponse.body.data.id;
        });

        it("should reject application with reason", async () => {
            const rejectionReason = "Documents are not clear. Please resubmit with better quality images.";

            const response = await request(app)
                .put(`/api/admin/curator-verifications/${rejectionApplicationId}/reject`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    reason: rejectionReason
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.status).toBe(VerificationStatus.REJECTED);
            expect(response.body.data.rejectionReason).toBe(rejectionReason);
        });

        it("should fail to reject without reason", async () => {
            const response = await request(app)
                .put(`/api/admin/curator-verifications/${rejectionApplicationId}/reject`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(422);
        });
    });

    describe("Verification History", () => {
        it("should track all verification actions", async () => {
            const history = await prisma.curatorVerificationHistory.findMany({
                where: {
                    applicationId: applicationId
                },
                orderBy: { createdAt: 'asc' }
            });

            expect(history.length).toBeGreaterThanOrEqual(2);

            const submittedAction = history.find(h => h.action === 'SUBMITTED');
            expect(submittedAction).toBeDefined();
            expect(submittedAction?.status).toBe(VerificationStatus.PENDING);

            const approvedAction = history.find(h => h.action === 'APPROVED');
            expect(approvedAction).toBeDefined();
            expect(approvedAction?.status).toBe(VerificationStatus.VERIFIED);
            expect(approvedAction?.performedBy).toBe(adminId);
        });
    });
});
