var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

exports.RefreshRecordReply = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_REFRESH_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});
