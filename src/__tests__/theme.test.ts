import { lightColors, darkColors } from '../theme';
import type { ThemeColors } from '../theme';

describe('theme palettes', () => {
  const lightKeys = Object.keys(lightColors).sort();
  const darkKeys = Object.keys(darkColors).sort();

  it('light and dark palettes have identical keys', () => {
    expect(lightKeys).toEqual(darkKeys);
  });

  it('all ThemeColors keys have non-empty string values in light palette', () => {
    for (const value of Object.values(lightColors)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('all ThemeColors keys have non-empty string values in dark palette', () => {
    for (const value of Object.values(darkColors)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('light and dark palettes have different bg values', () => {
    expect(lightColors.bg).not.toBe(darkColors.bg);
  });

  it('light and dark palettes have different text values', () => {
    expect(lightColors.text).not.toBe(darkColors.text);
  });

  it('utility colors (white, black, shadow) are the same across themes', () => {
    expect(lightColors.white).toBe(darkColors.white);
    expect(lightColors.black).toBe(darkColors.black);
    expect(lightColors.shadow).toBe(darkColors.shadow);
  });

  it('textOnPrimary is the same across themes', () => {
    expect(lightColors.textOnPrimary).toBe(darkColors.textOnPrimary);
  });

  it('has all expected semantic token categories', () => {
    const expected: (keyof ThemeColors)[] = [
      'bg', 'bgAlt', 'bgMuted', 'bgMid',
      'text', 'textMuted', 'textFaint', 'textOnPrimary',
      'border', 'borderLight',
      'primary', 'primaryMid', 'primaryLight', 'primaryDim', 'primaryPale',
      'accent', 'accentBright',
      'red', 'redDeep', 'redPale',
      'blue', 'bluePale',
      'purple', 'purpleMid', 'purplePale', 'purpleDim',
      'amber', 'amberPale', 'amberDeep',
      'overlay', 'overlayLight', 'overlayHeavy',
      'mapBg', 'mapLegendBg', 'conditionPro', 'authInputBg',
      'webOuterBg', 'cancelledBadgeBg', 'redBorder', 'greenDeep',
      'shadow', 'white', 'black',
    ];

    for (const key of expected) {
      expect(lightColors).toHaveProperty(key);
      expect(darkColors).toHaveProperty(key);
    }
  });
});
