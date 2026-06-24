import { buildMapAppLinks } from '../mapLinks';

describe('buildMapAppLinks', () => {
  it('uses the venue name/address for Google and exact coordinates elsewhere', () => {
    const links = buildMapAppLinks({
      latitude: 44.439,
      longitude: 26.096,
      name: 'Parcul Ioanid',
      address: 'Bulevardul Dacia, București',
    });

    expect(decodeURIComponent(links.google)).toContain(
      'destination=Parcul Ioanid, Bulevardul Dacia, București',
    );
    expect(links.apple).toContain('daddr=44.439%2C26.096');
    expect(decodeURIComponent(links.apple)).toContain('q=Parcul Ioanid');
    expect(links.waze).toContain('ll=44.439%2C26.096');
  });
});
