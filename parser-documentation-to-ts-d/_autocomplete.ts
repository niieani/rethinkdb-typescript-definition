// import rConn from './r';

// let r = rConn({});

// r.db('this').table('wtf');
// r.table('tat', {readMode: 'single'});

import docs from './reql_docs';
import htmlEntities from './utils/htmlEntities';
import * as markdown from 'to-markdown';

// const extractParamsRegex = new RegExp('r\\.branch\\(([a-zA-Z1-9\\._, <>\\{\\}\\:\'\\[\\]]*)\\) → any', 'g');
const extractArrayInterface = /\[((?:[a-zA-Z0-9_]+,* *)+, *(?:[a-zA-Z0-9_]+,* *)+)\]/g; // [longitude, latitude] => longitude, latitude
// const extractOptionalParams = /\[, ((?:[a-zA-Z0-9_\.\{\}\:]+,* *)+)\]/g; // true_action[, test2, else_action, ...], false_action => test2, else_action, ...
const extractOptionalParams = /\[(,? *(?:[a-zA-Z0-9_'"\.\{\}\:\?]+,* *)+)\]/g;
const extractTypeDef = /([a-zA-Z0-9_]+): *<([a-zA-Z]+)>/g; // {a: 'wtf'}, a: <number>, true_action => $0 => a: <number>; $1 => number
const extractObjectDefs = /\{ *(?:[a-zA-Z0-9_]+: *[a-zA-Z0-9_'" \?\|]+(?:, *)*)+ *}/g; // ude], { a: 'wtf', b: true }, a:  => { a: 'wtf', b: true }
const extractObjectProperties = /([a-zA-Z0-9_]+): */g; // { a: 'wtf', b: true }, test: <number> => $1: a, $1: b, $1: test
// const extractThisOrThat = /\[*([a-zA-Z0-9_]+ *[\|]+ *[a-zA-Z0-9_]+)\]*/g;
const replaceThisOrThatRegex = /\[([a-zA-Z0-9_]+)\.* *[\|]+ *([a-zA-Z0-9_]+)\.*\]/g;
const replaceThisOrThatNoBracketsRegex = /([a-zA-Z0-9_]+)\.* *[\|]+ *([a-zA-Z0-9_]+)\.*/g;
const isStringDeclarationRegex = /^'[a-zA-Z]+[^,]*'$/g; // 'index'
const restParamsRegex = /\[([a-zA-Z_]+)1?, *(?:[a-zA-Z_]+2?\.\.\.\]|[a-zA-Z_]+2?, *\.\.\.\])/g; // [selector1, selector2...] [selector1, selector2, ...]
// const restParamsVariationRegex = /\[,? *([a-zA-Z0-9_]+),? ?\.\.\.\]/g; // [, index...]
const restParamsVariationRegex = /,? *([a-zA-Z0-9_]+),? ?\.\.\.(?=[^a-zA-Z0-9]|$)/g; // , index... | , index, ...
const replaceRestParamsRegex = /([a-zA-Z0-9]+)\.\.\./g; // index... => ...index
const replaceDotDotDotRegex = /, *\.\.\.(?=[^a-zA-Z0-9]|$)/g; // , ... => , ...more
const extractOptional = /\[ *, *[a-zA-Z0-9,\.\|?{}: ]+\]|\[[a-zA-Z0-9,\.\|?{}: ]+ *, *\]/g;
const restAndThenSomethingElseRegex = /\.\.\.([a-zA-Z0-9_]+)(?:, *([a-zA-Z0-9_]+)(?:(?:\:{(?: *[a-zA-Z0-9_]*\:?[a-zA-Z0-9_<>]+,?)* *\}|\:[a-zA-Z0-9_<>]+))?)+/g; // ...array2s, func:{ a:string, b, c } ===> array2s_and_then_func


function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

// const extractParamsRegex = new RegExp('r\.branch\(([a-zA-Z1-9\._, <>\{\}\:\'\[\]]*)\) → any', 'g');
function getParamsStringIn(ifaceName:string, methodName:string, returnIface:string, bodyDescription:string, fallback = 2) {
  // TODO: still not passing: optional params inside objects:
  // table.getNearest(point, {index: 'indexname'[, maxResults: 100, maxDist: 100000, unit: 'm', geoSystem: 'WGS84']}) → selection<array></array>
  
  let innerChars = escapeRegExp(`.,_ <>{}:|'"[]`);
  let extractParamsRegex = new RegExp(`${ifaceName}\\.?${methodName}\\(([a-zA-Z1-9${innerChars}]*)\\) *. *${returnIface}`, 'g');
  // let extractParamsRegex = new RegExp(`${methodName}\\(([a-zA-Z1-9${innerChars}]*)\\) *. *${returnIface}`, 'g');
  // console.log(extractParamsRegex);
  // let extractParamsRegex = new RegExp(`[a-zA-Z1-9_]*${ifaceName}[a-zA-Z1-9_]*\\.${methodName}\\(([a-zA-Z1-9\\._, <>|\\{\\}\\:\'\\[\\]]*)\\) *→ *${returnIface}`, 'g');
  // let ret = extractParamsRegex.exec(bodyDescription);
  let ret = getMatches(bodyDescription, extractParamsRegex)
  // console.log(ret);
  if (ret.length > 0)
    return ret;
  else if (fallback == 2) 
    return getParamsStringIn('', methodName, returnIface, bodyDescription, fallback - 1)
  else if (fallback == 1)
    return getParamsStringIn('', methodName, '', bodyDescription, 0)
  else return '';
}

function isStringDeclaration(paramsString:string) {
  let ret = isStringDeclarationRegex.exec(paramsString);
  return ret && ret.length > 0;
}

function getMatches(string, regex, index = 1) {
  // default to the first capturing group
  var matches = [];
  var match;
  while (match = regex.exec(string)) {
    matches.push(match[index]);
  }
  return matches;
}

function replaceArrays(paramsString:string) {
  return paramsString.replace(extractArrayInterface, (match, names) => names.split(', ').join('And') + ":Array<any>");
}

function fixTyping(paramsString:string) {
  return paramsString.replace(extractTypeDef, (match, name, type) => { return type.length > 1 ? name + ":" + type : name });
}

function replaceObjects(paramsString:string) {
  return paramsString.replace(extractObjectDefs, (match) => "options:{ " + getMatches(match, extractObjectProperties).join('?, ') + "? }");
}

function addNameToObjects(paramsString:string) {
  return paramsString.replace(extractObjectDefs, (match) => "options:${match}");
}

// function removeBracketsFromThisOrThat(paramsString:string) {
  // return paramsString.replace(extractThisOrThat, (match) => getMatches(match, extractThisOrThat)[0]);
// }

function replaceThisOrThat(paramsString:string) {
  // let count = 0;
  // return paramsString.replace(replaceThisOrThatRegex, (all, first, second) => {count++; return first + "_or_" + second + count;});
  paramsString = paramsString.replace(replaceThisOrThatRegex, (all, first, second) => first.replace(/[0-9]/g, '') + "_or_" + second.replace(/[0-9]/g, ''));
  return paramsString.replace(replaceThisOrThatNoBracketsRegex, (all, first, second) => first.replace(/[0-9]/g, '') + "_or_" + second.replace(/[0-9]/g, ''));
}

function replaceBracketedRestParams(paramsString:string) {
  paramsString = paramsString.replace(restParamsRegex, (all, name) => ", ..." + name.replace(/[0-9]/g, '') + "s");
  return paramsString.replace(restParamsVariationRegex, (all, name) => ", ..." + name.replace(/[0-9]/g, '') + "s");
}

function replaceRestParams(paramsString:string) {
  return paramsString.replace(replaceRestParamsRegex, '...$1');
}

function replaceDotDotDot(paramsString:string) {
  return paramsString.replace(replaceDotDotDotRegex, ', ...more');
}

function replaceOptional(paramsString:string, use:Array<number>) {
  let current = 1;
  return paramsString.replace(extractOptionalParams, (a, b) => use.indexOf(current++) > -1 ? b : '');
}

function removeDoubleCommas(paramsString:string) {
  return paramsString.replace(/, ,/g, ',');
}

function removeBeginningAndTrailingCommas(paramsString:string) {
  paramsString = paramsString.replace(/^ *, */, '');
  return paramsString.replace(/, $/, '');
}

function restAndThenSomethingElse(paramsString:string) {
  // return paramsString.replace(/, $/, '');
  return paramsString.replace(restAndThenSomethingElseRegex, (m, a, b) => '...' + a + '_and_then_' + b);
}

function generateOptionalPossibilitiesMatrix(paramsString:string):Array<string> {
  let matrix:Array<string> = [];
  let matches = paramsString.match(extractOptionalParams);
  let count = matches ? matches.length : 0;
  if (!count) return [paramsString];
  let combinations = allCombinations<number>(integersFromOneTill(count));
  for (let combination of combinations) {
    matrix.push(replaceOptional(paramsString, combination));
  }
  return matrix;
}

function integersFromOneTill(number:number) {
  let out:Array<number> = [number];
  while (--number) 
    out.push(number);
  return out;
}

function allCombinations<T>(input:Array<T>, active:Array<T> = []) {
  if (input.length == 0) {
    return [active];
  } else {
    let newActive = active.slice();
    newActive.push(input[0]);
    let newInput = input.slice(1);
    let comb1 = allCombinations(newInput, newActive);
    let comb2 = allCombinations(newInput, active);
    return comb1.concat(comb2);
  }
}

function camelCase(string:string) {
  return string.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

const interfaces = new Map<string, Map<string, any>>();

let exampleExtractRegex = /    (?:> )*(.+)$/gm;

let tests = '';

for (let elementName in docs) {
  let element = docs[elementName];
  if (element.io) {
    // let body = markdown(element.body.replace(/( *\r\n|\n|\r *)/gm,""));
    // let description = markdown(element.description.replace(/( *\r\n|\n|\r *)/gm,""));
    // let example = markdown(element.example.replace(/( *\r\n|\n|\r *)/gm,""));
    let body = markdown(element.body);
    let description = markdown(element.description);
    let example = markdown(element.example);
    let names = element.name.split(', ');
    let url = `http://rethinkdb.com/api/javascript/${element.url}`;
    let elIo:Array<any> = element.io;
    
    // ADD TESTS //
    tests += `// TESTS FOR: ${element.name} //` + "\n";
    let testContentArray = getMatches(example, exampleExtractRegex);
    tests += testContentArray.join("\n") + "\n\n";
    
    for (let name of names) {
      if (name == '() (bracket)')
        name = '';
      if (name == 'EventEmitter (cursor)')
        continue;
      if (elIo[0].constructor !== Array) {
        let iin = elIo[0];
        let returns = elIo[1];
        
        // make sure all returns interfaces exist too
        if (!interfaces.has(returns)) {
          // console.log('adding interface ' + returns);
          interfaces.set(returns, new Map<string, any>());
        }
        
        if (iin && returns) {
          let ifaceMethods:Map<string, any> = interfaces.has(iin) ? interfaces.get(iin) : interfaces.set(iin, new Map<string, any>()).get(iin);
          let previousDefinition = ifaceMethods.get(name);
          ifaceMethods.set(name, { 
            body,
            description,
            example,
            name,
            url,
            returns: previousDefinition ? previousDefinition.returns.push(returns) : [returns]
          })
          // interfaces.set(iin, ifaceMethods);
        }
      }
      else for (let io of elIo) {
        let iin = io[0];
        let returns = io[1];
        
        // make sure all returns interfaces exist too
        if (!interfaces.has(returns)) {
          // console.log('adding interface ' + returns);
          interfaces.set(returns, new Map<string, any>());
        }
        
        // TODO: add check if array
        if (iin && returns) {
          let ifaceMethods:Map<string, any> = interfaces.has(iin) ? interfaces.get(iin) : interfaces.set(iin, new Map<string, any>()).get(iin);
          let previousDefinition = ifaceMethods.get(name);
          ifaceMethods.set(name, { 
            body,
            description,
            example,
            name,
            url,
            returns: previousDefinition ? previousDefinition.returns.push(returns) : [returns]
          })
          // interfaces.set(iin, ifaceMethods);
        }
      }
    }
  }
}


function getFullIfaceName(str:string) {
  if (!str || str === "undefined") return "void";
  if (str.startsWith('Promise')) return str;
  // if (str === "special" || str === "any") return "any";
  if (str === "error") return "Error";
  if (str === "r") return "RInterface";
  let camel = camelCase(str);
  return "R" + camel.charAt(0).toUpperCase() + camel.slice(1) + "Interface";
}

function padEachLineInString(str:string, padding:string) {
  let split = str.split("\n");
  let outputSplit = [];
  for (let line of split) {
    outputSplit.push(padding + line);
  }
  return outputSplit.join("\n");
}

// sequence.coerceTo('array') → array
// value.coerceTo('string') → string
// string.coerceTo('number') → number
// array.coerceTo('object') → object
// sequence.coerceTo('object') → object
// object.coerceTo('array') → array
// binary.coerceTo('string') → string
// string.coerceTo('binary') → binary

let output:string = `declare module rethinkdb {
  export interface RConnectionOptionsInterface {readMode?, timeFormat?, profile?, durability?, groupFormat?, noreply?, db?, arrayLimit?, binaryFormat?, minBatchRows?, maxBatchRows?, maxBatchBytes?, maxBatchSeconds?, firstBatchScaledownFactor?};
  export interface RRunableInterface {
    run<T>(connection:RConnectionInterface, cb:(err:Error, result:T)=>void):void;
    run<T>(connection:RConnectionInterface, options:RConnectionOptionsInterface, cb:(err:Error, result:T)=>void):void;
    run<T>(connection:RConnectionInterface, options?:RConnectionOptionsInterface):Promise<T>;
  }
  export interface RRunableCursorInterface {
    run<T>(connection:RConnectionInterface, cb:(err:Error, cursor:RCursorInterface)=>void):void;
    run<T>(connection:RConnectionInterface, options:RConnectionOptionsInterface, cb:(err:Error, cursor:RCursorInterface)=>void):void;
    run<T>(connection:RConnectionInterface, options?:RConnectionOptionsInterface):Promise<RCursorInterface>;
  }
`;

let keys = Array.from(interfaces.keys());

let interfaceExtensions = {
  'table': ['selection', 'stream', 'sequence'],
  'tableSlice': ['selection', 'stream', 'sequence', 'value'],
  'object': ['value'],
  'point': ['value', 'geometry'],
  'line': ['value', 'geometry'],
  'array': ['sequence'],
  'r': ['db'],
  'time': ['value'],
  'grouped_stream': ['array', 'value'],
  'stream': ['PromiseLike<any>', 'runable_cursor'],
  'sequence': ['PromiseLike<any>', 'runable_cursor'],
  'selection': ['PromiseLike<any>', 'runable_cursor'],
  'value': ['PromiseLike<any>', 'runable']
}

for (let iface of keys) {
  let methods = interfaces.get(iface);
  let fullIfaceName = getFullIfaceName(iface);
  
  if (fullIfaceName == 'void' || fullIfaceName == 'Error') continue;
  
  // EXTENDING:
  let thisInterfaceExtension:Array<string> = interfaceExtensions[iface] || [];
  if (iface != 'any')
    thisInterfaceExtension.push('any');
  
  let extensionStringList = thisInterfaceExtension.map(name => getFullIfaceName(name)).join(', ');
  let extensionString = extensionStringList ? `extends ${extensionStringList}` : '';
  
  output += `
  export interface ${fullIfaceName} ${extensionString} {`;
  let values = Array.from(methods.values());
  for (let method of values) {
    output += `

    /**
${padEachLineInString(method.description, '    * ')}
    *
${padEachLineInString(method.body, '    * ')}
${padEachLineInString(method.example, '    * ')}
    *
    * ${method.url}
    */`
    
    let fullSignaturesAdded = [];
    
    for (let returns of method.returns) {
      let signatures:Array<string> = [];
      let paramsArr = getParamsStringIn(iface, method.name, returns, method.body);
      
      // output += "\tMETHOD: " + method.name + "\n";
      // output += "\t" + method.body + "\n";
      if (paramsArr.length > 0) {
        for (let params of paramsArr) {
          // output += "\tPARAMS [o]: " + params + "\n";
          
          if (isStringDeclaration(params)) 
            signatures.push('type:string'); // TODO: change for an ENUM of types
          else {
            params = params.replace('[key, value,]...', '...[key, value]');
            params = params.replace(/\bfunction\b/g, 'a_function');
            params = params.replace('number[, number]', 'number[, boundNumber]')
            params = replaceArrays(params);
            params = fixTyping(params);
            params = replaceObjects(params);
            params = replaceThisOrThat(params); // TODO: generate separate signatures
            params = replaceBracketedRestParams(params);
            // params = replaceRestParams(params);
            params = replaceDotDotDot(params);
            // params = addNameToObjects(params);
            
            signatures = signatures.concat(generateOptionalPossibilitiesMatrix(params));
          }
        }
      }
      else 
        signatures.push('');
      
      let fullReturnIfaceName = getFullIfaceName(returns);
      
      // UNION RETURN TYPES:
      // let thisInterfaceExtension:Array<string> = [returns]; //interfaceExtensions[returns] || [];
      // thisInterfaceExtension.push(...interfaceExtensions[returns]);
      // if (iface != 'any')
      //   thisInterfaceExtension.push('any');
      // let returnTypesFullNames = thisInterfaceExtension.map(name => getFullIfaceName(name));
      // let fullReturnIfaceName = thisInterfaceExtension.map(name => getFullIfaceName(name)).join('|');
    
      for (let signature of signatures) {
        signature = removeDoubleCommas(signature);
        signature = removeBeginningAndTrailingCommas(signature);
        signature = restAndThenSomethingElse(signature);
        signature = replaceDotDotDot(signature);
        signature = signature.replace(/[a-zA-Z0-9_]+ \| , /g, '');
        signature = signature.replace(/ ,/g, ', ');
        signature = signature.trim();
        
        // add types:
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:[Nn]ame|[Ss]elector|attr)(?=,|$)/g, match => `${match}:string`);
        
        signature = signature.replace(/(?:[Nn]ames|[Ss]electors)(?=,|$)/g, match => `${match}:Array<string>`);
        
        signature = signature.replace(/(?:[Nn]umber[1-9]?|[Ii]ndex|\bn)(?=,|$)/g, match => `${match}:number`);
        
        signature = signature.replace(/(?:[Nn]umbers)(?=,|$)/g, match => `${match}:Array<number>`);
        
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:object)(?=,|$)/g, match => `${match}:Object`);
        
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:objects)(?=,|$)/g, match => `${match}:Array<Object>`);
        signature = signature.replace(/(?:object_or_a_functions)(?=,|$)/g, match => `${match}:Array<Object|Function>`);
        signature = signature.replace(/(?:object_or_a_function)(?=,|$)/g, match => `${match}:Object|Function`);
        signature = signature.replace(/(?:value_or_predicate_functions)(?=,|$)/g, match => `${match}:Array<string|Function>`);
        signature = signature.replace(/(?:field_or_a_function)(?=,|$)/g, match => `${match}:string|Function`);
        signature = signature.replace(/(?:functions)(?=,|$)/g, match => `${match}:Array<Function>`);
        // signature = signature.replace(/(?!and_then_)(?:a_function|[Cc]allback|Function)(?=,|$)/g, match => `${match}:Function`);
        // signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(a_function|[Cc]allback|[Ff]unction)(?=,|$)/g, match => `${match}:Function`)
        signature = signature.replace(/(\.\.\.[a-zA-Z]+_and_then_|_or_)*(:|\|)*(a_function|[Cc]allback|[Ff]unction)(?=,|$)/g, (match, one, two, three) => one === undefined && two === undefined ? `${match}:Function` : match)
        
        
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:[Ss]equence[1-9]?)(?=,|$)/g, match => `${match}:RSequenceInterface`);
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:[Tt]able[1-9]?)(?=,|$)/g, match => `${match}:RTableInterface`);
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:[Tt]ime[1-9]?)(?=,|$)/g, match => `${match}:RTimeInterface|Date`);
        signature = signature.replace(/((?!and_then_).{9}|^.{0,8})(?:[Aa]rray[1-9]?)(?=,|$)/g, match => `${match}:RArrayInterface|Array<any>`);
        
        signature = signature.replace(': false', ':boolean');
        signature = signature.replace('indexs', 'indexes');
        if (signature.indexOf('{') >= 0 && signature.indexOf('}') < 0)
          signature += '}'; // fix for "table.reconfigure"
        
        signature = signature.replace(/([a-zA-Z_]+_and_then_[a-zA-Z_]+)\??:[{ a-zA-Z?,:]+}/g, (match, name) => name);
        signature = signature.replace('options:', 'options?:');
        signature = signature.replace('options?:{ noreplyWait? }, callback:Function', 'options:{ noreplyWait? }, callback:Function');
          
        
        // TODO: if ...rest is not at the last param
        // replace ...rest with:
        // - rest1, {}
        // - rest1, rest2, {}
        // - rest1, rest2, ..., {} until 10 iterations 
        // or simpler - just add one more, where ...rest is the last one, called ...mimiAndTheRest
        // finally run 
        
        // for (let fullReturnIfaceName of returnTypesFullNames) {
          let fullSignature = `${method.name}(${signature}):${fullReturnIfaceName}`;
          if (method.name == 'coerceTo') fullSignature = `coerceTo<T extends RAnyInterface>(type:string):T`
          if (fullSignaturesAdded.indexOf(fullSignature) < 0) {
            fullSignaturesAdded.push(fullSignature);
          
            output += `
    ${fullSignature};`;
          }
        // }
        
        // output += "\t" + `PARAMS [${i}]: ` + signature + "\n";
      }
      
      // output += "\tRETURNS: " + returns + "\n\n";
      
      //method.returns ? method.returns.split('|').map(i => getFullIfaceName(i)).join('|') : 'void';
    }
  
//     let fullReturnIfaceName = method.returns ? method.returns.split('|').map(i => getFullIfaceName(i)).join('|') : 'void';
//     output += `
//   /**
//    * @body ${method.body}
//    * @description ${method.description}
//    * @example ${method.example}
//    * @url ${method.url}
//    */
//   ${method.name}:()=>${fullReturnIfaceName};
// `;

  }
  output += `
  }`;
}

output += `
}

declare module "rethinkdb" {
  var r:rethinkdb.RInterface;
  export = r;
}`

// console.log(output);

// let allIfaces = keys.map(v => getFullIfaceName(v)).join(', ');
// console.log(`// ${allIfaces}`);

console.log(tests);


/*
  "api/javascript/change_at/": {
    "body": "array.changeAt(index, value) &rarr; array", 
    "description": "<p>Change a value in an array at a given index. Returns the modified array.</p>", 
    "example": "<p><strong>Example:</strong> Bruce Banner hulks out.</p>\n<pre><code>r.expr([\"Iron Man\", \"Bruce\", \"Spider-Man\"]).changeAt(1, \"Hulk\").run(conn, callback)\n</code></pre>", 
    "io": [
      [
        "array", 
        "array"
      ], 
      [
        "singleSelection", 
        "stream"
      ]
    ], 
    "name": "changeAt", 
    "url": "change_at"
  }, 
  
  interface IR_singleSelection {
    /**
     * @body body
     * @description description
     * @example example
     *
    changeAt:()=>IStream
  }
  
  interface IArray {
    /**
     * @body body
     * @description description
     * @example example
     *
    changeAt:()=>Array
  }
*/