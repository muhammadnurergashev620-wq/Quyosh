export type LinkTargetType = 'Shop' | 'User' | 'RequestShop' | 'Installation';

export interface LinkTarget {
  type: LinkTargetType;
  id: string;
}
