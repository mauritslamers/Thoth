/*
myUploadHooks sample

make sure the callback is called with an object:

{ mimeType: '', responseObject: '', filePath: '' }

in case your mimeType is 'application/json', the server will return JSON stringified 
responseObject as the result of your Upload call

in any other case, the server will assume you are sending a binary file.
the responseJSON will be ignored, and the filePath will be retrieved from your response
The server will then generate a single-use key the client can use to retrieve the
result of the Upload action.
So your function has to return the filePath where the server can find the file.

*/

var mimeTypeJSON = 'application/json';
var sys = require('sys');

//exports.myFunc = function(params,callback){
//    callback({ mimeType: mimeTypeJSON, responseObject: {message: "This is a nice answer"} });
//};

_associatedItemsCache = null; // array of { bucket, key, property } items         ; presently unused
_opRequestsQueue = null; // e.g., resize, crop, rotate, zip, cp, mv               ; presently unused

exports.prepareForUpload = function(params,callback){
  var permission,
      userData = params.userData,
      opRequests = params.opRequests,  // originally used to do thumbnail sizes on request; presently unused
      associated = params.associated;  // originally was to be used to distribute messages to associated records; presently unused
      
  sys.log('prepareForUpload called');

  // Should remove the simple userData checks here, and rely on policy framework, which pairs user names
  // with resource (bucket) lists.
  
  // Associated records could still be a good idea, for distribution.
  
  // This only has a hard-coded development username and password
  if (userData.username === 'admin' && userData.password === 'querty') {
    permission = 'granted';
    this._associatedItemsCache = associated; // presently unused for anything
    this._opRequestsQueue = opRequests;      // presently unused for anything

    //sys.log('permission granted and cache and queue set');
  } else {
    permission = 'denied';
  }

  // other things to check ...
  //
  //   - is there already a file by that name? if so, check policy, maybe return a message
  //   - if fotofoo style directory handling (for uploaded images) is used, could create the dir if needed, etc.
  //   -

  //sys.log('permission is ' + permission + ' and calling callback now');
  callback({ mimeType: mimeTypeJSON, responseObject: { permission: permission} });
};

//
// some previous work (this kind of code was moved to lib/core in the upload module there):
//
//exports.uploadImageAndProcess = function(params,callback){
//  var formData = params.formData,
//      cacheKey = params.cacheKey,
//      spawn = require('child_process').spawn,
//      fs = require('fs'),
//      sys = require('sys'),
//      formidable = require('./lib/node-formidable/lib/formidable'),
//      util = require('./lib/node-formidable/lib/formidable/util'),
//      form = new formidable.IncomingForm(),
//      files = [],
//      fields = [];
//
//  // get the temporary url
//
//  form.uploadDir = './tmp';
//
//  sys.log('uploadImageAndProcess called, calling formidable');
//  sys.log(util.inspect(formData));
//  form
//    .on('field', function(field, value) {
//      p([field, value]);
//      fields.push([field, value]);
//    })
//    .on('file', function(field, file) {
//      p([field, file]);
//      files.push([field, file]);
//    })
//    .on('end', function() {
//      sys.log("processIamgeAfterUpload: upload done, now renaming " + files[0][1]);
//      var pathHash = form.uploadDir + '/' + files[0][1],
//          pathNormal = form.uploadDir + '/' + params.filename;
//
//      var promise = fs.rename(pathHash, pathNormal);
//      promise.addCallback(function() {
//        if(err) sys.log("Upload: uploadImageAndProcess: error: " + err);
//        sys.log('Upload uploadImageAndProcess: starting imagemagick query');
//        var improc = spawn('identify',["-format",'"%w,%h"', pathNormal]);
//        improc.on('exit', function(code){
//          // clean up and send back filepath
//          sys.log('process for uploadCacheKey ' + cacheKey + ' exited with code: ' + code);
//          callback({ mimeType: 'text/url', filePath: 'something urlish ' + pathNormal});
//        });
//      });
//    });
//  form.parse(formData);
//
//};
//

//exports.createPdfFromTex = function(params,callback){
//  var texSource = params.texSource;
//  var cacheKey = params.cacheKey;
//  var spawn = require('child_process').spawn;
//  var fs = require('fs');
//  sys.log('createPdfFromTex called, writing tmp file');
//  var tmpTexFileBasename = "./tmp/tex_" + cacheKey;
//  var tmpTexFilename = tmpTexFileBasename + ".tex";
//  var tmpLogFilename = tmpTexFileBasename + ".log";
//  var tmpAuxFilename = tmpTexFileBasename + ".aux";
//  var tmpOutFilename = tmpTexFileBasename + ".out";
//  var tmpPDFFilename = tmpTexFileBasename + ".pdf";
//  sys.log("createPdfFromTex: writing tex to " + tmpTexFilename);
//  fs.writeFile(tmpTexFilename,texSource,'utf8',function(err){
//    if(err) sys.log("RPC: createPdfFromTex: error: " + err);
//    sys.log('RPC: createPdfFromTex: starting tex conversion');
//    var texproc = spawn('pdflatex',["-output-directory=./tmp",tmpTexFilename]);
//    texproc.on('exit', function(code){
//        // clean up and send back filepath
//        sys.log('process for rpcCacheKey ' + cacheKey + ' exited with code: ' + code);
//        fs.unlink(tmpLogFilename);
//        fs.unlink(tmpAuxFilename);
//        fs.unlink(tmpTexFilename);
//        fs.unlink(tmpOutFilename);
//        callback({ mimeType: 'application/pdf', filePath: tmpPDFFilename});
//    });
//  });
//};

// A more recent version:
//
// exports.createPdfFromTex = function(params,callback){
//   var texSource = params.texSource;
//   // replace hku_logo.pdf if found
//   var cacheKey = params.cacheKey;
//   var rootPath = Tools.getRootPath();
//   texSource = texSource.replace(/{hku_logo}/g,"{"+rootPath+"/hku_logo}");
//   var spawn = require('child_process').spawn;
//   var fs = require('fs');
//   sys.log('createPdfFromTex called, writing tmp file');
//   var tmpTexFileBasename = rootPath + "/tmp/tex_" + cacheKey;
//   var tmpTexFilename = tmpTexFileBasename + ".tex";
//   var tmpLogFilename = tmpTexFileBasename + ".log";
//   var tmpAuxFilename = tmpTexFileBasename + ".aux";
//   var tmpOutFilename = tmpTexFileBasename + ".out";
//   var tmpPDFFilename = tmpTexFileBasename + ".pdf";
//   sys.log("createPdfFromTex: writing tex to " + tmpTexFilename);
//   fs.writeFile(tmpTexFilename,texSource,'utf8',function(err){
//   if(err){
//     sys.log("RPC: createPdfFromTex: error: " + err);
//     return;
//   } 
//   sys.log('RPC: createPdfFromTex: starting tex conversion');
//   var texproc = spawn('pdflatex',["-halt-on-error","-output-directory=" + rootPath + "/tmp",tmpTexFilename]);
//   texproc.on('exit', function(code){
//     // clean up and send back filepath
//     sys.log('process for rpcCacheKey ' + cacheKey + ' exited with code: ' + code);
//     if(code === 0){
//       fs.unlink(tmpLogFilename);
//       fs.unlink(tmpAuxFilename);
//       fs.unlink(tmpTexFilename);
//       fs.unlink(tmpOutFilename);
//       callback({ mimeType: 'application/pdf', filePath: tmpPDFFilename});
//     }
//   });
// });
//

//// this is from fotofoo
//var childProcess = require('child_process');
//
//var Magick = {};
//
//Magick.Image = function (path) {
//  if (!path) throw Error("Must provide an image path");
//  this._path = path;
//  this._WHITESPACE_RE = /(\s)/g;
//};
//
//Magick.Image.prototype = {
//  dimensions: function (callback) {
//    this._run(['identify', '-format', '"%w,%h"'], function (output) {
//      var dim = output.trim().split(',');
//      callback(parseInt(dim[0]), parseInt(dim[1]));
//    });
//  },
//
//  thumbnail: function(width, height, callback) {
//    var image = this;
//    this._run(['mogrify', '-thumbnail', width + 'x' + height], function (output) {
//      image.dimensions(function (width, height) {
//        callback(width, height);
//      });
//    });
//  },
//
//  _run: function (args, callback) {
//    var shellPath = this._path.replace(this._WHITESPACE_RE, '\\$1'),
//        cmd = ['gm', args.join(' '), shellPath].join(' ');
//    childProcess.exec(cmd, function (err, stdout, stderr) {
//      if (err) throw err;
//      callback(stdout);
//    });
//  }
//};

//exports.image = function (path, callback) {
//    return new Magick.Image(path);
//};
