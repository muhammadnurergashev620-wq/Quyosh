export type Role = 'CUSTOMER' | 'SHOP' | 'ADMIN';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DELETED';

export type MediaAssetKind =
  | 'PRODUCT_IMAGE'
  | 'SHOP_LOGO'
  | 'VERIFICATION_DOC'
  | 'MESSAGE_ATTACHMENT'
  | 'REPORT'
  | 'IMPORT'
  | 'PORTFOLIO'
  | 'USER_AVATAR';

export type MediaAssetStatus =
  | 'UPLOADING'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'PROCESSING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export type LinkTargetType = 'Shop' | 'User';
