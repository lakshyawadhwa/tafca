import type { UserRole } from '@ca-practice-os/shared';

declare global {
  namespace App {
    interface Locals {
      accessToken: string | null;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: UserRole;
        firmId: string;
        firmName: string;
        avatarUrl: string | null;
      } | null;
    }

    interface PageData {
      user?: App.Locals['user'];
      accessToken?: string | null;
    }

    interface Error {
      message: string;
      statusCode?: number;
    }
  }
}

export {};
