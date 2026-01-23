import app from "./app";
import { doter } from "../utils/helpers"
import jwt from "./jwt";
import mailer from "./mailer"

const configurations = doter({
    mailer,
    app,
    jwt,
})

// Type for configurations
type ConfigType = typeof configurations;

// Fixed type for config return value
type FlatConfig<K extends keyof ConfigType | undefined> = K extends keyof ConfigType
    ? ConfigType[K]
    : ConfigType;

/**
 * Read config files
 * 
 * @param key 
 * @param def 
 * @returns 
 */
export const config = <K extends keyof ConfigType | undefined, D = unknown> (
    key?: K,
    def?: D,
): FlatConfig<K> => {
    if (key) {
        return (configurations[key] ?? def) as FlatConfig<K>;
    }

    return configurations as FlatConfig<K>;
};
