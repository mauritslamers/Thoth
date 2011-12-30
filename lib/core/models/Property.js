var tools = require("../Tools");
var FlexObject = require('./FlexObject').FlexObject;

exports.Property = FlexObject.extend({
  //fieldnames: "computation dependencies".w()
  schema: null,
  
  init: function(){
    var API = require('../API');
    this.schema = API.APISUBSCHEMAS.property;
    arguments.callee.base.apply(this,arguments);
  }
});

