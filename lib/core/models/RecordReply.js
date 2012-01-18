var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

var RecordReply = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_RECORD_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});                                             

RecordReply.from = function(storeRequest, record, returnData){
  return RecordReply.create({
    bucket: storeRequest.get('bucket'),
    key: record[storeRequest.get('primaryKey')],
    record: record || storeRequest.get('record'),
    returnData: returnData || storeRequest.get('returnData')
  });
};

exports.RecordReply = RecordReply;


