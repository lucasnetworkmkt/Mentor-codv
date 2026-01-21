import { UserProfile } from "../types";

// Keys for LocalStorage (Simulating Database)
const DB_USERS_KEY = "MENTOR_AUTH_USERS_DB";
const SESSION_KEY = "MENTOR_AUTH_SESSION_TOKEN";

// Helper to simulate async API delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for simple ID generation (UUID simulation)
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

interface AuthResponse {
  user: UserProfile;
  token: string;
}

export const authService = {
  /**
   * Registers a new user.
   * Throws error if email already exists.
   */
  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    await delay(800); // Simulate network latency

    const usersStr = localStorage.getItem(DB_USERS_KEY);
    const users: any[] = usersStr ? JSON.parse(usersStr) : [];

    const normalizedEmail = email.toLowerCase().trim();

    if (users.find((u) => u.email === normalizedEmail)) {
      throw new Error("Este e-mail já está registrado no sistema.");
    }

    const newUser = {
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      password: password, // In a real app, this MUST be hashed (bcrypt/argon2). Storing plain/base64 here for demo persistence only.
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));

    // Create session
    const userProfile: UserProfile = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.createdAt,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(userProfile));

    return { user: userProfile, token: "mock-jwt-token" };
  },

  /**
   * Authenticates an existing user.
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    await delay(800); // Simulate network latency

    const usersStr = localStorage.getItem(DB_USERS_KEY);
    const users: any[] = usersStr ? JSON.parse(usersStr) : [];

    const normalizedEmail = email.toLowerCase().trim();
    const user = users.find((u) => u.email === normalizedEmail && u.password === password);

    if (!user) {
      throw new Error("Credenciais inválidas. Acesso negado.");
    }

    const userProfile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(userProfile));

    return { user: userProfile, token: "mock-jwt-token" };
  },

  /**
   * Checks if there is an active session on startup.
   */
  getCurrentUser: async (): Promise<UserProfile | null> => {
    // Check if session exists
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;

    try {
      return JSON.parse(sessionStr) as UserProfile;
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  /**
   * Logs out the user.
   */
  logout: async (): Promise<void> => {
    localStorage.removeItem(SESSION_KEY);
    await delay(200);
  },
};