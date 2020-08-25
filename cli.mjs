#!/usr/bin/env -S node --experimental-modules --trace-warnings

import path from 'path';
import yargs from 'yargs';
import kebab from 'lodash/kebabCase.js';
import api from './api.mjs';

async function main(){

  const defaults = {
    destination: 'docs',
    template: 'main',
  };

  const options = await (await import(path.join(process.cwd(), 'cataclysm.mjs'))).default();
  const data = await (await import(path.join(process.cwd(), 'src/data/index.mjs'))).default();

  const setup = Object.assign({
    locations: {},
    options: Object.assign({}, defaults, options),
    data: data,
    content: null,
  });

  setup.locations.root = path.join(process.cwd());
  setup.locations.options = path.join(setup.locations.root, 'cataclysm.mjs');
  setup.locations.dataRoot = path.join(setup.locations.root, 'src', 'data');
  setup.locations.dataModule = path.join(setup.locations.dataRoot, 'index.mjs');

  setup.locations.destination = path.join(setup.locations.root, setup.options.destination);
  setup.locations.templateHelpers = path.join(setup.locations.root, 'src/templates/helpers');
  setup.locations.templateRoot = path.join(setup.locations.root, path.join('src/templates/', setup.options.template));
  setup.locations.templateRootHelpers = path.join(setup.locations.templateRoot, 'helpers');
  setup.locations.templateRootPartials = path.join(setup.locations.templateRoot, 'partials');
  setup.locations.templateRootPages = path.join(setup.locations.templateRoot, 'pages');
  setup.locations.templateRootPlugins = path.join(setup.locations.templateRoot, 'plugins');
  setup.locations.websiteFiles = path.join(setup.locations.root, 'src/files');
  setup.locations.templateFiles = path.join(setup.locations.templateRoot, 'files');

  const locations = yargs.argv.locations||yargs.argv.l;
  if(locations){
      if(typeof locations === 'boolean'){
        if(locations === true){
          Object.entries(setup.locations)
          .map(([k,v])=>`${kebab(k)} ${v}`)
          .map(str=>console.log(str))
        }
      }else if(typeof locations === 'string'){
        Object.entries(setup.locations)
        .filter(([k,v])=>(kebab(k)==locations))
        .map(([k,v])=>v)
        .map(str=>console.log(str))
      }
  }else{
    await api(setup);
  }

}

main();
