import { applyDecorators, SetMetadata } from '@nestjs/common';
import { AUTH_OPTIONAL_KEY, AUTH_PUBLIC_KEY } from '../constants/auth.constants';
export const Public = () => SetMetadata(AUTH_PUBLIC_KEY, true);

/** Ochiq endpoint, lekin yaroqli sessiya bo‘lsa `request.user` to‘ldiriladi (masalan, hisob — guest va mijoz). */
export const OptionalAuth = () => applyDecorators(SetMetadata(AUTH_PUBLIC_KEY, true), SetMetadata(AUTH_OPTIONAL_KEY, true));
