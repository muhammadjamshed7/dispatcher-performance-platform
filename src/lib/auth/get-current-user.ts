export type CurrentUser = {
  id: string;
  email: string;
  role: string;
} | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  return null;
}
