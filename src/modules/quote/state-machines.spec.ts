import { describe, expect, it } from 'vitest';
import { canQuoteTransition } from './quote-state-machine';
import { canRequestShopTransition, canRequestTransition } from '../quote-request/quote-request-state-machine';
import { canInstallationTransition } from '../installation/installation-state-machine';

describe('TZ 13.1 holat mashinalari', () => {
  it('QuoteRequest: mijoz faqat yopadi; tanlash/eskirish — tizim', () => {
    expect(canRequestTransition('OPEN', 'CLOSED_NO_SELECTION', 'CUSTOMER')).toBe(true);
    expect(canRequestTransition('OPEN', 'CLOSED_SELECTED', 'CUSTOMER')).toBe(false);
    expect(canRequestTransition('OPEN', 'CLOSED_SELECTED', 'SYSTEM')).toBe(true);
    expect(canRequestTransition('EXPIRED', 'OPEN', 'SYSTEM')).toBe(false);
    expect(canRequestTransition('CLOSED_SELECTED', 'CLOSED_NO_SELECTION', 'CUSTOMER')).toBe(false);
  });

  it('QuoteRequestShop: aniqlashtirish, taklif, rad etish', () => {
    expect(canRequestShopTransition('SENT', 'VIEWED', 'SHOP')).toBe(true);
    expect(canRequestShopTransition('VIEWED', 'CLARIFICATION_REQUESTED', 'SHOP')).toBe(true);
    expect(canRequestShopTransition('CLARIFICATION_REQUESTED', 'VIEWED', 'CUSTOMER')).toBe(true);
    expect(canRequestShopTransition('CLARIFICATION_REQUESTED', 'QUOTED', 'SHOP')).toBe(true);
    expect(canRequestShopTransition('QUOTED', 'DECLINED', 'SHOP')).toBe(false);
    expect(canRequestShopTransition('QUOTED', 'SELECTED', 'CUSTOMER')).toBe(true);
    expect(canRequestShopTransition('VIEWED', 'SELECTED', 'CUSTOMER')).toBe(false);
    expect(canRequestShopTransition('DECLINED', 'NOT_SELECTED', 'SYSTEM')).toBe(false);
    expect(canRequestShopTransition('QUOTED', 'NOT_SELECTED', 'SYSTEM')).toBe(true);
  });

  it('Quote: revise SENT→SENT, VIEWED→SENT; qabul faqat yuborilganda', () => {
    expect(canQuoteTransition('DRAFT', 'SENT', 'SHOP')).toBe(true);
    expect(canQuoteTransition('VIEWED', 'SENT', 'SHOP')).toBe(true);
    expect(canQuoteTransition('DRAFT', 'ACCEPTED', 'CUSTOMER')).toBe(false);
    expect(canQuoteTransition('VIEWED', 'ACCEPTED', 'CUSTOMER')).toBe(true);
    expect(canQuoteTransition('ACCEPTED', 'WITHDRAWN', 'SHOP')).toBe(false);
    expect(canQuoteTransition('SENT', 'EXPIRED', 'CUSTOMER')).toBe(false);
    expect(canQuoteTransition('SENT', 'REJECTED', 'SYSTEM')).toBe(true);
  });

  it('Installation: tasdiq faqat mijoz, nizo — admin; avtomatik tasdiq yo‘q', () => {
    expect(canInstallationTransition('AGREED', 'INSTALLATION_SCHEDULED', 'SHOP')).toBe(true);
    expect(canInstallationTransition('INSTALLATION_SCHEDULED', 'INSTALLED', 'SHOP')).toBe(true);
    expect(canInstallationTransition('INSTALLED', 'CONFIRMED', 'SHOP')).toBe(false);
    expect(canInstallationTransition('INSTALLED', 'CONFIRMED', 'SYSTEM')).toBe(false);
    expect(canInstallationTransition('INSTALLED', 'CONFIRMED', 'CUSTOMER')).toBe(true);
    expect(canInstallationTransition('DISPUTED', 'CONFIRMED', 'ADMIN')).toBe(true);
    expect(canInstallationTransition('INSTALLED', 'CANCELLED', 'SHOP')).toBe(false);
    expect(canInstallationTransition('AGREED', 'CANCELLED', 'CUSTOMER')).toBe(true);
  });
});
