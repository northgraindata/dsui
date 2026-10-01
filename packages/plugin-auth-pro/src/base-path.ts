/**
 * Where the host mounts this plugin's identity endpoints.
 *
 * Shared by the page the browser form posts to and by Better Auth itself; the
 * two have to agree or every request 404s.
 */
export const BASE_PATH = "/api/auth/auth-pro";
