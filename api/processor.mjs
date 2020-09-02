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
  const $ = cheerio.load(html, {normalizeWhitespace: false, xmlMode: true});
  return $;
}

async function main(setup, files){

  const db = database(setup, files);

  //console.log(db.partials);

  for(let page of db.pages){
    const $ = load(page.content);

    const instance = {
      template: db.partials.reduce((root,item)=>{ root[item.name] = item.content; return root; }, {}), // the template database is seeded with partials, extended within each page by <template/>s.
      context:
      setup,
      db,
      $
    };

    // This should happen once, because templates are stripped off asap, to be used later on.
    templator(instance);
    traverse($('html'), instance);
    page.html = $.html();
    //page.html = pretty(page.html)
    //page.html = interpolate(page.html, setup); // final interpolation pass, at this point all the newly created stuff had things interpolated by their creators.
    //console.log(page.html);

    save(setup, page)

  }
  //console.log(`HTML (${db.pages.length}): ${db.pages.map(i=>`${i.name} (${humanize.filesize(i.html.length)})`)}`);
}

function traverse(root, {template, context, page, db, $}){
  // $(root).addClass('traversed');
  $(root)
  .contents() // Gets the branches of each branch in the set of matched branchs, including text and comment nodes.
  .filter((index, branch) => branch.nodeType == 1) // select standard nodes only
  .each(function (index, branch) {
    if($(branch).attr('if')){
      const path = $(branch).attr('if');
      const dereferenced = dereference(context, path);
      $(branch).attr('if', null); // remove the spent attribute
      $(branch).attr('if-result', !!dereferenced); // remove the spent attribute
      $(branch).before(`<!-- ${address($, branch)}: if path "${path}" returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);
      if(dereferenced === undefined){
        $(branch).remove(); // remove the entire node as it failed the logic test
        // nothing to traverse, the node is gone now
      }else{
        // traverse prior to interpolation
        traverse(branch, {template, context, page, db, $});
        const html = $.html(branch) + '\n'; // get string for interpolation
        const interpolated = interpolate(html, context);
        const $new = load(interpolated);
        $(branch).replaceWith($new.html());
      }
    }else if($(branch).attr('each')){

      const path = $(branch).attr('each');

      $(branch).attr('each', null);

      const html = $.html(branch) + '\n';

      let dereferenced = dereference(context, path);


      // SLICE
      const slice = decodeSlice($(branch).attr('slice'));
      $(branch).attr('slice', null);
      if(slice){
        if(dereferenced){
          dereferenced = dereferenced.slice(...slice);
        }
      }

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

      $(branch).remove();
    }else if( Object.keys(template).includes(branch.name) ){
      const name = branch.name;
      const html = template[name];
      const content = $.html(branch);
      const interpolated = interpolate(html, context);
      const $new = load(interpolated);
      $(branch).before(`<!-- template ${name} is mounted here here (keys were ${Object.keys(context).join(", ")}) -->`);

      $new('slot[name]').each(function (index, templateSlot) {
        const slotName = $(templateSlot).attr('name');
        const $content = load(content);

        // comes from the body
        const selection = $content(`*[slot='${slotName}']`).html();
        const existingContent = $(templateSlot).html();

        $(selection).attr('slot', null)
        $new(templateSlot).replaceWith( selection||existingContent )
      });

      traverse($new.root(), {template, context, page, db, $:$new}); // once slots have been done traverse the shadow root
      $(branch).replaceWith($new.html()); // and add the shadowroot back

    }else{
      traverse(branch, {template, context, page, db, $});
    }
  })
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
  }).get().reverse().concat(id(root)).join(' -> ');
  return response;
}

function interpolate(t, c){
  return t.replace(/\${([^}]+)}/g,(m,p)=>p.split('.').reduce((a,f)=>a?a[f]:undefined,c)??m)
}

function interpolateHtml($, node, context){
  const html = $.html(node);
  const interpolated = interpolate(html, context);

  const $new = load(interpolated);
  $(node).replaceWith($new.html());

}









function save(setup, page){
    const destination = path.join(setup.locations.destination, page.name + '2' + '.html')
    fs.writeFileSync(destination, page.html);
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
