import { appUrl } from "../utils/helpers";

import { config as conf } from "../config/index";
import path, { join } from "path";
import nodemailer from "nodemailer"
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPS_DIR = join(__dirname, 'templates');
type TEMPS = 'auth' | 'default'

const transporter = nodemailer.createTransport({
    host: <string>conf('mailer.host'),
    port: <number>conf('mailer.port'),
    secure: <boolean>conf('mailer.secure'), // true for port 465, false for other ports
    auth: {
        user: <string>conf('mailer.username'),
        pass: <string>conf('mailer.password'),
    },
});

export const sendMail = async (config: {
    to: string;
    text: string;
    temp?: TEMPS | undefined;
    subject: string;
    credits?: string | undefined;
    caption?: string | undefined;
    data?: { [key: string]: any }
}) => {
    const templatePath = join(TEMPS_DIR, (config.temp ?? 'auth') + '.html')
    let html = readFileSync(templatePath, 'utf-8');

    const replacements = Object.assign({}, {
        logo: appUrl('media/logo-dark.svg'),
        message: config.text ?? '',
        preview: `${config.text}`.replace(/<[^>]+>/g, '').truncate(200),
        caption: config.caption ?? '',
        address: config.data?.address ?? '',
        year: new Date().getFullYear(),
        appName: conf('app.name'),
        info: conf('mailer.info'),
    }, config.data, config)

    for (const [key, value] of Object.entries(replacements)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return await transporter.sendMail({
        from: <string>conf('mailer.from'), // sender address
        to: config.to, // list of receivers
        text: config.text, // plain text body
        subject: config.subject, // Subject line
        html, // html body
    });
}
