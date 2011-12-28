var tools = require("../Tools");
var FlexObject = require("./FlexObject").FlexObject;

exports.Relation = SC.Object.extend({
  
  fieldnames: "type isNested isChildRecord isDirectRelation isMaster orderBy bucket primaryKey propertyName".w()
  
});