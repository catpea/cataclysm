import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import cheerio from 'cheerio';
import humanize from 'humanize';
import camelCase from 'lodash/camelCase.js';
import at from 'lodash/at.js';
import flatten from 'lodash/flatten.js';
import clone from 'lodash/clone.js';
import fsWalk from '@nodelib/fs.walk';

export default main;

function load(html){

  const $ = cheerio.load(html);
  return $;

}

async function main(setup, files){

  const db = database(setup, files);

  // if(0){
  //   for(let page of db.pages){
  //     const $ = load(page.content);
  //     const instance = {
  //       template: db.partials.reduce((root,item)=>{ root[item.name] = item.content; return root; }, {}), // the template database is seeded with partials, extended within each page by <template/>s.
  //       context: Object.assign({}, setup, {page:{ id: page.name, file: page.name + '.html' }} ),
  //       db,
  //       $
  //     };
  //     // This should happen once, because templates are stripped off asap, to be used later on.
  //     templator(instance);
  //     traverse($('html'), instance);
  //     page.html = $.html();
  //     page.html = pretty(page.html)
  //
  //     const destination = path.join(setup.locations.destination, page.name + '.html')
  //     fs.writeFileSync(destination, page.html);
  //     console.log(`INFO: saved ${destination} (${humanize.filesize(page.html.length)})`);
  //
  //   }
  // }


  if(1){

    const urls = {};

    for(let plugin of db.plugins){

      const list = await plugin.function({setup, plugin})

      for(let entry of list){
        const template = fs.readFileSync( path.join(plugin.dirname, entry.template) ).toString();
        // console.log(template);

        const $ = load(template);

        const instance = {
          template: db.partials.reduce((root,item)=>{ root[item.name] = item.content; return root; }, {}), // the template database is seeded with partials, extended within each page by <template/>s.
          context: Object.assign({}, setup, {content:entry.content}, {parent:entry.parent}, {page:{ id: entry.name, file: entry.name + '.html' }} ),
          db,
          $
        };
        templator(instance);

        traverse($('html'), instance);

        // $('surogate').children().each(function(i,e){
        //   $('head').append(e)
        // })
        // $('surogate').remove();

        $('*').contents().each(function() {
            if(this.nodeType === 8) {
                $(this).remove();
            }
        });

        $('img').each(function(i,e) {
          let location = path.join(setup.locations.destination, $(this).attr('src'));
          if(!fs.pathExistsSync(location)){
            console.log('MISSING IMAGE: ', location, $.html(e));
          }

        });

        $('a').each(function(i,e) {
          let location = $(this).attr('href');

          if(location.match(/^https{0,1}:\/\//)){
            if(!urls[location]){
              urls[location] = {
              count:1,
              };
              //console.log('EXTERNAL LINK: %s (%s)', location, instance.context.page.file);
            }
            urls[location].count++;
          }else if(location.match(/^#/)){
            if(!urls[location]){
              urls[location] = {
              count:1,
              };
              //console.log('INTERNAL ANCHOR LINK: %s (%s)', location, instance.context.page.file);
            }
            urls[location].count++;



            if($(`*[name="${location.substr(1)}"]`).length == 0){
                console.log('BAD INTERNAL ANCHOR %s not found: ', location, $.html(e));
            }




          }else{


            if(!urls[location]){
              urls[location] = {
              count:1,
              };
              //console.log('INTERNAL LINK: %s (%s)', location, instance.context.page.file);
            }
            urls[location].count++;

            let target = path.join(setup.locations.destination, location);
            if(!fs.pathExistsSync(target)){
              console.log('BAD LINK TO MISSING FILE:', location, $.html(e));
            }

          }



        });

        let html = $.html();
        html = pretty(html, {ocd: true});

        const destination = path.join(setup.locations.destination, instance.context.page.file)
        fs.writeFileSync(destination, html);
        console.log(`INFO: saved ${destination} (${humanize.filesize(html.length)})`);
      }
    }
  }

  // if(0){
  //   for(let post of db.posts){
  //     console.log(post.content);
  //     const $ = load(post.content);
  //     const source = $('html').attr('source');
  //     const file = $('html').attr('file');
  //     $('html').attr('source', null);
  //     $('html').attr('file', null);
  //     const dereferenced = dereference(setup, source);
  //     // console.log(dereferenced);
  //     if(dereferenced){
  //       for(let entry of dereferenced){
  //         const $ = load(post.content);
  //         const context = Object.assign( {}, setup, {content:entry} );
  //         const fileName = interpolate(file, context);
  //         $('html').attr('template', post.location);
  //         console.log(`Processing: ${fileName} based on ${source}`);
  //         console.log(`${Object.keys(context).join(", ")}`);
  //         const instance = {
  //           template: db.partials.reduce((root,item)=>{ root[item.name] = item.content; return root; }, {}), // the template database is seeded with partials, extended within each page by <template/>s.
  //           context: Object.assign(context, {page:{ id: post.name, file: fileName }}),
  //           db,
  //           $
  //         };
  //         templator(instance);
  //         traverse($('html'), instance);
  //         post.html = $.html();
  //         post.html = pretty(post.html)
  //         const destination = path.join(setup.locations.destination, fileName)
  //         fs.writeFileSync(destination, post.html);
  //         console.log(`INFO: saved ${destination} (${humanize.filesize(post.html.length)})`);
  //       }
  //     }
  //   }
  // }





}











function traverse(root, {template, context, page, db, $}){
  templator({template, context, page, db, $});
  // $(root).addClass('traversed');
  $(root)
  .contents() // Gets the branches of each branch in the set of matched branchs, including text and comment nodes.
  //.filter((index, branch) => branch.nodeType == 1) // select standard nodes only
  .each(function (index, branch) {



    // before we go any ruther, we must interpolate all attributes
    if( branch.nodeType === 1 && branch.attribs){
      // we must interpolate all attributes
      let attribs = Object.keys( branch.attribs );
      for(let attrib of attribs){
        if(attrib === 'each') break;
        $(branch).attr(attrib, interpolate($(branch).attr(attrib), context) )
      }
    }

    // before we go any ruther, we must interpolate text node text
    if( branch.nodeType === 3 ){
      const text = $.html(branch);
      $(branch).replaceWith( interpolate(text, context) );
    }




    // now prepare for various special cases

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


    } else if(branch.name == 'each'){
      state.execute = 'each';
      state.path = $(branch).attr('path');
      state.mode = 'tag';
      //console.log('found each', Object.keys(context).join(", "), state.html);
      $(branch).attr('path', null);





    } else if($(branch).attr('with')){
      state.execute = 'with';
      state.path = $(branch).attr('with');
      $(branch).attr('with', null);
      state.html = $.html(branch) + '\n'; // everything including parent because this is an attribute

    } else if(branch.name == 'with'){
      state.execute = 'with';
      state.mode = 'tag';
      state.path = $(branch).attr('path');
      state.html = $(branch).html() + '\n'; // contents only because this is a node we want to get rid of.
      //console.log('found with', Object.keys(context).join(", "), state.html);
      $(branch).attr('path', null);


    } else if($(branch).attr('template')){
      // NOTE: bug in cheerio prevented use of custom elements in head, template attribute was created to address that.
      state.execute = 'template';
      state.name = $(branch).attr('template')
      $(branch).attr('template', null);
      state.html = template[state.name];
      state.content = ""; // attributes have no content, a pointer could be added here, maybe.

    } else if(Object.keys(template).includes(branch.name)){
      state.execute = 'template';
      state.name = branch.name;
      state.mode = 'tag';
      state.html = template[state.name];
      state.content = $.html(branch);

    } else if(branch.name == 'function'){
      state.execute = 'function';
      state.name = $(branch).attr('name');
    }
















    if(state.execute == 'if'){
      const path = state.path;
      const html = state.html;
      const dereferenced = dereference(context, path);
      //$(branch).before(`<!-- IF: address://${address($, branch)} -->`);
      //console.log( context.id );
      let outcome = undefined;

      if(state.is === 'true') state.is = true;
      if(state.is === 'false') state.is = false;
      if(state.not === 'true') state.not = true;
      if(state.not === 'false') state.not = false;


      if(state.is !== undefined){
        outcome = ( dereferenced == state.is)
      } else if (state.not !== undefined) {
        outcome = ( dereferenced != state.not)
      } else {
        outcome = !!dereferenced;
      }

      $(branch).before(`<!-- if path "${path}" is:(${state.is}) not:(${state.not}) resulted in outcome=(${outcome}) returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);

      if(outcome){
        const $new = load(html);
        traverse($new.root(), {template, context, page, db, $:$new});
        $(branch).replaceWith($new.html());
      }else{
        // NOTE: branch remove for <if> and <div if=""/> is functionally the same!
        $(branch).remove(); // remove the entire node as it failed the logic test
        // nothing to traverse, the node is gone now
      }

    } else if(state.execute == 'with'){
        const path = state.path;
        const html = state.html;
        const dereferenced = dereference(context, path);

        $(branch).before(`<!-- WITH path "${path}" "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);

        const newContext = Object.assign({}, context, dereferenced);
        const $new = load(html);
        traverse($new.root(), {template, context:newContext, page, db, $:$new});

        if(state.mode === 'tag'){
          $(branch).replaceWith($new.html());
        }else{
          $(branch).after($new.html())
          $(branch).remove();
        }



    } else if(state.execute == 'each'){

      const path = state.path;
      let html;


      let dereferenced = dereference(context, path);

      // TRANSFORM
      const transformers = decodeTransform($(branch).attr('transform'));
      $(branch).attr('transform', null);
      if(transformers){
        if(dereferenced){
          for(let transform of transformers){
            if(db.transformer[transform]){
              dereferenced = db.transformer[transform].function(dereferenced);
            }else{
              throw new Error('Unknown transformer');
            }
          }
        }
      }

      // SLICE
      const slice = decodeSlice($(branch).attr('slice'));
      $(branch).attr('slice', null);
      if(slice){
        if(dereferenced){
          dereferenced = dereferenced.slice(...slice);
        }
      }

      // html extraction must come after slice/transformation.
      if(state.mode === 'tag'){

        $(branch).attr('class', null);
        html = $(branch).html() + '\n'; // contents only because this is a node we want to get rid of.
      }else{
        html = $.html(branch) + '\n'; // everything including parent because this is an attribute
      }


      //$(branch).before(`<!-- EACH: address://${address($, branch)} -->`);
      $(branch).before(`<!-- EACH path "${path}" returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);
      // ITERATION
      let index = 0;
      if(dereferenced){
        for(let item of dereferenced){
          const newContext = Object.assign({}, context, item, {index});
          const $new = load(html);



          traverse($new.root(), {template, context:newContext, page, db, $:$new});
          $(branch).before($new.html());
          index++;
        }
      }

      $(branch).remove();


    } else if(state.execute == 'function'){
      const response = db.helper[state.name].function(context);
      const $new = load(response);
      traverse($new.root(), {template, context, page, db, $:$new});
      $(branch).replaceWith($new.html());





    } else if(state.execute == 'template'){

      const name = state.name;
      const html = state.html;
      const branchContent = state.content;
      const $templateDOM = load(html);
      //console.log('HTML for %s is', 1, name, html);
    //  console.log( '>>>>>>>>>>>>>>>>>>>>>>>>>>' );

      $(branch).before(`<!-- EACH: address://${address($, branch)} -->`);
      $(branch).before(`<!-- template ${name} is mounted here here (keys were ${Object.keys(context).join(", ")}) -->`);

      // TODO: check slot names in immediate nodes only
      $templateDOM('slot[name]').each(function (index, templateSlot) {
        const slotName = $(templateSlot).attr('name');
        const $branchContent = load(branchContent);
        // comes from the body of the call to a template
        const branchContentSelection = $branchContent(`*[slot='${slotName}']`).html(); // user wants this assigned to a slot

        // console.log(branchContentSelection);
        // if(branchContentSelection) {
        //   $(branchContentSelection).attr('slot', null);
        // }

        const templateSlotDefaultContent = $(templateSlot).html(); // template creator set default content for this slot
        $templateDOM(templateSlot).replaceWith( branchContentSelection||templateSlotDefaultContent )
      });

      // $templateDOM('*[slot]').each(function (index, templateSlot) {
      //   const slotName = $(templateSlot).attr('slot');
      //   $(templateSlot).attr('slot', null);
      //   console.log('Attr encountered a slot set via attribute named %s', slotName);
      //   const $branchContent = load(branchContent);
      //   // comes from the body of the call to a template
      //   const branchContentSelection = $branchContent(`*[slot='${slotName}']`).html(); // user wants this assigned to a slot
      //   $(branchContentSelection).attr('slot', null)
      //   if(branchContentSelection){
      //     // replace whole tag
      //     $templateDOM(templateSlot).replaceWith( branchContentSelection )
      //   }else{
      //     // do noting
      //   }
      // });


      traverse($templateDOM.root(), {template, context, page, db, $:$templateDOM}); // once slots have been done traverse the shadow root


      // ADD INTERPOLATION HERE!?
      // $(branch).replaceWith($templateDOM.html()); // and add the shadowroot back
      //interpolateHtml($, branch, context)
      if(state.mode === 'tag'){
        $templateDOM('body > *').addClass($(branch).attr('class'))
        $(branch).replaceWith($templateDOM.html()); // and add the shadowroot back
      }else{
        $(branch).append($templateDOM.html())
      }





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
  db.transformers = files.filter(item=>item.type == 'transformer');
  db.pages = files.filter(item=>item.type == 'page');
  db.posts = files.filter(item=>item.type == 'post');

  // Name Lookup
  db.partials.reduce((root,item)=>{ if(!root.partial) root.partial = {}; root.partial[item.name] = item; return root; }, db);
  db.helpers.reduce((root,item)=>{ if(!root.helper) root.helper = {}; root.helper[item.name] = item; return root; }, db);
  db.plugins.reduce((root,item)=>{ if(!root.plugin) root.plugin = {}; root.plugin[item.name] = item; return root; }, db);
  db.transformers.reduce((root,item)=>{ if(!root.transformer) root.transformer = {}; root.transformer[item.name] = item; return root; }, db);
  db.pages.reduce((root,item)=>{ if(!root.page) root.page = {}; root.page[item.name] = item; return root; }, db);
  db.posts.reduce((root,item)=>{ if(!root.post) root.post = {}; root.post[item.name] = item; return root; }, db);

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
















function decodeTransform(str){
  let response = null;
  if(str){
    response = str.split('|')
    .map(i=>i.trim())
  }
  return response;
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
