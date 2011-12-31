var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

exports.FetchResult = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_FETCH_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});