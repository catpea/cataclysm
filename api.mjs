import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import Handlebars from 'handlebars';


import first from 'lodash/first.js';
Handlebars.registerHelper('first', function(argument, body) {

  return body.fn(first(argument));;
})

import last from 'lodash/last.js';
Handlebars.registerHelper('last', function(argument, body) {

  return body.fn(last(argument));;
})



export default main;

function main(options){

  console.log(options);


  // console.log('Loading Options and Data');
  // const options = (await import(path.join(process.cwd(), 'options.mjs'))).default();
  // const data = (await import(path.join(process.cwd(), 'data/index.mjs'))).default();
  //
  // console.log('Copying Template Files');
  // fs.copySync(path.resolve(path.join(options.template.root, options.template.name, options.template.files)), path.resolve(path.join(options.website.directory)))
  //
  // console.log('Copying Website Files');
  // for (let files of options.website.files){
  //   const resolved = path.resolve(files);
  //   fs.copySync(resolved, path.resolve(path.join(options.website.directory)))
  //   console.log(`Copied ${resolved}`);
  // }
  //
  // console.log('Load Template Partials');
  // fs.readdirSync( path.resolve(path.join(options.template.root, options.template.name, options.template.partials)) )
  // .filter(name=>name.endsWith('.hbs'))
  // .map(file=>({file, name: path.basename(file, '.hbs')}))
  // .map(o=>({...o, path: path.resolve(path.join(options.template.root, options.template.name, options.template.partials, o.file))}))
  // .map(o=>({...o, content: fs.readFileSync(o.path).toString()}))
  // .forEach(o=>Handlebars.registerPartial(o.name, o.content));
  //
  // console.log('Creating Pages');
  // const pages = fs.readdirSync( path.resolve(path.join(options.template.root, options.template.name, options.template.templates)) )
  // .filter(name=>name.endsWith('.hbs'))
  // .map(file=>path.basename(file, '.hbs' ))
  // for (let page of pages){
  //   render(page, data, options);
  // }

}



function render(filename, data, options){
  const template = Handlebars.compile(fs.readFileSync(path.resolve(path.join(options.template.root, options.template.name, options.template.templates, filename + '.hbs' ))).toString());
  const file = path.resolve(path.join(options.website.directory, filename + '.html'));
  let html = template(data);
  let code = pretty(html, {ocd: true});
  fs.writeFileSync(file, code);
  console.log(`Saved ${filename} to ${file}`);
}
