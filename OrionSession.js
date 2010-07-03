/*
OrionSession class: to keep track of logged in users and to have timeouts checked
*/

if(!global.SC) require('./sc/runtime/core');

var querystring = require('querystring'); // for session key parsing
var sys = require('sys');

global.OrionSession = SC.Object.extend({
   
   sessionName: 'OrionNodeRiak', // lets choose some strange default
   
   sessionCookieExpireDuration: 31, // duration in days
   
   timeOutDuration: 15, //(timeout in minutes) 15 minutes standard 
   

   /*
     _loggedInUsers is an object containing objects which contain information about the last time a specific user has been seen
     or heard of, and the sessionkey the user is using.
     so something like: 
     { 'user': 
         { 
            sessionKey: '',
            lastSeen: date in milliseconds
         }
     }
     
     every time a user makes contact, the current date is compared to the lastSeen date, and if the difference is larger than the 
     given timeOutDuration, the user is automatically logged out. It means the user information is removed from the 
     _loggedInUsers object which should then automatically lead to be forced to login again...
    
    // this setup doesn't allow for the same user to be logged in in multiple places at once, atm
    // while that absolutely should be something valuable 
    // maybe check with browser id's? or IP's? or just allow people to login twice and 
    // store two session keys or even more if that is helpful...     
     
     
   */
   
   _loggedInUsers: {},  // an object containing objects containing info

   _timeOutDurationCache: null, // to cache the calculation of timeOutDuration to milliseconds
   
   checkSession: function(user,sessionInfo){
      // function to check whether a user is still logged in
      // sessionInfo is the entire string of data sent by the client in the Cookie header of the request
      // it may be wise to have the user name in a http header to make session hijacking a bit more difficult
      // lets force that behaviour for the moment, and rewrite the stuff when a better way can be found
      
      // process sessionInfo
      var sessionInfoObj = querystring.parse(sessionInfo,';','=');
      var sessionName = this.sessionName;
      sys.puts(sys.inspect(sessionInfoObj));
      // returns YES or NO depending on whether the user is still logged in
      var timeout_in_ms = this._timeOutDurationCache;
      if(!timeout_in_ms){ // if there is no cache yet, create it
         timeout_in_ms = this.timeOutDuration * 60 * 1000;
         this._timeOutDurationCache = timeout_in_ms;
      }
      var curUserData = null;
      if(user){
         curUserData = this._loggedInUsers[user]; // get the user data
      }
      if(curUserData){ // if it exists, check it
         var lastSeen = curUserData.lastSeen;
         var now = new Date().getTime();
         if((now - lastSeen) > timeout_in_ms){ // diff between lastseen and now too large?
            // delete user key
            this._loggedInUsers[user] = undefined;
            return NO;
         }
         else { // active session
            // first set the new date to now
            this._loggedInUsers[user].lastSeen = now; // update the actual user data
            return YES; // use cached data for speed.
         }
      }
      else return NO;
   },
   
   createSession: function(user){
      // a function to create a user session when a user has logged in successfully
      // the function returns the set-cookie header info

      // first create a session key
      var newSessionKey = this.generateSessionKey();
      // then set the user information and overwrite any existing stuff
      this._loggedInUsers[user] = { 
         sessionKey: newSessionKey,
         lastSeen: new Date().getTime()
         };
      var sessionName = this.sessionName;
      var expDate = new Date();
      expDate.setDate(expDate.getDate() + 31);
      var headerInfo = sessionName + '=' + newSessionKey + '; expires=' + expDate.toString();
      return headerInfo;
   },
   
   generateSessionKey: function(){
      // the idea for this method was copied from the php site: 
      // http://www.php.net/manual/en/function.session-regenerate-id.php#60478
      var keyLength = 32,
          keySource = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
          keySourceLength = keySource.length + 1, // we need to add one, to make sure the last character will be used in generating the key
          ret = [],
          curCharIndex = 0;
      
      for(var i=0;i<=keyLength;i++){
         curCharIndex = Math.floor(Math.random()*keySourceLength);
         ret.push(keySource[curCharIndex]);
      }
      return ret.join('');
   } 
   
});
