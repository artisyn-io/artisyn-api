import { beforeAll, describe, expect, it } from 'vitest';

import CategoryController from '../Admin/CategoryController';
import CategoryPublicController from '../CategoryController';
import { ICategory } from 'src/models/interfaces';
import app from '../../index'
import multer from 'multer';
import request from 'supertest'

describe('Test controllers', () => {
    let category: ICategory;
    const categorySeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialCategoryData = {
        icon: `fas-${categorySeed}`,
        name: `Hello-${categorySeed}`,
        description: `Hello World ${categorySeed}`,
    };
    const updatedCategoryData = {
        icon: `fas1-${categorySeed}`,
        name: `Hello 1-${categorySeed}`,
        description: `Hello 1 World ${categorySeed}`,
    };

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
            ...initialCategoryData,
        }))

        category = response.body.data

        expect(response.body.data.icon).toBe(initialCategoryData.icon);
        expect(response.body.data.name).toBe(initialCategoryData.name);
        expect(response.body.data.description).toBe(initialCategoryData.description);
        expect(response.statusCode).toBe(201);
    });

    it('should show get categories', async () => {
        const response = await request(app).get('/tester');
        const createdCategory = response.body.data.find((item: ICategory) => item.id === category.id);

        expect(createdCategory).toBeDefined();
        expect(createdCategory.icon).toBe(initialCategoryData.icon);
        expect(createdCategory.name).toBe(initialCategoryData.name);
        expect(createdCategory.description).toBe(initialCategoryData.description);
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
    });

    it('should show get public categories', async () => {
        const response = await request(app).get('/public/tester');
        const createdCategory = response.body.data.find((item: ICategory) => item.id === category.id);

        expect(createdCategory).toBeDefined();
        expect(createdCategory.icon).toBe(initialCategoryData.icon);
        expect(createdCategory.name).toBe(initialCategoryData.name);
        expect(createdCategory.description).toBe(initialCategoryData.description);
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
    });

    it('should get category', async () => {
        const response = await request(app).get('/tester/' + category.id);
        expect(response.body.data.icon).toBe(initialCategoryData.icon);
        expect(response.body.data.name).toBe(initialCategoryData.name);
        expect(response.body.data.description).toBe(initialCategoryData.description);
        expect(response.statusCode).toBe(200);
    });

    it('should get public category', async () => {
        const response = await request(app).get('/public/tester/' + category.id);
        expect(response.body.data.icon).toBe(initialCategoryData.icon);
        expect(response.body.data.name).toBe(initialCategoryData.name);
        expect(response.body.data.description).toBe(initialCategoryData.description);
        expect(response.statusCode).toBe(200);
    });

    it('should update category', async () => {
        const response = await request(app).put('/tester/' + category?.id).send({
            ...updatedCategoryData,
        })

        expect(response.body.data.icon).toBe(updatedCategoryData.icon);
        expect(response.body.data.name).toBe(updatedCategoryData.name);
        expect(response.body.data.description).toBe(updatedCategoryData.description);
        expect(response.statusCode).toBe(202);
    });

    it('should delete category', async () => {
        const response = await request(app).delete('/tester/' + category?.id);
        expect(response.statusCode).toBe(202);
    });
});
