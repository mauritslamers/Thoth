
var httpResponses = {
  
  sendResponse: function(responseObj,code,message,contentType,isBinary){
    if(contentType) responseObj.writeHead(code,{'Content-Type': contentType });
    else responseObj.writeHead(code, {'Content-Type:': 'text/html'});
    if(message instanceof String) responseObj.write(message);
    else {
      if(isBinary) responseObj.write(message,'binary');
      else responseObj.write(JSON.stringify(message));
    }
    responseObj.end();
  },
  
  send404: function(res,message){
    this.sendResponse(res,404,message);
  },
  
  send403: function(res,message){
    this.sendResponse(res,403,message);
  },
  
  send200: function(res,message,contentType,isBinary){
    this.sendResponse(res,200,message,contentType);
  }
  
};

exports.httpResponses = httpResponses;
