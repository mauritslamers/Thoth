

Meetme.ONRXHRPollingDataSource = SC.DataSource.extend({
   
   send: function(data){
		this._sendXhr = this._request('send', 'POST');
		this._sendXhr.send('data=' + encodeURIComponent(data));
	},

	disconnect: function(){
		if (this._xhr){
			this._xhr.onreadystatechange = this._xhr.onload = empty;
			this._xhr.abort();
		}            
		if (this._sendXhr) this._sendXhr.abort();
		this._onClose();
		this._onDisconnect();
	},

	_request: function(url, method, multipart){
		var req = this.getRequest(this.base._isXDomain());
		if (multipart) req.multipart = true;
		req.open(method || 'GET', this._prepareUrl() + (url ? '/' + url : '')); // adjust the url here...
		if (method == 'POST'){
			req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
		}
		return req;
	}
   
   getRequest: function(xdomain){
		if ('XDomainRequest' in window && xdomain) return new XDomainRequest();
		if ('XMLHttpRequest' in window) return new XMLHttpRequest();

		try {
			var a = new ActiveXObject('MSXML2.XMLHTTP');
			return a;
		} catch(e){}

		try {
			var b = new ActiveXObject('Microsoft.XMLHTTP');
			return b;      
		} catch(e){}

		return false;
	},
	
	XHRCheck: function(){
		try {
			if (this.getRequest()) return true;
		} catch(e){}
		return false;
	},	
	
	type: 'xhr-polling',

	connect: function(){
		var self = this;
		this._xhr = this._request(+ new Date, 'GET');
		if ('onload' in this._xhr){
			this._xhr.onload = function(){
				if (this.responseText.length) self._onData(this.responseText);
				self.connect();
			};
		} else {
			this._xhr.onreadystatechange = function(){
				var status;
				if (self._xhr.readyState == 4){
					self._xhr.onreadystatechange = empty;
					try { status = self._xhr.status; } catch(e){}
					if (status == 200){
						if (self._xhr.responseText.length) self._onData(self._xhr.responseText);
						self.connect();
					}
				}
			};	
		}
		this._xhr.send();
	}

	
})

