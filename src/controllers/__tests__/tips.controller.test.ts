import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IUser } from "src/models/interfaces";
import app from "../../index";
import { faker } from "@faker-js/faker";
import { prisma } from "src/db";
import request from "supertest";
import { generateAccessToken } from "src/utils/helpers";

describe("Tips Controller", () => {
    let sender: IUser;
    let receiver: IUser;
    let senderToken: string;
    let receiverToken: string;

    beforeEach(async () => {
        const runId = faker.string.alphanumeric(10).toLowerCase();

        sender = await prisma.user.create({
            data: {
                email: `sender-${runId}@test.com`,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
            },
        }) as IUser;

        receiver = await prisma.user.create({
            data: {
                email: `receiver-${runId}@test.com`,
                lastName: faker.person.lastName(),
                firstName: faker.person.firstName(),
                password: "Password123#",
            },
        }) as IUser;

        senderToken = generateAccessToken({
            username: sender.email,
            id: sender.id,
            index: faker.number.int({ min: 1, max: 1000000 }),
        }).token;

        receiverToken = generateAccessToken({
            username: receiver.email,
            id: receiver.id,
            index: faker.number.int({ min: 1, max: 1000000 }),
        }).token;

        await prisma.tip.create({
            data: {
                amount: 1,
                currency: "XLM",
                status: "PENDING",
                senderId: sender.id,
                receiverId: receiver.id,
                message: "seed tip",
            },
        });
    });

    afterEach(async () => {
        await prisma.tip.deleteMany({
            where: {
                OR: [{ senderId: sender?.id }, { receiverId: receiver?.id }],
            },
        });

        const userIds = [sender?.id, receiver?.id].filter(Boolean) as string[];
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
    });

    describe("POST /tips", () => {
        it("should create a new tip", async () => {
            const response = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 10,
                    currency: "XLM",
                    message: "Great work!",
                    receiver_id: receiver.id,
                });

            expect(response.statusCode).toBe(201);
            expect(response.body.status).toBe("success");
            expect(response.body.data.amount).toBe(10);
            expect(response.body.data.currency).toBe("XLM");
            expect(response.body.data.message).toBe("Great work!");
            expect(response.body.data.senderId).toBe(sender.id);
            expect(response.body.data.receiverId).toBe(receiver.id);
            expect(response.body.data.id).toBeDefined();
        });

        it("should prevent self-tipping", async () => {
            const response = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 5,
                    receiver_id: sender.id,
                });

            expect(response.statusCode).toBe(422);
        });

        it("should validate required fields", async () => {
            const response = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({});

            expect(response.statusCode).toBe(422);
        });

        it("should validate minimum amount", async () => {
            const response = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 0,
                    receiver_id: receiver.id,
                });

            expect(response.statusCode).toBe(422);
        });
    });

    describe("GET /tips", () => {
        it("should list tips for sender", async () => {
            const response = await request(app)
                .get("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it("should list tips for receiver", async () => {
            const response = await request(app)
                .get("/api/tips")
                .set("Authorization", `Bearer ${receiverToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("success");
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it("should filter by type=sent", async () => {
            const response = await request(app)
                .get("/api/tips?type=sent")
                .set("Authorization", `Bearer ${senderToken}`);

            expect(response.statusCode).toBe(200);
            response.body.data.forEach((tip: any) => {
                expect(tip.senderId).toBe(sender.id);
            });
        });

        it("should filter by type=received", async () => {
            const response = await request(app)
                .get("/api/tips?type=received")
                .set("Authorization", `Bearer ${receiverToken}`);

            expect(response.statusCode).toBe(200);
            response.body.data.forEach((tip: any) => {
                expect(tip.receiverId).toBe(receiver.id);
            });
        });
    });

    describe("GET /tips/:id", () => {
        it("should return tip for sender", async () => {
            // Create a tip first to ensure we have a valid tipId
            const createResponse = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 7,
                    receiver_id: receiver.id,
                });

            const testTipId = createResponse.body.data.id;

            const response = await request(app)
                .get(`/api/tips/${testTipId}`)
                .set("Authorization", `Bearer ${senderToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.data.id).toBe(testTipId);
        });

        it("should return tip for receiver", async () => {
            // Create a tip first
            const createResponse = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 8,
                    receiver_id: receiver.id,
                });

            const testTipId = createResponse.body.data.id;

            const response = await request(app)
                .get(`/api/tips/${testTipId}`)
                .set("Authorization", `Bearer ${receiverToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.data.id).toBe(testTipId);
        });

        it("should return 404 for non-existent tip", async () => {
            const response = await request(app)
                .get("/api/tips/non-existent-id")
                .set("Authorization", `Bearer ${senderToken}`);

            expect(response.statusCode).toBe(404);
        });
    });

    describe("PUT /tips/:id", () => {
        it("should update tip status to COMPLETED with tx_hash", async () => {
            // Create a new pending tip for update test
            const createResponse = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 5,
                    receiver_id: receiver.id,
                });

            expect(createResponse.statusCode).toBe(201);
            const newTipId = createResponse.body.data.id;

            const response = await request(app)
                .put(`/api/tips/${newTipId}`)
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    tx_hash: "0x123abc456def",
                });

            expect(response.statusCode).toBe(202);
            expect(response.body.status).toBe("success");
            expect(response.body.data).toBeDefined();
            expect(response.body.data.txHash).toBe("0x123abc456def");
        });

        it("should update tip status to CANCELLED", async () => {
            // Create another pending tip
            const createResponse = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 3,
                    receiver_id: receiver.id,
                });

            expect(createResponse.statusCode).toBe(201);
            const newTipId = createResponse.body.data.id;

            const response = await request(app)
                .put(`/api/tips/${newTipId}`)
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    status: "CANCELLED",
                });

            expect(response.statusCode).toBe(202);
            expect(response.body.status).toBe("success");
            expect(response.body.data).toBeDefined();
        });

        it("should deny update for non-sender", async () => {
            // Create a fresh tip for this test
            const createResponse = await request(app)
                .post("/api/tips")
                .set("Authorization", `Bearer ${senderToken}`)
                .send({
                    amount: 2,
                    receiver_id: receiver.id,
                });

            expect(createResponse.statusCode).toBe(201);
            const freshTipId = createResponse.body.data.id;

            const response = await request(app)
                .put(`/api/tips/${freshTipId}`)
                .set("Authorization", `Bearer ${receiverToken}`)
                .send({
                    status: "CANCELLED",
                });

            expect(response.statusCode).toBe(403);
        });
    });
});
