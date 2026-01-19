import { beforeAll, describe, expect, it } from 'vitest';

import CategoryController from '../Admin/CategoryController';
import CategoryPublicController from '../CategoryController';
import { ICategory } from 'src/models/interfaces';
import app from '../../index'
import multer from 'multer';
import request from 'supertest'

describe('Test controllers', () => {
    let category: ICategory;

    beforeAll(() => {
        const upload = multer({ dest: 'public/media' })

        app.get('/tester', new CategoryController().index);
        app.get('/tester/:id', new CategoryController().show);
        app.post('/tester', upload.none(), new CategoryController().create);
        app.put('/tester/:id', upload.none(), new CategoryController().update);
        app.delete('/tester/:id', new CategoryController().delete);

        app.get('/public/tester', new CategoryPublicController().index);
        app.get('/public/tester/:id', new CategoryPublicController().show);
    });

    it('should create category', async () => {
        const response = (await request(app).post('/tester').send({
            icon: 'fas',
            name: 'Hello',
            description: 'Hello World',
        }))

        category = response.body.data

        expect(response.body.data.icon).toBe('fas');
        expect(response.body.data.name).toBe('Hello');
        expect(response.body.data.description).toBe('Hello World');
        expect(response.statusCode).toBe(201);
    });

    it('should show get categories', async () => {
        const response = await request(app).get('/tester');
        expect(response.body.data[0].icon).toBe('fas');
        expect(response.body.data[0].name).toBe('Hello');
        expect(response.body.data[0].description).toBe('Hello World');
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
    });

    it('should show get public categories', async () => {
        const response = await request(app).get('/public/tester');
        expect(response.body.data[0].icon).toBe('fas');
        expect(response.body.data[0].name).toBe('Hello');
        expect(response.body.data[0].description).toBe('Hello World');
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
    });

    it('should get category', async () => {
        const response = await request(app).get('/tester/' + category.id);
        expect(response.body.data.icon).toBe('fas');
        expect(response.body.data.name).toBe('Hello');
        expect(response.body.data.description).toBe('Hello World');
        expect(response.statusCode).toBe(200);
    });

    it('should get public category', async () => {
        const response = await request(app).get('/public/tester/' + category.id);
        expect(response.body.data.icon).toBe('fas');
        expect(response.body.data.name).toBe('Hello');
        expect(response.body.data.description).toBe('Hello World');
        expect(response.statusCode).toBe(200);
    });

    it('should update category', async () => {
        const response = await request(app).put('/tester/' + category?.id).send({
            icon: 'fas1',
            name: 'Hello 1',
            description: 'Hello 1 World',
        })

        expect(response.body.data.icon).toBe('fas1');
        expect(response.body.data.name).toBe('Hello 1');
        expect(response.body.data.description).toBe('Hello 1 World');
        expect(response.statusCode).toBe(202);
    });

    it('should delete category', async () => {
        const response = await request(app).delete('/tester/' + category?.id);
        expect(response.statusCode).toBe(202);
    });
});
