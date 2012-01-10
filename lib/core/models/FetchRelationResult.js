var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

var FetchRelationResult = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_FETCH_RELATION_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});

FetchRelationResult.from = function(relSet, returnData){
  var ret;
  if(relSet){
    ret = FetchRelationResult.create({
      relationSet: [relSet],
      returnData: returnData
    });                      
  }                                          
  return ret;
};

exports.FetchRelationResult = FetchRelationResult;