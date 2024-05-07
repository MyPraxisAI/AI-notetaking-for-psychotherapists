import type { PlopTypes } from '@turbo/gen';

import { createKeystaticAdminGenerator } from './templates/keystatic/generator';
import { createPackageGenerator } from './templates/package/generator';

// List of generators to be registered
const generators = [createPackageGenerator, createKeystaticAdminGenerator];

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  generators.forEach((gen) => gen(plop));
}
