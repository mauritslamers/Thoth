var sys = require('sys');
var fs = require('fs');
var formidable = require('../node-formidable');
var util = require('../node-formidable/lib/util');
var im = require('../node-imagemagick');

// This file was copied and modified from RPCHooks.js.
//
// On the client side, github.com/publickeating/sproutcore-upload FileFieldView
// was modified to work with this system. The use of FileFieldView is:
//
//    photoUpload: SC.FileFieldView.design({
//      layout: { left: 17, right: 14, top: 140, height: 36 },
//      buttonTitle : "Add Image",
//      buttonTheme : 'normal',
//      displaysSelectedFilename : YES,
//      formAction : '/thoth/images',   // This will have the upload cacheKey appended
//      autoSubmit: YES,                // Fire when ready
//      numberOfFiles: 1,
//      isProgressive: NO,              // There will only be one input button (but it can be used repeatedly)
//      delegate: MyApp.someController  // See below for how to configure this.
//    }),
// 
//
// The publickeating SC.FileFieldView code was modified:
//
//   -- didCreateLayer()
//
//       Instead of 
//
//           this._createForm();
//       
//       we have a call to the app's statechart:
//       
//           MyApp.statechart.sendEvent('prepareForUpload');
//
//           An uploadRequest, for ThothSC, is created to 
//           send credentials and to do a policy check for 
//           the upload operation. A callback is set up to 
//           continue the form view creation (a cacheKey is
//           returned from the server). See below...
// 
//   -- createForm()
//
//       This method is modified to take a cacheKey parameter,
//
//       createForm(cacheKey)...
//
//       createForm(cacheKey) is called when the server returns
//       from the uploadRequest. If a popup view is used to hold
//       the publickeating FileFieldView, the callback function for
//       the uploadRequest can do something like:
//
//       ...someUploadPopup.getPath('contentView.photoUpload').createForm(data.cacheKey);
//
//       Note the use of action in createForm(). action is provided when the view is created,
//       as formAction, and becomes the first part of the url created for the upload. In the 
//       render method, we have
//
//       action: "%@/%@?X-Progress-ID=%@".fmt(this.get('action'), cacheKey, this.get('uuid')), 
//
//       This url becomes: "/thoth/images/SOME_CACHE_KEY?X-Progress-ID=SOME_UUID".
//
//       The ?X-Progress-ID=SOME_UUID part of the url is added by FileFileView for use with
//       a facility such as nginx's upload progress module. It is not used in the system 
//       described here, because Thoth handles this via node-formidable, but having this
//       tacked on the end of the url doesn't hurt anything.
//
//  When the input button on the form is clicked, the url is submitted. For development, you 
//  need a proxy for /images as you probably already have for /thoth. For example, 
//
//    proxy '/thoth', :to => 'localhost:8080'
//    proxy '/images', :to => 'localhost'
//
//    proxy '/thoth' does the normal proxy setup for /thoth,
//    and proxy '/images' goes to localhost where nginx is configured to proxy, in turn, to the
//    absolute file path for the .../images dir, where Thoth/node-formidable will put the files.
//
// With this configuration and modification of publickeating FileUploadView,
// the input button will send the chosen file to the 'action:' url as above. The delegate for the
// FileFieldView will start the upload polling. 
//
//  -- someController, acting as delegate for FileFieldView (See docs for FileFieldView)
//
//      fileFieldViewDidSubmit: function(fileFieldView, cacheKey, uuid) {
//        var req = SC.Request.getUrl('/thoth/progress').json().notify(this.uploadPollManager, 'pollDidRespond');
//
//        this.set('uploadPollRequest', req);
//        this.set('isUploading', YES);
//        this.set('uploadIsRunning', YES);
//        this.get('uploadPollManager').start();
//      },
// 
//      where this.uploadPollManager is created along the lines described here:
//
//      http://wiki.sproutcore.com/w/page/12412900/Foundation-Ajax%20Requests
//
//      Note the use of the /progress part of the request url. This is handled in Thoth's Server.js, where
//      an uploadProgress percentage is returned.
//
//    In the delegate's fileFieldViewDidComplete, which receives the final upload response from the server,
//    as result, result.imageURL will be the url for the uploaded file. Thumbnails created by the server will 
//    be at the same url, with the following filename convention: 
//
//        'tn' +  32 + 'x' +  32 + '_' + data.filename;
//
//        e.g., tn32x32_some_uploaded_file.jpg
//
// ThothSC has modifications so that a new upload.js file, along the lines of RPC.js, contains code for
// handling uploadRequests. The requests sent to Thoth for /progress are sent directly from the app, not
// via ThothSC.
//

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
  performImageUpload: function(request, callback) {
    var form = new formidable.IncomingForm(), files = [], fields = [];

    form.uploadDir = './tmp';

    sys.log('performImageUpload called, calling formidable');

    this.proxyDir = './images';
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
        //sys.log("performImageUpload: upload done, now renaming files");
        //sys.log('files............. ' + sys.inspect(files));
        //sys.log('filename............. ' + files.Filedata.filename);
        var file = files['files[]'];
        var proxyPath = me.proxyDir + '/' + file.filename;
        sys.log('proxyPath: ' + proxyPath);
        sys.log('file.path : ' + file.path);
        fs.rename(file.path, proxyPath, function(err) {
          if (err) {
            //sys.log("performImageUpload: renaming: error: " + err);
            callback({ message: 'error renaming uploaded file'});
          } else {
            // node-imagemagick is used to get the width and height of the uploaded image
            //im.identify(['-format', '%b', proxyPath], function(err, features){ 
            im.identify(['-format', '%wx%h', proxyPath], function(err, output){
            //im.identify(proxyPath, function(err, features){
              if (err) {
                sys.log('im.identify error!');
                callback(SC.Error.create({ message: 'There was a problem im.identifying your uploaded image.'}));
              } else {
                console.log('im.identify ' + output);
                // { format: 'JPEG', width: 3904, height: 2622, depth: 8 }
                var width = parseInt(output.split('x')[0]),
                    height = parseInt(output.split('x')[1]);

                callback({ mimeType: 'text/url', imageWidth: width, imageHeight: height, filePath: proxyPath, filename: file.filename });
              }
            });
          }
        });
      }
    });
  }
});
