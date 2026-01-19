import { IUser } from 'src/models/interfaces';
import LoginController from '../auth/LoginController';
import PasswordResetController from '../auth/PasswordResetController';
import RegisterController from '../auth/RegisterController';
import app from '../../index'
import multer from 'multer';
import { prisma } from 'src/db';
import request from 'supertest'

describe('Test controllers', () => {
    let user: IUser;
    let token: string;

    beforeAll(() => {
        const upload = multer({ dest: 'public/media' })

        app.post('/register', upload.none(), new RegisterController().create);
        app.post('/login', upload.none(), new LoginController().create);
        app.post('/reset', upload.none(), new PasswordResetController().create);
    });

    // Clean up after tests
    afterAll(async () => {
        await prisma.user.delete({ where: { id: user.id } });
    });

    it('should allow registration', async () => {
        const response = await request(app).post('/register').send({
            email: 'aq@e.com',
            lastName: 'Test',
            firstName: 'User',
            password: 'Password123#',
            password_confirmation: 'Password123#',
        });

        user = response.body.data
        token = response.body.token
        expect(user.email).toBe('aq@e.com');
        expect(response.statusCode).toBe(201);
    });

    it('should allow login', async () => {
        const response = await request(app).post('/login').send({
            email: 'aq@e.com',
            password: 'Password123#',
        });

        expect(response.body.data.email).toBe('aq@e.com');
        expect(response.statusCode).toBe(202);
    });

    it('can request password reset', async () => {
        const response = await request(app).post('/reset').send({
            email: 'aq@e.com',
        });

        expect(response.statusCode).toBe(201);
    });
});
