/*

to be able to get data from OrionDB using websockets

*/

require('./Store');
var sys = require('sys');
var http = require('http');

global.OrionDBStore = OrionStore.extend({
      // user functions

      primaryKey: 'id',

      OrionDBHost: 'localhost',
      
      OrionDBPort: 80,

      OrionDBBaseURL: '', // no trailing slash
      
      start: function(){
         return YES;
      },
      
      /*
       node example code 
       var http = require('http');
       var google = http.createClient(80, 'www.google.com');
       var request = google.request('GET', '/',
         {'host': 'www.google.com'});
       request.end();
       request.on('response', function (response) {
         console.log('STATUS: ' + response.statusCode);
         console.log('HEADERS: ' + JSON.stringify(response.headers));
         response.setEncoding('utf8');
         response.on('data', function (chunk) {
           console.log('BODY: ' + chunk);
         });
       });
      */

      createOrionDBHTTPRequest: function(method,resource,key,data,callback){
         // function to create a http request
         var me = this;
         return function(){
            var request;
            var dataStore = ""; // temporary var to gather all data
            var httpClient = http.createClient(me.OrionDBPort,me.OrionDBHost);
            var url = key? ["/",me.OrionDBBaseURL,"/",resource,"/",key].join(""):  ["/",me.OrionDBBaseURL,"/",resource].join("");
            sys.log("OrionDBStore: " + method + " http://" + me.OrionDBHost + ":" + me.OrionDBPort + url);
            if(data){
               var dataToSend = "";
               switch(method){
                  case 'PUT': dataToSend = 'records=[' + JSON.stringify(data) + ']'; break;
                  case 'POST': 
                     dataToSend = 'records=[' + escape(JSON.stringify(data) + ']'); 
                  break;
               }
               var headers = {
                  'host': me.OrionDBHost,
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': dataToSend.length
               };
               request = httpClient.request(method,url,headers);
               sys.log('OrionDBStore: sending data to back end: ' + dataToSend);
               request.write(dataToSend);
            } 
            else {
               // no data 
               request = httpClient.request(method,url,{ 'host': me.OrionDBHost});               
            }
            request.end();
            request.addListener('response', function(response){
               response.setEncoding('utf8'); 
               response.addListener('data',function(data){
                  //sys.log("receiving: " + data);
                  dataStore += data;
               });
               response.addListener('end',function(){
                  if(data && (method === 'POST')) sys.log("Sending completed data to callback: " + dataStore);
                  callback(dataStore);
               });
            });            
         };
      },
      
      /*
      the storeRequest is an object with the following layout:
      { bucket: '', 
        key: '',
        conditions: '', 
        parameters: {}, 
        recordData: {},
        relations: [ 
           { bucket: '', type: 'toOne', propertyName: '', keys: [] }, 
           { bucket: '', type: 'toMany', propertyName: '', keys: [] } 
        ] 
      }
      */

      primaryKey: 'id', // put here the name of the primaryKey 

      filterBySCQuery: YES, // have SC Query filter the records if YES. The conditions and parameters are always passed on to the DB calls

      automaticRelations: YES, // have the store automatically parse the relations, The relations are always passed on to the DB calls

      // user functions

      /*
      the storeRequest is an object with the following layout:
      { bucket: '', 
        key: '', 
        conditions: '', 
        parameters: {}, 
        recordData: {},
        relations: [ 
           { bucket: '', type: 'toOne', propertyName: '', keys: [] }, 
           { bucket: '', type: 'toMany', propertyName: '', keys: [] } 
        ] 
      }


      */
      // functions to create, delete and fetch database records
      // use the callback function to send back the results as an array of records
      // make sure that the callback is called with an JS Array of objects and not with JSON data!

      // Be aware that in case you want to have automatic relations, these functions are also used to get the relation data
      // You can prevent automatic relations by not providing relation data in the request...

      createDBRecord: function(storeRequest,clientId,callback){
         // the callback expects the new record
         console.log('Creating a record.');
         console.log(' storeRequest = ' + JSON.stringify(storeRequest));
         var request = this.createOrionDBHTTPRequest('POST',storeRequest.bucket,null,storeRequest.recordData,function(data){
            sys.log("OrionDB createDBRecord callback called");
            var objData = JSON.parse(data);
            if(!objData) sys.log('Whoops, OrionDB returns something that cannot be converted to JSON??');
            var ret = (objData instanceof Array)? objData[0]: objData;
            callback(ret);
         });
         request();
         //console.log("Implement this function");
         //callback(null);
      },

      updateDBRecord: function(storeRequest,clientId,callback){
         // the callback expects the updated record
         var request = this.createOrionDBHTTPRequest('PUT',storeRequest.bucket,storeRequest.key,storeRequest.recordData,function(data){
            //sys.log('OrionDBStore: updateDBRecord callback called with data: ');
            var parsedData;
            try {
               parsedData = JSON.parse(data);               
            } catch(e){ sys.log("OrionDBStore: An error occurred while trying to convert the JSON data in the updateDBRecord callback. Data: " + data); }

            // always call callback:
            if(parsedData) callback(parsedData[0]);
            //if(callback) callback(JSON.parse(data)[0]);
            });
         request();
         //console.log("Implement this function");
         //callback(null);
      },

      deleteDBRecord: function(storeRequest,clientId,callback){
         // check for callbacks.. Often it is not included!
         var request = this.createOrionDBHTTPRequest('DELETE',storeRequest.bucket,storeRequest.key,storeRequest.recordData,
            function(value){
               console.log('delete returned: ' + value);
            });
         request();
         //console.log("Implement this function");
         //callback(null);
      },

      fetchDBRecords: function(storeRequest,callback){
         // the callback expects an array of js objects, so make sure that the data has been parsed 
         //console.log("Implement this function");
         var bucket = storeRequest.bucket;
         var request = this.createOrionDBHTTPRequest('GET',bucket,null,null,function(data){
            if(data){
               var records;
               try{
                  var records = JSON.parse(data).records;
               } catch(e){
                  sys.puts("Whoops... no proper JSON data in: " + data);
                  callback([]);
               }
               for(var i=0,len=records.length;i<len;i++){
                  records[i]['key'] = records[i].guid;
               }
               //sys.puts("calling the fetchdb callback");
               callback(records);                  
            }
            else callback([]);
         });
         request();
      },

      refreshDBRecord: function(storeRequest,clientId,callback){
         // the callback expects a record
         var bucket = storeRequest.bucket;
         var key = storeRequest.key;
         var request = this.createOrionDBHTTPRequest('GET',bucket,key,null,function(data){
            var record = JSON.parse(data);
            record.key = record.id;
            callback(record);
         });
         request();
      }
   
});