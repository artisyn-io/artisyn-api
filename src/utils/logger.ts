import winston from 'winston';
import path from 'node:path';

const logsDir = path.join(process.cwd(), 'storage/logs');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// General Logger
const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        // Error logs with rotation
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Combined logs with rotation
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

// Security Logger
export const securityLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            maxsize: 10485760,
            maxFiles: 10,
            tailable: true
        })
    ]
});

// Audit Logger
export const auditLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'audit.log'),
            maxsize: 20971520, // 20MB
            maxFiles: 20,
            tailable: true
        })
    ]
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
    const consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    });
    logger.add(consoleTransport);
    securityLogger.add(consoleTransport);
}

export default logger;

