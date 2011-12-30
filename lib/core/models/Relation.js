var tools = require("../Tools");
var FlexObject = require("./FlexObject").FlexObject;
var API = require("../API");

exports.Relation = FlexObject.extend({
  
  //fieldnames: "type isNested isChildRecord isDirectRelation isMaster orderBy bucket primaryKey propertyName".w()
  schema: null,
  
  init: function(){ 
    // this needs to be done to prevent circular requires...
    var API = require('../API');
    this.schema = API.APISUBSCHEMAS.relation;
    arguments.callee.base.apply(this,arguments);
  }
  
});