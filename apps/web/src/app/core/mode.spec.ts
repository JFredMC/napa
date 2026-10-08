import { MODE_KEY, resolveMode } from './mode';

describe('resolveMode', () => {
  beforeEach(() => localStorage.clear());

  it('sin URL de API siempre es demo', () => {
    expect(resolveMode(null, localStorage, '?mode=api')).toBe('demo');
  });

  it('con API: ?mode manda y se recuerda; por defecto demo', () => {
    expect(resolveMode('http://localhost:3000', localStorage, '')).toBe('demo');
    expect(resolveMode('http://localhost:3000', localStorage, '?mode=api')).toBe('api');
    expect(localStorage.getItem(MODE_KEY)).toBe('api');
    expect(resolveMode('http://localhost:3000', localStorage, '')).toBe('api');
    expect(resolveMode('http://localhost:3000', localStorage, '?mode=demo')).toBe('demo');
  });
});
