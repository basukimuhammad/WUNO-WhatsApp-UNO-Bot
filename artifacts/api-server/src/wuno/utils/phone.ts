/**
 * Converts common Indonesian phone input into digits-only international format.
 * Stored WhatsApp IDs may include a suffix such as @c.us, so it is removed too.
 */
export const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
};