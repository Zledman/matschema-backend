const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email({ message: "Ogiltig email" }),
  password: z
    .string()
    .min(6, { message: "Lösenord måste vara minst 6 tecken" }),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Ogiltig email" }),
  password: z
    .string()
    .min(6, { message: "Lösenord måste vara minst 6 tecken" }),
});

module.exports = { registerSchema, loginSchema };
