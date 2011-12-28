var tools = require("../Tools");

exports.FlexObject = SC.Object.extend({
  
  fieldnames: null, // fieldnames is a list of property names that this object should use
    
  json: function(){
    var fieldnames = this.get('fieldnames');
    var ret = {};
    var f = function(fn){
      var val = this.get(fn);
      if(val instanceof Array) ret[fn] = val.getEach('json');
      else ret[fn] = this.get(fn);
    };
    
    if(fieldnames) fieldnames.forEach(f);
    return ret;
  }.property()  
});