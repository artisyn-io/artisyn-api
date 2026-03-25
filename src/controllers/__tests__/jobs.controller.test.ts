import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IUser } from "src/models/interfaces";
import app from "../../index";
import { faker } from "@faker-js/faker";
import { prisma } from "src/db";
import request from "supertest";
import { JobStatus, UserRole } from "@prisma/client";

describe("Jobs Controller", () => {
    let admin: IUser;
    let curator: IUser;
    let client: IUser;
    let adminToken: string;
    let curatorToken: string;
    let clientToken: string;
    let listingId: string;
    let applicationId: string;
    let jobId: string;

    const adminEmail = faker.internet.email();
    const curatorEmail = faker.internet.email();
    const clientEmail = faker.internet.email();

    beforeAll(async () => {
        // Create admin user
        const adminResponse = await request(app)
            .post("/api/auth/signup")
            .send({
                email: adminEmail,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        admin = adminResponse.body.data;
        adminToken = adminResponse.body.token;

        // Upgrade to admin
        await prisma.user.update({
            where: { id: admin.id },
            data: { role: UserRole.ADMIN }
        });

        // Create curator user
        const curatorResponse = await request(app)
            .post("/api/auth/signup")
            .send({
                email: curatorEmail,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        curator = curatorResponse.body.data;
        curatorToken = curatorResponse.body.token;

        // Create client user
        const clientResponse = await request(app)
            .post("/api/auth/signup")
            .send({
                email: clientEmail,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
                password_confirmation: "Password123#",
            });

        client = clientResponse.body.data;
        clientToken = clientResponse.body.token;

        // Create a listing (artisan) for the curator
        const category = await prisma.category.create({
            data: {
                name: `Test Category ${faker.string.uuid()}`,
                description: faker.lorem.sentence(),
            }
        });

        const location = await prisma.location.create({
            data: {
                city: faker.location.city(),
                state: faker.location.state(),
                country: faker.location.country(),
                latitude: parseFloat(faker.location.latitude()),
                longitude: parseFloat(faker.location.longitude()),
            }
        });

        const listingResponse = await request(app)
            .post("/api/artisans")
            .set("Authorization", `Bearer ${curatorToken}`)
            .send({
                name: `Test Listing ${faker.string.uuid()}`,
                phone: faker.phone.number(),
                description: faker.lorem.paragraph(),
                categoryId: category.id,
                locationId: location.id,
                images: [faker.image.url()],
            });

        listingId = listingResponse.body.data.id;

        // Create an application from the client
        const applicationResponse = await request(app)
            .post("/api/applications")
            .set("Authorization", `Bearer ${clientToken}`)
            .send({
                listingId: listingId,
                message: faker.lorem.sentence(),
            });

        applicationId = applicationResponse.body.data.id;

        // Accept the application to create a job
        const acceptResponse = await request(app)
            .put(`/api/applications/${applicationId}/status`)
            .set("Authorization", `Bearer ${curatorToken}`)
            .send({
                status: "ACCEPTED"
            });

        // Store the job ID from the response
        jobId = acceptResponse.body.job?.id;
    });

    // Clean up after tests
    afterAll(async () => {
        // Delete jobs first (foreign key constraint)
        await prisma.job.deleteMany({
            where: {
                OR: [
                    { clientId: client?.id },
                    { curatorId: curator?.id },
                ],
            },
        });

        // Delete applications
        await prisma.application.deleteMany({
            where: {
                OR: [
                    { applicantId: client?.id },
                    { listing: { curatorId: curator?.id } },
                ],
            },
        });

        // Delete listings
        await prisma.artisan.deleteMany({
            where: { curatorId: curator?.id }
        });

        // Delete users
        if (client?.id) {
            await prisma.user.delete({ where: { id: client.id } });
        }
        if (curator?.id) {
            await prisma.user.delete({ where: { id: curator.id } });
        }
        if (admin?.id) {
            await prisma.user.delete({ where: { id: admin.id } });
        }

        // Clean up categories and locations
        await prisma.category.deleteMany({
            where: { name: { startsWith: "Test Category" } }
        });
    });

    describe("GET /api/jobs", () => {
        it("should list jobs for client", async () => {
            const response = await request(app)
                .get("/api/jobs")
                .set("Authorization", `Bearer ${clientToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it("should list jobs for curator", async () => {
            const response = await request(app)
                .get("/api/jobs")
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it("should list all jobs for admin", async () => {
            const response = await request(app)
                .get("/api/jobs")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it("should filter jobs by status", async () => {
            const response = await request(app)
                .get("/api/jobs?status=active")
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            // Note: May have no results if job status changed
        });

        it("should return 401 without authentication", async () => {
            const response = await request(app)
                .get("/api/jobs");

            expect(response.statusCode).toBe(401);
        });

        it("should support pagination", async () => {
            const response = await request(app)
                .get("/api/jobs?page=1&limit=10")
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.meta).toBeDefined();
            expect(response.body.meta.pagination).toBeDefined();
        });
    });

    describe("GET /api/jobs/:id", () => {
        it("should return job for client", async () => {
            const response = await request(app)
                .get(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${clientToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.id).toBe(jobId);
            expect(response.body.data.applicationId).toBe(applicationId);
            expect(response.body.data.listingId).toBe(listingId);
            expect(response.body.data.clientId).toBe(client.id);
            expect(response.body.data.curatorId).toBe(curator.id);
            expect(response.body.data.status).toBe("active");
        });

        it("should return job for curator", async () => {
            const response = await request(app)
                .get(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.id).toBe(jobId);
        });

        it("should return job for admin", async () => {
            const response = await request(app)
                .get(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.id).toBe(jobId);
        });

        it("should return 404 for non-existent job", async () => {
            const response = await request(app)
                .get("/api/jobs/non-existent-id")
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(404);
        });

        it("should return 401 without authentication", async () => {
            const response = await request(app)
                .get(`/api/jobs/${jobId}`);

            expect(response.statusCode).toBe(401);
        });

        it("should return 403 for unauthorized user", async () => {
            // Create another user who is not involved in this job
            const otherUserResponse = await request(app)
                .post("/api/auth/signup")
                .send({
                    email: faker.internet.email(),
                    lastName: faker.person.lastName(),
                    firstName: faker.person.firstName(),
                    password: "Password123#",
                    password_confirmation: "Password123#",
                });

            const otherToken = otherUserResponse.body.token;

            const response = await request(app)
                .get(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${otherToken}`);

            expect(response.statusCode).toBe(403);

            // Clean up
            await prisma.user.delete({ where: { id: otherUserResponse.body.data.id } });
        });
    });

    describe("PUT /api/jobs/:id", () => {
        it("should update job status from active to in_progress", async () => {
            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({
                    status: "in_progress"
                });

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.status).toBe("in_progress");
        });

        it("should update job notes", async () => {
            const notes = faker.lorem.paragraph();

            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    notes: notes
                });

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.notes).toBe(notes);
        });

        it("should update both status and notes in one request", async () => {
            const notes = faker.lorem.paragraph();

            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({
                    status: "completed",
                    notes: notes
                });

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.status).toBe("completed");
            expect(response.body.data.notes).toBe(notes);
        });

        it("should allow transition from in_progress to disputed", async () => {
            // First, set to in_progress
            await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "in_progress" });

            // Then dispute
            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${clientToken}`)
                .send({ status: "disputed" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("disputed");
        });

        it("should reject invalid status transitions", async () => {
            // Create a new application and job for this test
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            // Get the new job ID
            const newJob = await prisma.job.findFirst({
                where: { applicationId: newAppId }
            });

            // Try to transition from active to completed (should fail)
            const response = await request(app)
                .put(`/api/jobs/${newJob?.id}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "completed" });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toContain("Cannot transition");

            // Clean up
            await prisma.job.delete({ where: { id: newJob?.id } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should reject invalid status values", async () => {
            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "invalid_status" });

            expect(response.statusCode).toBe(422);
        });

        it("should return 403 for unauthorized user", async () => {
            // Create another user who is not involved in this job
            const otherUserResponse = await request(app)
                .post("/api/auth/signup")
                .send({
                    email: faker.internet.email(),
                    lastName: faker.person.lastName(),
                    firstName: faker.person.firstName(),
                    password: "Password123#",
                    password_confirmation: "Password123#",
                });

            const otherToken = otherUserResponse.body.token;

            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${otherToken}`)
                .send({ status: "cancelled" });

            expect(response.statusCode).toBe(403);

            // Clean up
            await prisma.user.delete({ where: { id: otherUserResponse.body.data.id } });
        });

        it("should allow curator to update notes", async () => {
            const notes = "Curator updated notes: " + faker.lorem.sentence();

            const response = await request(app)
                .put(`/api/jobs/${jobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ notes: notes });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.notes).toBe(notes);
        });
    });

    describe("DELETE /api/jobs/:id", () => {
        it("should allow admin to delete cancelled job", async () => {
            // Create a new job and cancel it first
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Transition to cancelled
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "cancelled" });

            // Now delete
            const response = await request(app)
                .delete(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(202);
            expect(response.body.status).toBe("success");
        });

        it("should reject delete by non-admin", async () => {
            // Create a new job and cancel it first
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Transition to cancelled
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "cancelled" });

            // Try to delete as curator
            const response = await request(app)
                .delete(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`);

            expect(response.statusCode).toBe(403);

            // Clean up
            await prisma.job.delete({ where: { id: newJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should reject delete of active job", async () => {
            // Create a new job
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Try to delete active job
            const response = await request(app)
                .delete(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toContain("cancelled or disputed");

            // Clean up
            await prisma.job.delete({ where: { id: newJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should allow admin to delete disputed job", async () => {
            // Create a new job
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Transition to disputed
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "in_progress" });

            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${clientToken}`)
                .send({ status: "disputed" });

            // Delete
            const response = await request(app)
                .delete(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(202);
        });
    });

    describe("Job lifecycle validation", () => {
        it("should enforce terminal state for completed jobs", async () => {
            // Create a new job
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Complete the job
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "in_progress" });

            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "completed" });

            // Try to change status after completion
            const response = await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "cancelled" });

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toContain("Cannot transition");

            // Clean up
            await prisma.job.delete({ where: { id: newJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should allow disputed to completed transition", async () => {
            // Create a new job
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Transition to disputed
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "in_progress" });

            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${clientToken}`)
                .send({ status: "disputed" });

            // Resolve the dispute by completing
            const response = await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "completed" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("completed");

            // Clean up
            await prisma.job.delete({ where: { id: newJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should allow disputed to cancelled transition", async () => {
            // Create a new job
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const newJobId = acceptResponse.body.job?.id;

            // Transition to disputed
            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "in_progress" });

            await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${clientToken}`)
                .send({ status: "disputed" });

            // Cancel after dispute
            const response = await request(app)
                .put(`/api/jobs/${newJobId}`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "cancelled" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("cancelled");

            // Clean up
            await prisma.job.delete({ where: { id: newJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });
    });

    describe("Application acceptance creates job", () => {
        it("should automatically create a job when application is accepted", async () => {
            // Verify job was created with the original test setup
            const job = await prisma.job.findUnique({
                where: { id: jobId }
            });

            expect(job).not.toBeNull();
            expect(job?.applicationId).toBe(applicationId);
            expect(job?.listingId).toBe(listingId);
            expect(job?.clientId).toBe(client.id);
            expect(job?.curatorId).toBe(curator.id);
            expect(job?.status).toBe(JobStatus.active);
        });

        it("should include job ID in acceptance response", async () => {
            // Create a new application
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            // Accept
            const acceptResponse = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            expect(acceptResponse.body.job).toBeDefined();
            expect(acceptResponse.body.job.id).toBeDefined();
            expect(acceptResponse.body.message).toContain("Job created");

            // Verify job exists
            const newJob = await prisma.job.findUnique({
                where: { applicationId: newAppId }
            });

            expect(newJob).not.toBeNull();
            expect(newJob?.id).toBe(acceptResponse.body.job.id);

            // Clean up
            await prisma.job.delete({ where: { id: newJob?.id } });
            await prisma.application.delete({ where: { id: newAppId } });
        });

        it("should not create duplicate jobs for same application", async () => {
            // Create a new application
            const newApplicationResponse = await request(app)
                .post("/api/applications")
                .set("Authorization", `Bearer ${clientToken}`)
                .send({
                    listingId: listingId,
                    message: faker.lorem.sentence(),
                });

            const newAppId = newApplicationResponse.body.data.id;

            // Accept first time
            const firstAccept = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            const firstJobId = firstAccept.body.job.id;

            // Accept again (should not create duplicate)
            const secondAccept = await request(app)
                .put(`/api/applications/${newAppId}/status`)
                .set("Authorization", `Bearer ${curatorToken}`)
                .send({ status: "ACCEPTED" });

            // Should return the same job
            expect(secondAccept.body.job.id).toBe(firstJobId);

            // Verify only one job exists
            const jobCount = await prisma.job.count({
                where: { applicationId: newAppId }
            });

            expect(jobCount).toBe(1);

            // Clean up
            await prisma.job.delete({ where: { id: firstJobId } });
            await prisma.application.delete({ where: { id: newAppId } });
        });
    });
});
