var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;
var C = require('../Constants');

exports.FetchRelationResult = FlexObject.extend({

  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISCHEMAS[C.ACTION_FETCH_RELATION_REPLY];
    arguments.callee.base.apply(this,arguments);
  }
});