import { env } from "../utils/helpers";

export default {
    from: `"${env('MAIL_FROM_NAME')}" <${env('MAIL_FROM_ADDRESS')}>`,
    info: 'The information contained in this email is intended solely for the person or entity to whom it is addressed and may contain confidential or privileged information. Any review, dissemination, or use of this information by persons or entities other than the intended recipient is prohibited.',
    host: String(env('MAIL_HOST')),
    port: Number(env('MAIL_PORT')),
    secure: Number(env('MAIL_PORT')) === 465, // true for port 465, false for other ports
    username: env('MAIL_USERNAME') || undefined,
    password: env('MAIL_PASSWORD') || undefined,
}
