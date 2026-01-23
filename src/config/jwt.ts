import { env } from "../utils/helpers";

export default {
    expires_in: env('JWT_EXPIRES_IN'),
    secret: env('JWT_SECRET')
}
