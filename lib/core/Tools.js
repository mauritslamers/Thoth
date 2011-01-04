/*
Some tools which may also reside in SC, but these tools sometimes are a bit more complex than needed
*/
if(!global.SC) require('./sc/runtime/core');
var sys = require('sys');

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


exports.copy = copy;
