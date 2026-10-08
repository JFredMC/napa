/**
 * Lector mínimo de robots.txt (RFC 9309): elige el grupo del User-Agent más específico (o `*`)
 * y aplica la regla Allow/Disallow más larga que coincida, con comodines `*` y `$`.
 */
interface Rule {
  allow: boolean;
  pattern: string;
}

function parseGroups(robots: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  let agents: string[] = [];
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m?.[1]) continue;
    const key = m[1].toLowerCase();
    const value = (m[2] ?? '').trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      for (const a of agents) if (!groups.has(a)) groups.set(a, []);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if ((key === 'allow' || key === 'disallow') && agents.length) {
      if (key === 'disallow' && !value) continue;
      for (const a of agents) groups.get(a)?.push({ allow: key === 'allow', pattern: value });
    }
  }
  return groups;
}

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** ¿Permite el robots.txt que `userAgent` consulte `path` (con query string)? */
export function isAllowedByRobots(robots: string, userAgent: string, path: string): boolean {
  const groups = parseGroups(robots);
  const ua = userAgent.toLowerCase();
  const product = ua.split('/')[0] ?? ua;
  const name = [...groups.keys()]
    .filter((a) => a !== '*' && product.includes(a))
    .sort((a, b) => b.length - a.length)[0];
  const rules = groups.get(name ?? '*') ?? [];
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!toRegExp(rule.pattern).test(path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
