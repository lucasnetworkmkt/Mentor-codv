// Fix: Removed missing type reference and used module augmentation for process.env to avoid redeclaration error
// /// <reference types="vite/client" />

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY?: string;
      API_KEY_A1?: string;
      API_KEY_A2?: string;
      API_KEY_A3?: string;
      API_KEY_B1?: string;
      API_KEY_B2?: string;
      API_KEY_B3?: string;
      API_KEY_C1?: string;
      [key: string]: string | undefined;
    }
  }
}
