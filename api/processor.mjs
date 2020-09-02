import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import cheerio from 'cheerio';
import humanize from 'humanize';
import camelCase from 'lodash/camelCase.js';
import at from 'lodash/at.js';
import flatten from 'lodash/flatten.js';
import fsWalk from '@nodelib/fs.walk';

export default main;

function load(html){
  const $ = cheerio.load(html);
  return $;
}

async function main(setup, files){

  const db = database(setup, files);



  for(let page of db.pages){
    const $ = load(page.content);

    const instance = {
      template: db.partials.reduce((root,item)=>{ root[item.name] = item.content; return root; }, {}), // the template database is seeded with partials, extended within each page by <template/>s.
      context: Object.assign({}, setup, {page:{ id: page.name, file: page.name + '.html' }} ),
      db,
      $
    };

    // This should happen once, because templates are stripped off asap, to be used later on.
    templator(instance);
    traverse($('html'), instance);


    page.html = $.html();
    page.html = pretty(page.html)
    save(setup, page)

  }

}

function traverse(root, {template, context, page, db, $}){
  // $(root).addClass('traversed');
  $(root)
  .contents() // Gets the branches of each branch in the set of matched branchs, including text and comment nodes.
  //.filter((index, branch) => branch.nodeType == 1) // select standard nodes only
  .each(function (index, branch) {


    if( branch.nodeType === 3 ){
      const text = $.html(branch);
      $(branch).replaceWith( interpolate(text, context) );
    }

    const state = {};
    state.execute = 'nominal';

    if($(branch).attr('if')){
      state.execute = 'if';
      state.path = $(branch).attr('if');

      state.is = $(branch).attr('is');
      state.not = $(branch).attr('not');

      $(branch).attr('if', null);
      $(branch).attr('is', null);
      $(branch).attr('not', null);
      state.html = $.html(branch) + '\n'; // everything including parent because this is an attribute

    } else if(branch.name == 'if'){
      state.execute = 'if';
      state.path = $(branch).attr('path');

      state.is = $(branch).attr('is');
      state.not = $(branch).attr('not');

      $(branch).attr('path', null);
      $(branch).attr('is', null);
      $(branch).attr('not', null);
      state.html = $(branch).html() + '\n'; // contents only because this is a node we want to get rid of.

    } else if($(branch).attr('each')){
      state.execute = 'each';
      state.path = $(branch).attr('each');
      $(branch).attr('each', null);
      state.html = $.html(branch) + '\n'; // everything including parent because this is an attribute
      state.removeBranch = function(){ $(branch).remove(); }

    } else if(branch.name == 'each'){
      state.execute = 'each';
      state.path = $(branch).attr('path');
      state.html = $(branch).html() + '\n'; // contents only because this is a node we want to get rid of.
      //console.log('found each', Object.keys(context).join(", "), state.html);
      $(branch).attr('path', null);
      state.removeBranch = function(){ $(branch).remove(); }

    }else if( Object.keys(template).includes(branch.name) ){
      state.execute = 'template';
    }















    if(state.execute == 'if'){
      const path = state.path;
      const html = state.html;
      const dereferenced = dereference(context, path);
      //$(branch).before(`<!-- IF: address://${address($, branch)} -->`);
      //console.log( context.id );
      let outcome = undefined;

      if(state.is !== undefined){
        outcome = ( dereferenced == state.is)
      } else if (state.not !== undefined) {
        outcome = ( dereferenced != state.not)
      } else {
        outcome = !!dereferenced;
      }

      $(branch).before(`<!-- if path "${path}" is:(${state.is}) not:(${state.not}) resulted in outcome=(${outcome}) returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);
      if(outcome){

        // traverse prior to interpolation
        // const html = $.html(branch) + '\n'; // get string for interpolation
        //const interpolated = html;
        // //const interpolated = interpolate(html, context);
        const $new = load(html);
        traverse($new.root(), {template, context, page, db, $:$new});
        $(branch).replaceWith($new.html());
      }else{
        // NOTE: branch remove for <if> and <div if=""/> is functionally the same!
        $(branch).remove(); // remove the entire node as it failed the logic test
        // nothing to traverse, the node is gone now
      }

    } else if(state.execute == 'each'){
      const path = state.path;
      const html = state.html;
      let dereferenced = dereference(context, path);
      // SLICE
      const slice = decodeSlice($(branch).attr('slice'));
      $(branch).attr('slice', null);
      if(slice){
        if(dereferenced){
          dereferenced = dereferenced.slice(...slice);
        }
      }
      //$(branch).before(`<!-- EACH: address://${address($, branch)} -->`);
      $(branch).before(`<!-- EACH path "${path}" returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);
      // ITERATION
      let index = 0;
      if(dereferenced){
        for(let item of dereferenced){
          const newContext = Object.assign({}, context, item, {index});
          const interpolated = interpolate(html, newContext);
          const $new = load(interpolated);
          traverse($new.root(), {template, context:newContext, page, db, $:$new});

          $(branch).before($new.html());
          index++;
        }
      }
      state.removeBranch()

    } else if(state.execute == 'template'){
      const name = branch.name;
      const html = template[name];
      const content = $.html(branch);
      const interpolated = html;
      //TODO: when to do interpolation here?
      //const interpolated = interpolate(html, context);
      const $new = load(interpolated);
      $(branch).before(`<!-- template ${name} is mounted here here (keys were ${Object.keys(context).join(", ")}) -->`);

      // TODO: check slot names in immediate nodes only
      $new('slot[name]').each(function (index, templateSlot) {
        const slotName = $(templateSlot).attr('name');
        const $content = load(content);
        // comes from the body of the call to a template
        const selection = $content(`*[slot='${slotName}']`).html();
        const existingContent = $(templateSlot).html();
        $(selection).attr('slot', null)
        $new(templateSlot).replaceWith( selection||existingContent )
      });
      traverse($new.root(), {template, context, page, db, $:$new}); // once slots have been done traverse the shadow root


      // ADD INTERPOLATION HERE!?
      $(branch).replaceWith($new.html()); // and add the shadowroot back
      interpolateHtml($, branch, context)

    }else{
      traverse(branch, {template, context, page, db, $});
    }

  }) // cheerio each
}

function database(setup, files){

  const db = {};
  // Lists
  db.partials = files.filter(item=>item.type == 'partial');
  db.helpers = files.filter(item=>item.type == 'helper');
  db.plugins = files.filter(item=>item.type == 'plugin');
  db.pages = files.filter(item=>item.type == 'page');

  // Name Lookup
  db.partials.reduce((root,item)=>{ if(!root.partial) root.partial = {}; root.partial[item.name] = item; return root; }, db);
  db.helpers.reduce((root,item)=>{ if(!root.helper) root.helper = {}; root.helper[item.name] = item; return root; }, db);
  db.plugins.reduce((root,item)=>{ if(!root.plugin) root.plugin = {}; root.plugin[item.name] = item; return root; }, db);
  db.pages.reduce((root,item)=>{ if(!root.page) root.page = {}; root.page[item.name] = item; return root; }, db);



  return db;
}

function templator({setup, db, $, template}){
  // Extract templates marked by template tags, this is a safe initial operation.
  $('template').each(function(i, branch) {
    const name = $(branch).attr('name');
    if(name){
      const html = $(branch).html();
      template[name] = html;
    }
    $(branch).remove();
  });
}

function dereference(object={}, path=""){
  let location = object;
  for (let fragment of path.split('.') ) {
    location = location[fragment];
    if(location !== undefined){
      continue; // keep descending down
    }else{
      break; // exit loop and return undefined
    }
  }
  return location;
}

function address($, root){
  const id = function(node){
    let response = node.name;
    if($(node).attr('class')){
        response += "." + $(node).attr('class').split(' ').join(".");
    }
    return response;
  }
  const response = $(root)
  .parents()
  .map(function(i, el) {
    return id(this);
  }).get().reverse().concat(id(root)).join('/');
  return response;
}

function interpolate(t, c){
  return t.replace(/\${([^}]+)}/g,(m,p)=>p.split('.').reduce((a,f)=>a?a[f]:undefined,c)??m)
}

function interpolateHtml($, node, context){



  const html = $.html(node);
  const interpolated = interpolate(html, context);
  const $new = load(interpolated);
  //console.log($new.html());
  $(node).replaceWith($new.html());

}









function save(setup, page){
    const destination = path.join(setup.locations.destination, page.name + '2' + '.html')

    let html = page.html;
    //html = cheerio.load(html).html();
    fs.writeFileSync(destination, html);

    console.log(`INFO: saved ${destination} (${humanize.filesize(page.html.length)})`);
}








function decodeSlice(str){
  let response = null;

  if(str){
    response = str.split(',')
    .map(i=>i.trim())
    .map(i=>parseInt(i))
  }

  return response;
}
