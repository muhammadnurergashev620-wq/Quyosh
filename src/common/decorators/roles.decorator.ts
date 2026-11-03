import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AUTH_ROLES_KEY } from '../constants/auth.constants';

export const Roles = (...roles: Role[]) => SetMetadata(AUTH_ROLES_KEY, roles);
