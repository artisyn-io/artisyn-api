import { env } from "../utils/helpers";

export default {
    url: env('APP_URL'),
    name: env('APP_NAME'),
    front_url: env('APP_FRONT_URL')
}
