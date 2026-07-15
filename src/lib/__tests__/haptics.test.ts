import { hapticLight, hapticMedium, hapticSuccess, hapticSelection } from '../haptics';

// expo-haptics is mocked in jest.setup.js
const Haptics = require('expo-haptics');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('haptics utility', () => {
  it('hapticLight calls impactAsync with Light style', () => {
    hapticLight();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('hapticMedium calls impactAsync with Medium style', () => {
    hapticMedium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('hapticSuccess calls notificationAsync with Success type', () => {
    hapticSuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('hapticSelection calls selectionAsync', () => {
    hapticSelection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });
});
