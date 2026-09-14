import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { z } from "zod";

config();

export const env = createEnv({
  /*
   * Specify what prefix the client-side variables must have.
   * This is enforced both on type-level and at runtime.
   */
  clientPrefix: "PUBLIC_",
  server: {
    PREFIX: z.preprocess((value) => value ?? "U#", z.string().min(1)),
    DATABASE_URL: z.preprocess(
      (value) => value ?? "file:./data/wuno.db",
      z.string().min(1),
    ),
    CHROME_PATH: z.preprocess(
      (value) => value ?? "/repl/tools/bin/chromium",
      z.string().min(1),
    ),
    PAIRING_PHONE_NUMBER: z.preprocess(
      (value) => value ?? "6285189784830",
      z.string().regex(/^\d{8,15}$/, "Use international digits-only format"),
    ),
  },
  client: {},
  runtimeEnv: process.env,
});
