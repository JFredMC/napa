// dist/cjs is CommonJS inside a "type": "module" package: mark the folder so Node and Jest agree.
import { writeFileSync } from 'node:fs';
import { URL } from 'node:url';
writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{ "type": "commonjs" }\n');
