var ExpMidi = function(){};
ExpMidi.changeState = function(open,state){
	if(state == 0xFF|| ExpMidi.state != state){
		open.push(state);
		ExpMidi.state = state;
	}
}
ExpMidi.writeEvent = function(open, noteObj) {
	if(noteObj.e=="speed"){
		open = open.concat(ExpMidi.intTobuff(noteObj.dt));
		ExpMidi.changeState(open,0xFF);
		open.push(0x51, 3, (noteObj.v)>>16, ((noteObj.v)>>8)&0xFF, (noteObj.v)&0xFF);
	}else if(noteObj.n && noteObj.v >= 0){
		open = open.concat(ExpMidi.intTobuff(noteObj.dt));
		console.log(noteObj.dt);
		ExpMidi.changeState(open,ExpMidi.noteOn);
		open.push(noteObj.n, Math.round(noteObj.v));
	}else if(noteObj.e=="sustain"){
		console.log(noteObj.dt);
		open = open.concat(ExpMidi.intTobuff(noteObj.dt));
		ExpMidi.changeState(open,ExpMidi.cc);
		open.push(64, noteObj.v);
	}
	return open;
}
ExpMidi.noteOn = 0x90;
ExpMidi.cc = 0xB0;
ExpMidi.diff = function (events){
	events.sort(function(a,b){return a.t - b.t});
	for(var i=0; i<events.length; i++){
		events[i].dt = i ? Math.round(recorder.ms2q(events[i].t)*ExpMidi.tickPerGap)-Math.round(recorder.ms2q(events[i-1].t)*ExpMidi.tickPerGap) : (events[i].t<0)?0:Math.round(recorder.ms2q(events[i].t)*ExpMidi.tickPerGap);
	}
	return events;
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
ExpMidi.touTrack = function(){
	return [
		0x00, 0xFF, 0x51, 0x03, (ExpMidi.gap)>>16, ((ExpMidi.gap)>>8)&0xFF, (ExpMidi.gap)&0xFF, //速度
		0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x00, 0x00,  //拍号
		0x00, 0xFF, 0x2F, 0x00 //end
	];
	//gap 是一个四分音符的ms数，但MIDI设置的是四分音符的us数，suu mise 1000
}
ExpMidi.generate = function() {
	var tracks = 0;
	var gap = recorder.speed[0].v;
	gap = Math.round(gap*1000);
	//gap 是一个四分音符的ms数，但MIDI设置的是四分音符的us数，suu mise 1000
	ExpMidi.gap = gap;
	ExpMidi.tickPerGap = 120;
	ExpMidi.state = null;
	var nctxt = recorder.ctxt;
	var nnctxt = [];
	for(var i=0; i<nctxt.length; i++){
		var ct = nctxt[i];
		if(!nnctxt[ct.c])nnctxt[ct.c] = [];
		nnctxt[ct.c].push(ct);
		nnctxt[ct.c].push({
			n: ct.n,
			v: 0,
			c: ct.c,
			t: ct.t+(ct.d||(gap/2000))
		});
		
	}
	for(var i in recorder.channels){
		var ce = recorder.channels[i].sustain;
		for(var e of ce){
			if(!nnctxt[ct.c])nnctxt[ct.c] = [];
			nnctxt[i].push({t:e.t,v:e.v?127:0,e:"sustain"});
		}
	}
	for(var i in nnctxt){
		ExpMidi.diff(nnctxt[i]);
		nnctxt[i].instrumentId = MIDI.channels[i].soundfontConfig.instrumentId;
	}
	var tracks = 1;
	for(var i of nnctxt){
		if(!i || !i.length) continue;
		tracks++;
	}
	var header = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, (tracks>>8)&0xFF, tracks&0xFF,0x00, 0x78];
	//总轨：
	var trackMTrk = [0x4D, 0x54, 0x72, 0x6B];
	var allTrack = [];
	for(var e of recorder.speed){
		allTrack.push({
			e:"speed",
			t:e.t,
			v:Math.round(e.v*1000)
		});
	}
	for(var e of recorder.timeSig){
		allTrack.push({
			e:"timeSig",
			t:e.t,
			v:[e.v[0],e.v[1]==1?0:e.v[1]==2?1:e.v[1]==4?2:e.v[1]==8?3:e.v[1]==2?4:5]
		});
	}
	ExpMidi.diff(allTrack);
	var varydata = [0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x00, 0x00];  //拍号
	for(var i=0; i<allTrack.length; i++){
		varydata = ExpMidi.writeEvent(varydata, allTrack[i]);
	}
	varydata.push(0x00,0xFF,0x2F,0x00);
	var l = varydata.length;
	var data = header.concat(trackMTrk).concat([l>>24, (l>>16)&0xFF, (l>>8)&0xFF, l&0xFF]).concat(varydata);
	//全局轨：（速度、节拍）
	/*ExpMidi.state = null;
	
	
	tracks++;
	
	var varydata = [];
	for(var i=0; i<allTrack.length; i++){
		varydata = ExpMidi.writeEvent(varydata, allTrack[i]);
	}
	varydata.push(0x00,0xFF,0x2F,0x00);
	var l = varydata.length;
	data = data.concat(trackMTrk).concat([l>>24, (l>>16)&0xFF, (l>>8)&0xFF, l&0xFF]).concat(varydata);
	*/
	//分轨：
	for(var nc of nnctxt){
		ExpMidi.state = null;
		if(!nc || !nc.length) continue;
		var varydata = [];//[0x00,0xC0,nc.instrumentId];
		for(var i=0; i<nc.length; i++){
			varydata = ExpMidi.writeEvent(varydata, nc[i]);
		}
		varydata.push(0x00,0xFF,0x2F,0x00);
		var l = varydata.length;
		data = data.concat(trackMTrk).concat([l>>24, (l>>16)&0xFF, (l>>8)&0xFF, l&0xFF]).concat(varydata);
	}
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