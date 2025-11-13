# Artisyn.io Backend API

## Controller Format

Each controller should follow a consistent CRUD structure.

If additional methods are needed for a specific endpoint, create a **separate controller** dedicated to that logic.

### Example: `listings.controller.ts`

```ts
import { Request, Response } from 'express';
import Resource from '../resources/index';

export class UserController {
  async index(req: Request, res: Response) {
    Resource(req, res, {
      data: [],
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'OK',
        code: 200,
      });
  }

  async show(req: Request, res: Response) {
    Resource(req, res, {
      data: {},
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'OK',
        code: 200,
      });
  }

  async create(req: Request, res: Response) {
    Resource(req, res, {
      data: {},
    })
      .json()
      .status(201)
      .additional({
        status: 'success',
        message: 'New User created successfully',
        code: 201,
      });
  }

  async update(req: Request, res: Response) {
    Resource(req, res, {
      data: {},
    })
      .json()
      .status(202)
      .additional({
        status: 'success',
        message: 'User updated successfully',
        code: 202,
      });
  }

  async delete(req: Request, res: Response) {
    Resource(req, res, {
      data: {},
    })
      .json()
      .status(202)
      .additional({
        status: 'success',
        message: 'User deleted successfully',
        code: 202,
      });
  }
}
```

## Generating Controllers

The current setup allows you to generate controllers with a CLI command.

The command to generate controllers has this signature: `command make:controller [options] <name>`.

To generate a controller named UserController run the command below

```
yarn command make:controller User
```

OR

```
yarn command make:controller UserController
```

Additionally, you can simply run `command` to see all available commands and signatures.

---
