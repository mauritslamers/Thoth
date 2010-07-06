var http = require('http'), 
		url = require('url'),
		fs = require('fs'),
		//socketIoServer = require('./socket-io-server/lib/socket.io'),
		sys = require('sys'),
      send404 = function(res){
	      res.writeHead(404);
	      res.write('404');
	      res.end();
      };

if(!global.SC) require('./sc/runtime/core');

require('./OrionFileAuth');
require('./OrionSession');
require('./OrionSocketListener');
/*
The idea behind this Node.js OrionServer is to have a node-js server
that is reached using a apache proxy to overcome same-origin-policy trouble

The way requests are handled is more or less the same as a normal REST interface,
that is that the websocket connection uses a format that is comparable to the http requests:

{"get":"model/id"}
{"post":"model"}
{"put":"model/id"}
{"delete":"model/id"}


*/
global.OrionServer = SC.Object.extend({
   models: [], // an array of model objects
   
   allowWebSocket: true,
   
   forceAuth: true,
   
   forceMD5Auth: false,
   
   authModule: null,
   
   sessionModule: OrionSession.create({ sessionName: 'OrionServerTest' }),
   
   store: null, // place to bind the store / data source to
   
   createHTTPHandler: function(serverObj){
      return function(request, response){
         var path = url.parse(request.url).pathname;
         var method = request.method;
         if(path === '/'){
            //send404(response);
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.write("request URL: " + request.url + "<br>");
            response.write("request path: " + path + "<br>");
            response.end();
         }
         else {
            if(serverObj.forceAuth){ 
               var resource = path.slice(1);
               // make sure that the user is authenticated, 
               // but only after we found out the current request doesn't turn out to be an auth request
               if(method === 'POST' && resource == 'auth'){ // force auth with posting
                  var authdata = "";
                  request.addListener("data", function(chunk){ // gather data
                     authdata += chunk;
                  });
                  request.addListener("end", function(){ // finished gathering data, call AUTH
                     serverObj.AUTH(request,authdata,response);
                  });
               }
               else { // if not an auth request, check whether the user has a session
                  //sys.puts(sys.inspect(request));
                  var receivedCookieHeader = request.headers['cookie'];
                  var receivedUserName = request.headers['username'];
                  sys.puts('cookieHeader received: ' + receivedCookieHeader);
                  if(receivedCookieHeader && receivedUserName){
                     //check the session
                     var hasSession = serverObj.sessionModule.checkSession(receivedUserName,receivedCookieHeader);
                     if(!hasSession){
                        response.writeHead(403, {'Content-Type':'text/html'});
                        response.write('Not logged in, invalid cookie'); // this can be much more fancy of course!
                        response.end();                        
                        return;
                     } // do nothing else, let flow continue to the switch(method) below
                  }
                  else {
                     response.writeHead(403, {'Content-Type':'text/html'});
                     response.write('Not logged in, no cookie information found'); // this can be much more fancy of course!
                     response.end(); 
                     return;
                  }
               }
            }
            switch(method){
               case 'GET': serverObj.GET(request,response); break;
               case 'POST': 
                  var postdata = "";
                  request.addListener("data", function(chunk){ // gather data
                     postdata += chunk;
                  });
                  request.addListener("end", function(){ // finished gathering, call post
                     serverObj.POST(request,postdata,response);
                  });
                  break;
               case 'PUT':
                  var putdata = "";
                  request.addListener("data", function(chunk){ //gather data
                     putdata += chunk;
                  });
                  request.addListener("end", function(){
                     serverObj.PUT(request,putdata,response); // finish gathering, call put
                  });
                  break;
               case 'DELETE': 
                  var deletedata = "";
                  request.addListener("data", function(chunk){ //gather data
                     deletedata += chunk;
                  });
                  request.addListener("end", function(){
                     serverObj.DELETE(request,deletedata,response); // finish gathering, call delete
                  });
                  break;  
            }               
         }
      };
   },
      
   createFetchCallback: function(request,response){
     // create a callback function that is able to write stuff back to the 
     // original http request
     // for now this function is intended to be used for the extended getAll function
     // needs either expansion or additional functions  
     return function(data){
        if(data){
           // for now: write the data to response
           response.writeHead(200, {'Content-Type': 'text/html'});
           //response.write(" numrecords: " + numrecords);
           response.write(JSON.stringify(data));
           response.end();           
        }
        else {
           // for now: write the data to response
           response.writeHead(200, {'Content-Type': 'text/html'}); 
           response.write("Riak error callback. <br>");
           response.write("data in Riak response: " + data + "<br/>");
           response.write("data in Riak response per key: <br>" );
           for(var key in data){
              response.write("Key: " + key + " value: " + data[key] + "<br>");
           }
           response.end();           
        }
     };
   },
   
   AUTH: function(request,data,response){
      // when succesfully authenticated, send back a set-cookie header
      // a standard PHP session start answers with the following headers on the auth request
      /* 
      Date	Fri, 02 Jul 2010 20:14:48 GMT
      Server	Apache
      Expires	Thu, 19 Nov 1981 08:52:00 GMT
      Cache-Control	no-store, no-cache, must-revalidate, post-check=0, pre-check=0
      Pragma	no-cache
      Set-Cookie	Orion_loginproto=teacher; expires=Mon, 02-Aug-2010 20:14:48 GMT
      Vary	Accept-Encoding
      Content-Encoding	gzip
      Content-Length	661
      Keep-Alive	timeout=15, max=200
      Connection	Keep-Alive
      Content-Type	text/html
      */
     
      var givenCookieHeader = request.headers.Cookie;
      //response.write('received data: ' + data);
      // data should be json stuff
      var dataObj = JSON.parse(data);
      var authResult = this.authModule.checkAuth(dataObj.user, dataObj.passwd,false);
      if(authResult){
         // successfull auth
         var newCookieHeader = this.sessionModule.createSession(dataObj.user);
         response.writeHead(200, {'Content-Type': 'text/html', 'Set-Cookie':newCookieHeader });
      }
      response.write("<br/>auth result: " + authResult);
      response.write('<br/>received cookie: ' + givenCookieHeader);
      response.end();      
      
   },
   
   GET: function(request,response){
      var me = this;
      var path = url.parse(request.url).pathname;
      var resource = path.slice(1); // return the entire string except the first character (being a "/")
      // for the moment don't parse the resource, but just assume it is the model name
      this.store.fetch(resource,"student/1",this.createFetchCallback(request,response));     
   },
   
   POST: function(request,data,response){
      //response.writeHead(200, {'Content-Type': 'text/html'});
      //response.write("request URL: " + request.url + "<br>");
      //response.write("request path: " + path + "<br>");
      //sys.puts(sys.inspect(request));
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.write('received data: ' + data);
      response.end();
   },
   
   handlePUT: function(request,data,response){
      
   },
   
   handleDELETE: function(request,data,response){
      
   },
   
   socketIO: null,
   
   socketIOBuffer: [],
   
   _modelCache: [],
   
   _loadModels: function(){
      var models = this.models;
      var me = this;
      models.forEach(function(v){
         if(v.isClass){
            var resource = (v.prototype.resource)? v.prototype.resource: v.prototype.bucket;
            if(resource){
               me._modelCache[resource] = v;  
            }
         }
      });
      //sys.puts('modelCache: ' + sys.inspect(this._modelCache));
   },
   
   server: null,
         
   _startServer: function(){
      this.server = http.createServer(this.createHTTPHandler(this));
      this.server.listen(8080);
   },
   
   _attachWebSocket: function(){
      var json = JSON.stringify;
      var me = this;
      //this.socketIO = socketIoServer.listen(this.server, {
      sys.puts("server before socketio init: " + this.server);
      this.socketIO = OrionSocketListener.create({OrionServer: this }).start(this.server,{
      	onClientConnect: function(client){
      	   sys.puts("onClientConnect in OrionServer called");
      	},

      	onClientDisconnect: function(client){
      	   sys.puts("onClientDisconnect in OrionServer called");
      	},

         /*
         DATA requests:
         { refreshRecord: { bucket: '', key: ''}}
         { fetch: { bucket: '', conditions: '' }} 
         { createRecord: { bucket: '', record: {} }}
         { updateRecord: { bucket: '', key: '', record: {} }}
         { deleteRecord: { bucket: '', key: ''}}
         */

      	onClientMessage: function(message, client){
      	   sys.puts("onClientMessage in OrionServer called");
      	   if(message.fetch) sys.puts("OrionServer fetch called");
      	   if(message.refreshRecord) sys.puts("OrionServer refresh called");
      	   if(message.createRecord) sys.puts("OrionServer create called");
      	   if(message.updateRecord) sys.puts("OrionServer update called");
      	   if(message.deleteRecord) sys.puts("OrionServer delete called");
      	}
      });
   },
   
   start: function(){
      sys.puts('Starting OrionServer');
      // load the models, push the resource names inside the model cache
      this._loadModels();
      sys.puts('DB Models loaded...');
      this._startServer();
      // start the server

      if(this.allowWebSocket){
         this._attachWebSocket();
      }     
   }
});





/*
		
server = http.createServer(function(req, res){
	// your normal server code
	
	var path = url.parse(req.url).pathname;
	switch (path){
		case '/':
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write('<h1>Welcome. Try the <a href="/chat.html">chat</a> example.</h1>');
			res.end();
			break;
			
		default:
			if (/\.(js|html|swf)$/.test(path)){
				try {
					var swf = path.substr(-4) === '.swf';
					res.writeHead(200, {'Content-Type': swf ? 'application/x-shockwave-flash' : ('text/' + (path.substr(-3) === '.js' ? 'javascript' : 'html'))});
					res.write(fs.readFileSync(__dirname + path, swf ? 'binary' : 'utf8'), swf ? 'binary' : 'utf8');
					res.end();
				} catch(e){ 
					send404(res); 
				}			
				break;
			}
		
			send404(res);
			break;
	}
});

server.listen(8080);
*/

// socket.io, I choose you
// simplest chat application evar

