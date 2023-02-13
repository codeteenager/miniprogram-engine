/**
 * parse ml to ast
 */
const error = require('./error');
const MLParser = require('./MLParser.js');

exports.astParse = function (template = '', path, wcc) {
  let root;
  let wccError;
  let mlParser = new MLParser({
    onend: function (ast) {
      root = ast;
    },
    onerror: function (err) {
      wccError = err;
    }
  }, {
    path
  });
  if(process.platform === 'win32'){
    //fix new line
    template = template.replace(/\r\n/gm, '\n');
  }
  mlParser.write(template);
  mlParser.end();
  if (wccError) {
    return wccError;
  }
  root.info = {}; //attach extra info
  // console.log('ast:',  util.inspect(root, {depth:null,colors: true}) );
  return root;
}