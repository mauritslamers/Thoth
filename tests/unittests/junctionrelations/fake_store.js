var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;

exports.FakeStore = Thoth.Store.extend(Thoth.mixins.junctionRelations,{
  automaticRelations: true,
  
  cb: null,
  
  fetchDBRecords: function(){
    this.cb.apply(this,arguments);
  },
  
  refreshDBRecord: function(){
    this.cb.apply(this,arguments);    
  },
  
  createDBRecord: function(){
    this.cb.apply(this,arguments);    
  },
  
  updateDBRecord: function(){
    this.cb.apply(this,arguments);    
  },
  
  deleteDBRecord: function(){
    this.cb.apply(this,arguments);    
  }
});