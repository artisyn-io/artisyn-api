import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IUser } from 'src/models/interfaces';
import LoginController from 'src/controllers/auth/LoginController';
import PasswordResetController from 'src/controllers/auth/PasswordResetController';
import RegisterController from 'src/controllers/auth/RegisterController';
import app from '../../index'
import { faker } from '@faker-js/faker';
import multer from 'multer';
import { prisma } from 'src/db';
import request from 'supertest'

describe('Test controllers', () => {
    let user: IUser;
    let token: string;
    const email = faker.internet.email();

    beforeAll(() => {
        const upload = multer({ dest: 'public/media' })

        app.post('/auth/signup', upload.none(), new RegisterController().create);
        app.post('/auth/login', upload.none(), new LoginController().create);
        app.post('/auth/password', upload.none(), new PasswordResetController().create);
    });

    // Clean up after tests
    afterAll(async () => {
        if (user.id) {
            await prisma.user.delete({ where: { id: user.id } });
        }
    });

    it('should allow registration', async () => {
        const response = await request(app).post('/auth/signup').send({
            email,
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
            password: 'Password123#',
            password_confirmation: 'Password123#',
        });

        user = response.body.data
        token = response.body.token
        expect(user.email).toBe(email);
        expect(response.statusCode).toBe(201);
    });

    it('should allow login', async () => {
        const response = await request(app).post('/auth/login').send({
            email,
            password: 'Password123#',
        });

        expect(response.body.data.email).toBe(email);
        expect(response.statusCode).toBe(202);
    });

    it('can request password reset', async () => {
        const response = await request(app).post('/auth/password').send({
            email,
        });

        expect(response.statusCode).toBe(201);
    });
});
