import { ADMIN, DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import {
  ACTIVE,
  PENDING_APPROVAL,
  type UserStatus,
} from "@/lib/auth/user-statuses";
import {
  mockAdminUser,
  mockDispatcherUser,
  mockTeamLeadUser,
  mockUsers,
} from "@/lib/mock-data";

export type MockSession = {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  teamId: string | null;
  dispatcherId: string | null;
};

const STORAGE_KEY = "dpp-mock-session";
const SESSION_CHANGE_EVENT = "dpp-mock-session-change";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function notifyMockSessionChange(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function subscribeMockSession(callback: () => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  window.addEventListener(SESSION_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function sessionFromUser(user: {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  teamId?: string | null;
  dispatcherId?: string | null;
}): MockSession {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    teamId: user.teamId ?? null,
    dispatcherId: user.dispatcherId ?? null,
  };
}

export function getMockSession(): MockSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MockSession;
  } catch {
    return null;
  }
}

export function setMockSession(session: MockSession | null): void {
  if (!isBrowser()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyMockSessionChange();
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  notifyMockSessionChange();
}

export function clearMockSession(): void {
  setMockSession(null);
}

type MockLoginResult =
  | { success: true; session: MockSession }
  | { success: false; error: string };

const LOGIN_USERS_BY_ROLE: Record<Role, typeof mockAdminUser> = {
  [ADMIN]: mockAdminUser,
  [TEAM_LEAD]: mockTeamLeadUser,
  [DISPATCHER]: mockDispatcherUser,
};

export function mockLogin(
  email: string,
  password: string,
  expectedRole: Role,
): MockLoginResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password.trim()) {
    return { success: false, error: "Email and password are required." };
  }

  const user =
    mockUsers.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail && item.role === expectedRole,
    ) ?? null;

  if (!user) {
    return { success: false, error: "Invalid email or password for this portal." };
  }

  if (user.status === PENDING_APPROVAL) {
    return {
      success: false,
      error: "Your account is pending admin approval.",
    };
  }

  if (user.status !== ACTIVE) {
    return {
      success: false,
      error: "Your account is not active. Contact an administrator.",
    };
  }

  const session = sessionFromUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    teamId: user.teamId ?? null,
    dispatcherId: user.dispatcherId ?? null,
  });

  setMockSession(session);

  return { success: true, session };
}

export function mockLoginAsRole(role: Role): MockSession {
  const user = LOGIN_USERS_BY_ROLE[role];
  const session = sessionFromUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: ACTIVE,
    teamId: user.teamId ?? null,
    dispatcherId: user.dispatcherId ?? null,
  });

  setMockSession(session);
  return session;
}

export type DispatcherRegistrationInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  preferredTeam?: string;
  notes?: string;
};

export function mockRegisterDispatcher(
  _input: DispatcherRegistrationInput,
): { success: true; message: string } {
  return {
    success: true,
    message:
      "Registration request submitted. Admin approval is required before login.",
  };
}

/** Replace with Supabase session reader during backend integration. */
export function getSession(): MockSession | null {
  return getMockSession();
}

/** Replace with Supabase signOut during backend integration. */
export function signOutMockSession(): void {
  clearMockSession();
}
