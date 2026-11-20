import { Console } from "@nsnanocat/util";

export default function debugJSON(label, value, space) {
    const level = Console.logLevel;
    // Skip serialization before the logger would discard the message.
    if (level === "DEBUG" || level === "ALL") Console.debug(`${label}: ${JSON.stringify(value, null, space)}`);
}
