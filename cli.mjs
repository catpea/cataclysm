#!/usr/bin/env -S node --experimental-modules --trace-warnings

import path from 'path';
import api from './api.mjs';

async function main(){
  const defaults = {
    destination: 'docs',
    template: 'main',
    locations: {}
  };



  const options = await (await import(path.join(process.cwd(), 'cataclysm.mjs'))).default();
  const data = await (await import(path.join(process.cwd(), 'src/data/index.mjs'))).default();
  const setup = Object.assign({}, data, defaults, options);

  setup.locations.destination = path.join(process.cwd(), setup.destination);

  setup.locations.templateHelpers = path.join(process.cwd(), 'src/templates/helpers');
  setup.locations.templateRoot = path.join(process.cwd(), path.join('src/templates/', setup.template));
  setup.locations.templateRootHelpers = path.join(setup.locations.templateRoot, 'helpers');
  setup.locations.templateRootPartials = path.join(setup.locations.templateRoot, 'partials');
  setup.locations.templateRootPages = path.join(setup.locations.templateRoot, 'pages');
  setup.locations.templateRootPlugins = path.join(setup.locations.templateRoot, 'plugins');

  setup.locations.websiteFiles = path.join(process.cwd(), 'src/files');
  setup.locations.templateFiles = path.join(setup.locations.templateRoot, 'files');



  await api(setup);
}

main();
