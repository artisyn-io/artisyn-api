import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../utils/errors";
import ErrorHandler from "../utils/request-handlers";

/**
 * Handle Validation Middleware
 * 
 * Checks for validation errors from express-validator.
 * If errors exist, formats them and returns a 422 response
 * using the standardized global ErrorHandler.
 */
export const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorArray = errors.array();

        // Enhance the error message
        const count = errorArray.length;
        const msg = errorArray[0].msg;
        const message = count > 1 ? `${msg} and ${count - 1} other error(s)` : msg;

        // Group errors by field
        const formattedErrors: Record<string, string[]> = {};

        errorArray.forEach((err: any) => {
            const field = err.path || err.param || 'unknown';
            if (!formattedErrors[field]) {
                formattedErrors[field] = [];
            }
            formattedErrors[field].push(err.msg);
        });

        // Pass to global ErrorHandler via ValidationError
        return ErrorHandler(new ValidationError(message, formattedErrors), req, res);
    }

    next();
};
