/*
model for an authentication plugin

*/
if(!global.SC) require('./sc/runtime/core');

global.OrionAuth = SC.Object.extend({
   
   rootUser: null,
   
   rootPassword: null,
   
   rootPasswordIsMD5: false,
   
   checkAuth: function(user,passwd,passwdIsMD5,callback){
      // one function for both standard auth as MD5
      // it uses a callback to do stuff node style, as a request might take some time...
      // the callback is called with an object with an authenticated and isRoot property
      var ret = {
         authenticated: NO,
         isRoot: NO
      };
      if(user === this.rootUser){
         if(this.rootPassword === passwd) {
            ret.isRoot = YES;
            ret.authenticated = YES;
         }
      }
      callback(ret);
   }
   
});