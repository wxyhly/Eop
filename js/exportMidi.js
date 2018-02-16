var ExpMidi = function(){};
ExpMidi.writeNote = function(open, noteObj) {
	open = open.concat(ExpMidi.intTobuff(Math.round(noteObj.t/ExpMidi.timeScale)));
	open.push(noteObj.n, Math.round(noteObj.v));
	return open;
}

ExpMidi.intTobuff = function(i){
	var arr = [];
	arr.push(i&0x7F);
	i = i>>7;
	while(i>0){
		arr.push(0x80+(i&0x7F));
		i = i>>7;
	}
	arr.reverse();
	return arr;
}
ExpMidi.generate = function() {
	var tracks = 0;
	var gap = grid.gap||500;
	gap = Math.round(gap);
	ExpMidi.timeScale = gap/120;
	var nctxt = recorder.ctxt;
	var nnctxt = [];
	for(var i=0; i<nctxt.length; i++){
		var ct = nctxt[i];
		nnctxt.push(ct);
		nnctxt.push({
			n: ct.n,
			v: 0,
			c: ct.c,
			t: ct.t+(ct.d||(gap/2))
		});
	}
	nnctxt.sort(function(a,b){return a.t - b.t});
	nnctxt = xcode.diff(nnctxt);
	var header = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 2,0x00, 0x78];// (gap>>8)&0xFF, gap&0xFF
	var trackHeader = [0x4D, 0x54, 0x72, 0x6B];
	var TouTrack = [0x00, 0xFF, 0x51, 0x03, (gap*1000)>>16, ((gap*1000)>>8)&0xFF, (gap*1000)&0xFF,0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x59, 0x02, 0x03, 0x00];
	var data = header.concat(trackHeader).concat([0x00, 0x00, 0x00, 0x15]).concat(TouTrack).concat(trackHeader);
	//.concat([0,0,0,8,   0x00,0x96,0x45,0x60,0x3c,0x96,0x45,0x00]);
	//var NoteTrack = [0x00, 0 + 0x90,0x30,0x01];
	var NoteTrack = [0x00,0x96,0x20,0x00];//[0x3c,0x45,0x60,0x3c,0x45,0x00];
	var notes = [];
	for(var i=0; i<nnctxt.length; i++){
		notes = ExpMidi.writeNote(notes,nnctxt[i]);
	}
	var varydata = NoteTrack.concat(notes);
	var l = varydata.length;
	data = data.concat([l>>24, (l>>16)&0xFF, (l>>8)&0xFF, l&0xFF]).concat(varydata);
	
	
	var binary = new Uint8Array(data);
	ExpMidi.blob = new Blob([binary],{type:"application/octet-binary"});
}
ExpMidi.saveMIDIFile = function() {
	ExpMidi.generate();
	var blob = ExpMidi.blob;
	var type = blob.type;
	var force_saveable_type = 'application/octet-binary';
	if (type && type != force_saveable_type) { // 强制下载，而非在浏览器中打开
		var slice = blob.slice || blob.webkitSlice || blob.mozSlice;
		blob = slice.call(blob, 0, blob.size, force_saveable_type);
	}
	var a = document.createElement('a');
	var url = window.URL.createObjectURL(blob);
	var filename = 'eop.midi';
	a.href = url;
	a.download = filename;
	a.click();
	window.URL.revokeObjectURL(url);
}