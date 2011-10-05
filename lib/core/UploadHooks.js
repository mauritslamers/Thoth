var sys = require('sys');
var fs = require('fs');
var formidable = require('../node-formidable');
var util = require('../node-formidable/lib/util');
var im = require('../node-imagemagick');

// This file was copied and modified from RPCHooks.js.

exports.UploadHooks = SC.Object.extend({
   
   uploadHooksFile: null, // file name to load
    
   _uploadHooks: null, // object to put the loaded file to
   
   _uploadRequestResult: null, // cache to save the information needed to return a specific request
                     // best to be an object: 
                     // { 'cachekey': { mimeType: '', filePath: '' } }

   uploadProgress: 10.5,

   // Call functionName with params and a callback
   callUploadFunction: function(functionName, params, callback){
      //sys.log('ThothUploadHooks: callUploadFunction called');
      //sys.log('for function ' + functionName);
      //sys.log('with these params ' + params.toString());
      if(!this._uploadHooks){
         if(!this.uploadHooksFile) sys.log("No uploadHooksFile defined on UploadHooks Module");
         else {
            var upload = require("../." + this.uploadHooksFile);  // this file is in Thoth root
            if(!upload) return NO;
            else this._uploadHooks = upload;            
         }
      }
      var func = this._uploadHooks[functionName],
          me = this;
      if(func){
         var cacheKey = me.generateCacheKey();
         params.cacheKey = cacheKey; // give function access to cacheKey for tmpfile stuff
         func(params,function(result,isURL){
            //{ mimeType: '', responseObject: '', filePath: '' }
            var ret = { uploadRequestResult: {} };
            var mimeType = result.mimeType,
                record = result.responseObject;
            if(mimeType === 'application/json'){              // if func returns json, just call passed-in callback
               ret.uploadRequestResult.record = record;
               ret.uploadRequestResult.cacheKey = cacheKey;
               sys.log('calling back');
               callback(ret);
            }
            else {                                            // otherwise, func created a file, so store filepath, then call passed-in callback
               var filePath = result.filePath;
               if(!me._uploadRequestResult) me._uploadRequestResult = {};
               me._uploadRequestResult[cacheKey] = { mimeType: mimeType, filePath: filePath };
               ret.uploadRequestResult.cacheKey = cacheKey;
               callback(ret);
            }
         });
      }
      else {
         callback({ uploadError: "Error"}); // don't let the message be too obvious...
      }
      return false; // just to return something to get rid of strict: "warning: anonymous function does not always return a value"
   },
   
   // Not used so far
   uploadRetrieve: function(cacheKey,callback){
      // function to return the file from the request
      // it should also clean up the file after the response has been completed
      // function should use the callback to notify the client
      // syntax: callback(mimeType,data);
      sys.log("ThothUploadHooks: uploadRetrieve called");
      var uploadResponse = this._uploadResult[cacheKey];
      var me = this; // needed by the clean up
      if(uploadResponse && uploadResponse.filePath && uploadResponse.mimeType){
         var filePath = uploadResponse.filePath, mimeType = uploadResponse.mimeType;
         sys.log("ThothUploadHooks: about to read file: " + filePath);
         fs.readFile(filePath,function(err,data){
            if(err){
               sys.log("ThothUploadHooks: Error while reading: " + err);
               callback(null);
            } 
            else {
               callback(mimeType,data);
               fs.unlink(filePath);
               delete me._uploadCache[cacheKey]; 
            } 
         });
      }
      else {
         delete this._uploadResult[cacheKey]; // clean up
         callback(null);
      }
   },
   
   generateCacheKey: function(){
      // the idea for this method was copied from the php site: 
      // http://www.php.net/manual/en/function.session-regenerate-id.php#60478
      var keyLength = 32,
          keySource = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
          keySourceLength = keySource.length + 1, // we need to add one, to make sure the last character will be used in generating the key
          ret = [],
          curCharIndex = 0;
      
      for(var i=0;i<=keyLength;i++){
         curCharIndex = Math.floor(Math.random()*keySourceLength);
         ret.push(keySource[curCharIndex]);
      }
      return ret.join('');
   },

  // The following setup is for use of node-formidable to do the file uploading
  //
  // as written, assumes single file in field called 'files[]'
  performUpload: function(request, callback) {
    var form = new formidable.IncomingForm(), files = [], fields = [];

    form.uploadDir = './upload';

    sys.log('performUpload called, calling formidable');

    this.proxyDir = './upload';
    var me = this;

    this.uploadProgress = 0.0;

    form
      .on('field', function(field, value) {
        sys.log('[field, value] ' + [field, value]);
        fields.push([field, value]);
      })
      .on('file', function(field, file) {
        sys.log('[field, file] ' + [field, file]);
        files.push([field, file]);
      })
      .on('end', function() {
        sys.log('-> upload done');
        //sys.log('received fields:\n\n '+util.inspect(fields));
        //sys.log('received files:\n\n '+util.inspect(files));
      });
    
    // Other methods of monitoring progress, e.g. with on('progress', ...
    // did not work.
    form.addListener("progress", function(bytesReceived, bytesExpected) {
      //progress as percentage
      var progress = (bytesReceived / bytesExpected * 100).toFixed(2);
      var mb = (bytesExpected / 1024 / 1024).toFixed(1);
      //sys.log("Uploading "+mb+"mb ("+progress+"%)\015");
      //
      // uploadProgress is read when there are upload polling requests
      // and reported back to client.
      //
      me.uploadProgress = progress;
    });
      
    form.parse(request, function(error, fields, files) {
      if (error) {
        callback({ message: 'error parsing upload data'});
      } else {
        //sys.log("performUpload: upload done, now renaming files");
        //sys.log('files............. ' + sys.inspect(files));
        //sys.log('filename............. ' + files.Filedata.filename);
        var file = files['files[]'];
        var proxyPath = me.proxyDir + '/' + file.filename;
        //sys.log('proxyPath: ' + proxyPath);
        //sys.log('file.path : ' + file.path);
        fs.rename(file.path, proxyPath, function(err) {
          if (err) {
            //sys.log("performUpload: renaming: error: " + err);
            callback({ message: 'error renaming uploaded file'});
          } else {
            // node-imagemagick is used to get the width and height of the uploaded image
            im.identify(proxyPath, function(err, features){
              if (err) throw err;
              //console.log('im.identify ' + sys.inspect(features));
              // { format: 'JPEG', width: 3904, height: 2622, depth: 8 }
              callback({ mimeType: 'text/url', imageFeatures: features, filePath: proxyPath, filename: file.filename });
            });
          }
        });
      }
    });
  }
});
