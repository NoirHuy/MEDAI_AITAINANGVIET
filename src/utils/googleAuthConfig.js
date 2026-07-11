export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}
