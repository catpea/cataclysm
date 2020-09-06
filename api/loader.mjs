import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import camelCase from 'lodash/camelCase.js';
import kebabCase from 'lodash/kebabCase.js';
import fsWalk from '@nodelib/fs.walk';

export default main;

async function main(setup){
  const files = []
  .concat(shallow('helper', setup.locations.templateHelpers, '.mjs'))
  .concat(shallow('helper', setup.locations.templateRootHelpers, '.mjs'))
  .concat(shallow('transformer', setup.locations.templateRootTransformers, '.mjs'))
  .concat(intense('partial', setup.locations.templateRootPartials, '.html'))
  .concat(modular('plugin', setup.locations.templateRootPlugins, '.mjs'))
  .concat(shallow('page', setup.locations.templateRootPages, '.html'))
  .concat(shallow('post', setup.locations.templateRootPosts, '.html'))
  return files;
}

function intense(type, location, extension){
  const response = [];
  if(fs.pathExistsSync(location)){
    const items = fsWalk.walkSync(location)
    .filter(o=>o.name.endsWith(extension))
    .map(({name:filename, path:base})=>({
      filename,
      type,
      name: kebabCase(path.join(path.dirname(path.relative(location, base)), path.basename(filename, extension))),
      basename: path.dirname( path.relative(location, base) ),
      dirname:  path.dirname(base),
      location:base
    }))
    .forEach(item=>response.push(item))
  }
  return response;
}

function modular(type, location, extension){
  const response = [];
  if(fs.pathExistsSync(location)){
    const items = fsWalk.walkSync(location)
    .filter(o=>o.name.endsWith(extension))
    .map(({name:filename, path:base})=>({
      filename,
      type,
      name: path.join(path.dirname(path.relative(location, base))),
      dirname:  path.dirname(base),
      location:base
    }))
    .filter(o=>!o.name.startsWith('_'))
    .forEach(item=>response.push(item))
  }
  return response;
}

function shallow(type, location, extension){
  const response = [];
  if(fs.pathExistsSync(location)){
    fs.readdirSync(location, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent=>dirent.name)
    .filter(filename=>filename.endsWith(extension))
    .map(filename=>({
      name: path.basename(filename, extension),
      type,
      filename,
      location: path.join(location, filename)
    }))
    .forEach(item=>response.push(item))
  }
  return response;
}
