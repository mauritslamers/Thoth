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
      // the callback should be called with an object containing at least the user name and the role on a successful authentication
      var ret = {
         userName: '',
         role: null
      };
      if(user === this.rootUser){
         if(this.rootPassword === passwd) {
            ret.role = "root";
            ret.user = user;
         }
      }
      var authenticated = this.doSomeCheck();
      if(authenticated){
         callback(ret);
      }
      else {
         callback(NO);
      }
   }
   
});