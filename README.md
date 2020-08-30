# cataclysm
Static Website Builder

## YSK

- Cataclysm uses ./src directory (rather than scattering files around repository root) to keep all your hard work in one directory.

## Links

- [cataclysm at npm](https://www.npmjs.com/package/cataclysm)
- [cataclysm at github](https://github.com/catpea/cataclysm)

## Installation

```sh

npm i -g cataclysm

```

## Usage

Run ```cataclysm``` in template/website directory.

## Conventions

Main configuration file is ./cataclysm.mjs

Template data file is ./data/index.mjs the data folder allows for extra files such as colors.json or db/tables/bobby.json

Both are to return a promise.

### Configuration

System configuration file is called ```./cataclysm.mjs```

### Data

There must be some way of fetching a properly structured data that is fed into the template system.

I introduce the concept of ```./src/data/index.mjs```, it is a JavaScript module that returns a promise, upon execution it will return all the data the templates need.

Please create a ```./src/data/index.mjs``` module in the root of your project.

```JavaScript

// Example data module

import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import take from 'lodash/take.js';
import reverse from 'lodash/reverse.js';
const data = {};
export default async function () {
  // you can process data before returning...
  return data;
}

```
