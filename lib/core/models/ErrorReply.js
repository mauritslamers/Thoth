var tools = require('../Tools');
var FlexObject = require('./FlexObject').FlexObject;   
var C = require('../Constants');

var ErrorReply = FlexObject.extend({
  
  schema: null,
  
  init: function(){ 
    // this needs to be done to prevent circular requires...
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_ERROR_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});
       
ErrorReply.from = function(error,returnData){  
  var msg, code;
  switch(error){
		case C.ERROR_DENIEDONPOLICY: 
		  msg = 'Denied on policy'; 
		  break;
		case C.ERROR_DATAINCONSISTENCY: 
		  msg = "Inconsistency in request"; 
		  break;
		case C.ERROR_RPCNOTLOADED: 
		  msg = "RPC module not loaded";
		  break;
		default: msg = "Undefined error";
	}
  
  var ret = ErrorReply.create({
     code: error,
     message: msg,
     returnData: returnData
  });
  return ret;
};

exports.ErrorReply = ErrorReply;