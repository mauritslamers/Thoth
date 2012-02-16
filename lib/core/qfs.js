/*
  this file queue system is borrowed from the sproutcore build tool Garçon by Martin Ottenwaelter
  http://github.com/martoche/garcon
  
  Write support by Maurits Lamers
*/

var self = this,
    fs = require('fs'),
    exec  = require('child_process').exec;

var openedFileDescriptorsCount = 0;

self.maxSimultaneouslyOpenedFileDescriptors = 32;

self.guessMaxSimultaneouslyOpenedFileDescriptors = function() {
  exec('ulimit -n', function(err, stdout, stderr) {
    var m = 0, num = 0;
    if (err === null) {
      m = parseInt(stdout.trim(), 10);
      if (m > 0) {
        num = m / 16;
        self.maxSimultaneouslyOpenedFileDescriptors = (num >= 4)? num: 4;
      }
    }
  });
};

self.guessMaxSimultaneouslyOpenedFileDescriptors();

self.queue = function(method) {
  if (!self._queue) {
    self._queue = [];
  }
  
  self._queue.push(method);
    
  self.dequeue();
};

self.dequeue = function() {
  var method, callback;
  
  if (self._queue.length > 0 && openedFileDescriptorsCount < self.maxSimultaneouslyOpenedFileDescriptors) {
    openedFileDescriptorsCount += 1;
    
    method = self._queue.shift();
    
    if (method[0] === 'readFile') {
      fs.readFile(method[1], function(err, data) {
        method[2](err, data);
        openedFileDescriptorsCount -= 1;
        self.dequeue();
      });
    }
    if (method[0] === 'writeFile') {
      fs.writeFile(method[1],method[2],function(err){
        method[3](err);
        openedFileDescriptorsCount -= 1;
        self.dequeue();
      });
    }
  }
};

self.readFile = function(path, callback) {
  self.queue(['readFile', path, callback]);
};

self.writeFile = function(path,data,callback){
  self.queue(['writeFile',path,data,callback]);
};
