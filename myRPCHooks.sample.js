/*
myRPCHooks sample

make sure the callback is called with an object:

{ mimeType: '', responseObject: '', filePath: '' }

in case your mimeType is 'application/json', the server will return JSON stringified 
responseObject as the result of your RPC call

in any other case, the server will assume you are sending a binary file.
the responseJSON will be ignored, and the filePath will be retrieved from your response
The server will then generate a single-use key the client can use to retrieve the
result of the RPC action.
So your function has to return the filePath where the server can find the file.

*/

var mimeTypeJSON = 'application/json';

var sys = require('sys');

exports.myFunc = function(params,callback){
    callback({ mimeType: mimeTypeJSON, responseObject: {message: "This is a nice answer"} });
};