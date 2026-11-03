import { SetMetadata } from '@nestjs/common';
import type { AdminPermission } from '../constants/admin-permissions';

export const ADMIN_PERMISSION_KEY = 'auth:admin-permission';

/** Admin endpointi uchun kerakli huquq. Superadmin har doim o‘ta oladi; oddiy adminda shu huquq bo‘lishi shart. */
export const RequiresPermission = (permission: AdminPermission) => SetMetadata(ADMIN_PERMISSION_KEY, permission);
