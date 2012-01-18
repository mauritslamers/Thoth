var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

var RelationReply = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_FETCH_RELATION_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});

RelationReply.from = function(relSet, returnData){
  var ret;
  if(relSet){
    ret = RelationReply.create({
      relationSet: [relSet],
      returnData: returnData
    });                      
  }                                          
  return ret;
};

exports.RelationReply = RelationReply;