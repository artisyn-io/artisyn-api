import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IUser } from "src/models/interfaces";
import CuratorController from "src/controllers/CuratorController";
import RegisterController from "src/controllers/auth/RegisterController";
import LoginController from "src/controllers/auth/LoginController";
import app from "../../index";
import { faker } from "@faker-js/faker";
import multer from "multer";
import { prisma } from "src/db";
import request from "supertest";
import { VerificationStatus, UserRole } from "@prisma/client";

describe("Curators Controller", () => {
    let curator1: IUser;
    let curator2: IUser;
    let curator3: IUser;
    let curator1Profile: any;
    let curator2Profile: any;
    let curator3Profile: any;

    const curator1Email = faker.internet.email();
    const curator2Email = faker.internet.email();
    const curator3Email = faker.internet.email();

    beforeAll(async () => {
        const upload = multer();

        // Register routes
        app.post(
            "/test/auth/signup",
            upload.none(),
            new RegisterController().create
        );
        app.post(
            "/test/auth/login",
            upload.none(),
            new LoginController().create
        );

        // Curator routes
        const curatorController = new CuratorController();
        app.get("/test/curators", curatorController.index);
        app.get("/test/curators/:id", curatorController.show);

        // Create first curator user
        const curator1Response = await request(app)
            .post("/test/auth/signup")
            .send({
                email: curator1Email,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        curator1 = curator1Response.body.data;

        // Update curator1 role to CURATOR
        await prisma.user.update({
            where: { id: curator1.id },
            data: { role: UserRole.CURATOR },
        });

        // Create curator1 profile (VERIFIED)
        curator1Profile = await prisma.curator.create({
            data: {
                userId: curator1.id,
                specialties: ["Art", "Crafts"],
                experience: 5,
                verificationStatus: VerificationStatus.VERIFIED,
                portfolio: "https://portfolio1.example.com",
                certificates: ["https://cert1.example.com"],
            },
        });

        // Create second curator user
        const curator2Response = await request(app)
            .post("/test/auth/signup")
            .send({
                email: curator2Email,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        curator2 = curator2Response.body.data;

        // Update curator2 role to CURATOR
        await prisma.user.update({
            where: { id: curator2.id },
            data: { role: UserRole.CURATOR },
        });

        // Create curator2 profile (VERIFIED)
        curator2Profile = await prisma.curator.create({
            data: {
                userId: curator2.id,
                specialties: ["Design", "Photography"],
                experience: 3,
                verificationStatus: VerificationStatus.VERIFIED,
            },
        });

        // Create third curator user
        const curator3Response = await request(app)
            .post("/test/auth/signup")
            .send({
                email: curator3Email,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        curator3 = curator3Response.body.data;

        // Update curator3 role to CURATOR
        await prisma.user.update({
            where: { id: curator3.id },
            data: { role: UserRole.CURATOR },
        });

        // Create curator3 profile (PENDING - should not appear in default listing)
        curator3Profile = await prisma.curator.create({
            data: {
                userId: curator3.id,
                specialties: ["Music"],
                experience: 1,
                verificationStatus: VerificationStatus.PENDING,
            },
        });
    });

    // Clean up after tests
    afterAll(async () => {
        // Delete curator profiles first (foreign key constraints)
        if (curator1?.id) {
            await prisma.curator.deleteMany({ where: { userId: curator1.id } });
        }
        if (curator2?.id) {
            await prisma.curator.deleteMany({ where: { userId: curator2.id } });
        }
        if (curator3?.id) {
            await prisma.curator.deleteMany({ where: { userId: curator3.id } });
        }

        // Delete users
        if (curator1?.id) {
            await prisma.user.delete({ where: { id: curator1.id } });
        }
        if (curator2?.id) {
            await prisma.user.delete({ where: { id: curator2.id } });
        }
        if (curator3?.id) {
            await prisma.user.delete({ where: { id: curator3.id } });
        }
    });

    describe("GET /test/curators", () => {
        it("should return a list of verified curators with pagination", async () => {
            const response = await request(app)
                .get("/test/curators")
                .expect(200);

            expect(response.body).toHaveProperty("status", "success");
            expect(response.body).toHaveProperty("message", "OK");
            expect(response.body).toHaveProperty("code", 200);
            expect(response.body).toHaveProperty("data");
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body).toHaveProperty("meta");
            expect(response.body.meta).toHaveProperty("pagination");
            expect(response.body.meta.pagination).toHaveProperty("total");
            expect(response.body.meta.pagination).toHaveProperty("perPage");
            expect(response.body.meta.pagination).toHaveProperty("from");
            expect(response.body.meta.pagination).toHaveProperty("to");

            // Should only return verified curators by default
            const verifiedCurators = response.body.data.filter(
                (c: any) => c.verificationStatus === "VERIFIED"
            );
            expect(verifiedCurators.length).toBeGreaterThan(0);
        });

        it("should support pagination with page and limit", async () => {
            const response = await request(app)
                .get("/test/curators?page=1&limit=1")
                .expect(200);

            expect(response.body.data.length).toBeLessThanOrEqual(1);
            expect(response.body.meta.pagination.perPage).toBe(1);
        });

        it("should support search by name", async () => {
            const response = await request(app)
                .get(`/test/curators?search=${curator1.firstName}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
            // Should find curator1
            const found = response.body.data.some(
                (c: any) => c.user?.firstName === curator1.firstName
            );
            expect(found).toBe(true);
        });

        it("should support search by specialty", async () => {
            const response = await request(app)
                .get("/test/curators?search=Art")
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
            // Should find curator1 who has "Art" specialty
            const found = response.body.data.some(
                (c: any) => c.specialties?.includes("Art")
            );
            expect(found).toBe(true);
        });

        it("should filter by verification status", async () => {
            const response = await request(app)
                .get("/test/curators?verificationStatus=PENDING")
                .expect(200);

            // Should find pending curators
            const pendingCurators = response.body.data.filter(
                (c: any) => c.verificationStatus === "PENDING"
            );
            expect(pendingCurators.length).toBeGreaterThan(0);
        });

        it("should filter by specialty", async () => {
            const response = await request(app)
                .get("/test/curators?specialty=Design")
                .expect(200);

            // Should find curators with Design specialty
            const found = response.body.data.some(
                (c: any) => c.specialties?.includes("Design")
            );
            expect(found).toBe(true);
        });

        it("should filter by minimum experience", async () => {
            const response = await request(app)
                .get("/test/curators?minExperience=5")
                .expect(200);

            // All returned curators should have experience >= 5
            response.body.data.forEach((c: any) => {
                expect(c.experience).toBeGreaterThanOrEqual(5);
            });
        });

        it("should return all curators when verified=false", async () => {
            const response = await request(app)
                .get("/test/curators?verified=false")
                .expect(200);

            // Should include both verified and unverified
            expect(response.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("GET /test/curators/:id", () => {
        it("should return a single curator by ID", async () => {
            const response = await request(app)
                .get(`/test/curators/${curator1Profile.id}`)
                .expect(200);

            expect(response.body).toHaveProperty("status", "success");
            expect(response.body).toHaveProperty("message", "OK");
            expect(response.body).toHaveProperty("code", 200);
            expect(response.body).toHaveProperty("data");
            expect(response.body.data).toHaveProperty("id", curator1Profile.id);
            expect(response.body.data).toHaveProperty("userId", curator1.id);
            expect(response.body.data).toHaveProperty("verificationStatus");
            expect(response.body.data).toHaveProperty("specialties");
            expect(response.body.data).toHaveProperty("experience");
            expect(response.body.data).toHaveProperty("user");
            expect(response.body.data.user).toHaveProperty("id", curator1.id);
            expect(response.body.data.user).toHaveProperty("email", curator1.email);
            expect(response.body.data.user).toHaveProperty("firstName", curator1.firstName);
            expect(response.body.data.user).toHaveProperty("lastName", curator1.lastName);
        });

        it("should return 404 for non-existent curator", async () => {
            const fakeId = faker.string.uuid();
            const response = await request(app)
                .get(`/test/curators/${fakeId}`)
                .expect(404);

            expect(response.body).toHaveProperty("status", "error");
            expect(response.body).toHaveProperty("message", "Curator not found");
            expect(response.body).toHaveProperty("code", 404);
        });

        it("should include all curator profile fields", async () => {
            const response = await request(app)
                .get(`/test/curators/${curator1Profile.id}`)
                .expect(200);

            const curator = response.body.data;
            expect(curator).toHaveProperty("portfolio");
            expect(curator).toHaveProperty("certificates");
            expect(curator).toHaveProperty("verifiedAt");
            expect(curator).toHaveProperty("createdAt");
            expect(curator).toHaveProperty("updatedAt");
        });
    });
});
