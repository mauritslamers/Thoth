
var fs = require('fs');
var sys = require('sys');
require('./core/Auth');
var LDAP = require('./node-ldap/LDAP');

global.ThothLDAPAuth = ThothAuth.extend({
  
  LDAPHost: null, // common LDAP host. if null, the checkAuth function will try to extract it from the user name
  
  // while this doesn't necessarily needs to be done in functions, it is done
  // to make it easy to override without having to rewrite the checkAuth function.
  retrieveLDAPHost: function(username){ 
    return username.split('@')[1];// expecting a user name in the form 'some.user@somehost'
  },
  
  retrieveUsername: function(username){
    return username.split('@')[0];
  },
  
  checkAuth: function(user,passwd,passwdIsMD5,callback){
    var ldaphost, ldapuser, lconn;
    
    if(user && passwd && !passwdIsMD5){ // don't allow MD5 passwords
      ldaphost = this.LDAPHost? this.LDAPHost: this.retrieveLDAPHost(user);
      ldapuser = this.LDAPHost? user: this.retrieveUsername(user);
      if(ldaphost && ldapuser){
        lconn = new LDAP.Connection();

        // Open a connection. 
        lconn.Open("ldap://" + ldaphost);

        lconn.Authenticate("cn=" + ldapuser, passwd , function(res) {
            // authenticated. do a callback
            callback({
              user: ldapuser,
              role: 'test' // need to have a proper way to set the role.. external config file?
            });
        });
      }
      else {
        //error
      }
    }
    else {
      callback(NO);
    }
  }
});