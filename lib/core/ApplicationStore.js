/*

The application store is a extended wrapper store to enable running Thoth with a separate store per application.
This store depends on the application name in the store request to send requests to the right store

this store doesn't support cascading
*/
var WrapperStore = require('./WrapperStore').WrapperStore;

var ApplicationStore = WrapperStore.extend({
  
  applications: null, // array of arrays
  
  storeForResource: function(storeRequest){
    var appName = storeRequest.application,
        index,i,len=this.applications.length;
    if(appName && this.applications){
      for(i=0;i<len;i+=1){
        index = this.applications[i].indexOf(appName);
        if(index !== -1) return [this.stores[i]];
      }
      //still running? means not found...
      if(this.catchAllStoreIndex) return [this.stores[this.catchAllStoreIndex]];
    }
  }
  
});

exports.ApplicationStore = ApplicationStore;