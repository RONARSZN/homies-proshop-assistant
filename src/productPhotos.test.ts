import { describe, expect, it } from 'vitest';
import { catalogPhoto } from './productPhotos';

/* boards_13.webp is the LTD board's card. The line sheet ships no PRO card,
   and the token subset rule once let "SDR PRO" claim the LTD one. */
describe('catalogPhoto', () => {
  it('gives boards_13 to the SDR LTD board', () => {
    expect(catalogPhoto({ name: 'SDR LTD' })).toBe('/products/boards_13.webp');
    expect(catalogPhoto({ name: '2022 DUPWAKE SDR LTD' })).toBe('/products/boards_13.webp');
  });

  it('leaves the SDR PRO board on the placeholder', () => {
    expect(catalogPhoto({ name: 'SDR PRO' })).toBeNull();
    expect(catalogPhoto({ name: '2022 DUPWAKE SDR PRO' })).toBeNull();
  });
});
