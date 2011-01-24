/*
Some tools which may also reside in SC, but these tools sometimes are a bit more complex than needed
*/
if(!global.SC) require('./sc/runtime/core');
var sys = require('sys');
var path = require('path');

var copy = function(obj,debug){
  if(!obj) return obj;
  var i,ret,inObjType,objType = SC.typeOf(obj);
  if(objType === 'hash') ret = {};
  if(objType === 'array') ret = [];
  if(objType === 'number') ret = obj;
  if(objType === 'string') ret = obj;
  
  if(debug) sys.log("copying: objType: " + objType);
  if((objType === 'hash') || (objType === 'array')){
    for(i in obj){
      if(obj.hasOwnProperty(i)){
        inObjType = SC.typeOf(obj[i]);
        if(debug) sys.log("copying: inObjType: " + inObjType);
        if((inObjType === 'hash') || (inObjType === 'array')){
          ret[i] = copy(obj[i]); //recursive copy of nested objects or arrays
        } 
        else ret[i] = obj[i];        
      }
    }    
  }
  return ret;
};

var rootdir = function(module){
  if(!module.parent){
    return path.dirname(module.filename);
  }
  else return rootdir(module.parent);
};

var getRootPath = function(){
  //assume we always have a parent
  return rootdir(module);
};

var rootPath = getRootPath();

exports.rootPath = rootPath;
exports.libPath = rootPath + '/lib';
exports.corePath = rootPath + '/lib/core';
exports.tmpPath = rootPath + '/tmp';
exports.policiesPath = rootPath + '/policies';
exports.fixturesPath = rootPath + '/fixtures';

exports.getRootPath = getRootPath;

exports.copy = copy;

var generateCacheKey = function(){
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
};

exports.generateCacheKey = generateCacheKey;

