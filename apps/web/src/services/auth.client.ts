import { apiGet } from './api.client';
import type { Role, UserStatus } from '@/types/common';

export interface CurrentUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  roles: Role[];
  masterProfile: { id: string; status: string; verification: string } | null;
}

export const authClient = {
  me() {
    return apiGet<CurrentUser>('/users/me');
  },
};
