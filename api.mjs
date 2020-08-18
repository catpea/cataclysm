import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import Handlebars from 'handlebars';
import cloneDeep from 'lodash/cloneDeep.js';

export default main;

async function main(setup){

  console.log(setup);

  console.log(`Loading template helpers`);
  for(let item of fs.readdirSync(setup.locations.templateHelpers, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.mjs')).map(file=>({file, name: path.basename(file, '.mjs'), path: path.join(setup.locations.templateHelpers, file) }))){
    console.log(item.path);
    const imported = await import(item.path);
    await imported.default({Handlebars});
  }

  console.log(`Loading template specific helpers`);
  for(let item of fs.readdirSync(setup.locations.templateRootHelpers, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.mjs')).map(file=>({file, name: path.basename(file, '.mjs'), path: path.join(setup.locations.templateRootHelpers, file) }))){
    console.log(item.path);
    const imported = await import(item.path);
    await imported.default({Handlebars});
  }

  console.log(`Loading template specific partials`);
  for(let item of fs.readdirSync(setup.locations.templateRootPartials, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.hbs')).map(file=>({file, name: path.basename(file, '.hbs'), path: path.join(setup.locations.templateRootPartials, file) }))){
    console.log(item.path);
    Handlebars.registerPartial(item.name, fs.readFileSync(item.path).toString())
  }

  // Page Creation
  console.log(`Creating pages`);
  for(let item of fs.readdirSync(setup.locations.templateRootPages, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.hbs')).map(file=>({file, name: path.basename(file, '.hbs'), path: path.join(setup.locations.templateRootPages, file) }))){
    const destination = path.join(setup.locations.destination, item.name + '.html')
    const template = Handlebars.compile( fs.readFileSync(item.path).toString() );
    let html = template(Object.assign({id:item.name}, cloneDeep(setup)));
    let code = pretty(html, {ocd: true});
    fs.writeFileSync(destination, code);
    console.log(`Created ${destination}`);
  }

  // Plugin Processing
  console.log(`Executing plugins`);
  for(let plugin of fs.readdirSync(setup.locations.templateRootPlugins, { withFileTypes: true }).filter(o => o.isDirectory()).map(o=>o.name).map(name=>({name, path: path.join(setup.locations.templateRootPlugins, name), module: path.join(setup.locations.templateRootPlugins, name, 'index.mjs') }))){
    const imported = await import(plugin.module);
    await imported.default({plugin, setup:Object.assign({id:plugin.name}, cloneDeep(setup)), Handlebars});
  }




  // FINISH UP
  console.log('Copying Website Files');
  fs.copySync(setup.locations.websiteFiles, setup.locations.destination)
  console.log('Copying Template Files');
  fs.copySync(setup.locations.templateFiles, setup.locations.destination)

}
