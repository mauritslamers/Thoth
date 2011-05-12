/*

The application store is a extended wrapper store to enable running Thoth with a separate store per application.
This store depends on the application name in the store request to send requests to the right store

this store doesn't support cascading
*/
var WrapperStore = require('./WrapperStore');

var ApplicationStore = WrapperStore.extend({
  
  applications: null,
  
  storeForResource: function(storeRequest){
    var appName = storeRequest.application,
        index;
    if(appName && this.applications){
      index = this.applications.indexOf(appName);
      if(index !== -1) return this.stores[index];
      else {
        if(this.catchAllStoreIndex) return this.stores[this.catchAllStoreIndex];
      }
    }
  }
  
});

exports.ApplicationStore = ApplicationStore;