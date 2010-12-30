/*
Some tools which may also reside in SC, but these tools sometimes are a bit more complex than needed
*/
if(!global.SC) require('./sc/runtime/core');


var copy = function(obj){
  if(!obj) return obj;
  var i,ret,inObjType,objType = SC.typeOf(obj);
  if(objType === 'hash') ret = {};
  if(objType === 'array') ret = [];
  if(objType === 'number') ret = obj;
  if(objType === 'string') ret = obj;
  
  if((objType === 'hash') || (objType === 'array')){
    for(i in obj){
      inObjType = SC.typeOf(obj[i]);
      if((inObjType === 'hash') || (inObjType === 'array')){
        ret[i] = copy(obj[i]); //recursive copy of nested objects or arrays
      } 
      else ret[i] = obj[i];
    }    
  }
  return ret;
};


exports.copy = copy;
