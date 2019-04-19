var ImpMidi = function(){};
ImpMidi.buffer = null;
ImpMidi.msg = function(msg){
	console.log(msg);
}
ImpMidi.load = function(input){
	ImpMidi.buffer = null;
	var file = input.files[0];
	if(!file) return 0;
	filename = file.name.split(".")[0];
	var reader = new FileReader();
	reader.onload = function() {
		ImpMidi.buffer = this.result;
		if(ImpMidi.buffer && ImpMidi.buffer.byteLength)
		ImpMidi.msg("读取成功！["+ImpMidi.buffer.byteLength+"B]");
		ImpMidi.decode();
	}
	reader.readAsArrayBuffer(file);
	ImpMidi.msg("读取本地文件中");
	input.value = '';
}
ImpMidi.EOF = function(){
	ImpMidi.msg("EOF：格式错误！");
	return NaN;
}
ImpMidi.decode = function(){
	if(!ImpMidi.buffer) ImpMidi.msg("读取失败。。");
	ImpMidi.msg("开始解码");
	ImpMidi.data = new DataView(ImpMidi.buffer);
	ImpMidi.offset = 0;
	ImpMidi.EOFStack.push(ImpMidi.buffer.byteLength);
	var header = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00];
	for(var i of header){
		if(i != ImpMidi.next()){
			ImpMidi.msg("意外文件头格式！");
			return 0;
		}
	}
	var format = ImpMidi.next();
	if(format != 0 && format!=1){
		ImpMidi.msg("不支持的MIDI文件格式！");
		return 0;
	}
	var out = {};
	ImpMidi.out = out;
	out.trackNumber = ImpMidi.nextInt16();
	ImpMidi.msg("音轨数:" + out.trackNumber);
	out.ticksPerNote = ImpMidi.nextInt16();
	ImpMidi.msg("Tick数:" + out.ticksPerNote);
	out.tracks = [];
	for(var i = 0; i<out.trackNumber; i++){
		ImpMidi.nextTrack(i);
	}
	if(ImpMidi.EOFStack.pop() == ImpMidi.offset){
		ImpMidi.msg("解码完成！");
		ImpMidi.loadToCtxt(ImpMidi.out);
	}else{
		ImpMidi.msg("格式错误！");
	}
}
ImpMidi.EOFStack = [];
ImpMidi.EOFPos = function(){
	return ImpMidi.EOFStack[ImpMidi.EOFStack.length-1];
}
ImpMidi.nextTrack = function(t){
	var trackMTrk = [0x4D, 0x54, 0x72, 0x6B];
	for(var i of trackMTrk){
		if(i != ImpMidi.next()){
			ImpMidi.msg("意外音轨头格式！");
			return 0;
		}
	}
	ImpMidi.out.tracks[t] = [];
	var trackLength = ImpMidi.nextInt32();
	ImpMidi.msg("音轨长："+trackLength+"[B]");
	ImpMidi.EOFStack.push(ImpMidi.offset + trackLength);
	ImpMidi.currentEvent = null;
	while (ImpMidi.EOFPos() != ImpMidi.offset){
		ImpMidi.nextEvent(t);
	}
	ImpMidi.EOFStack.pop();
}
ImpMidi.nextEvent = function(tr){
	var e = {};
	e.dt = ImpMidi.nextVarInt();
	var eventNum = ImpMidi.next();
	if(eventNum >= 0x00 && eventNum <= 0x7F){//省略事件类型的情况
		eventNum = ImpMidi.currentEvent;
		ImpMidi.offset--;//放回这个字节
	}
	ImpMidi.currentEvent = e.e = eventNum;
	
	switch(e.e >> 4){
		case 0x8:
		case 0x9:
		case 0xA:
		case 0xB:
			e.n = ImpMidi.next();//音符、cc号
			e.v = ImpMidi.next();//力度、cc值
		break;
		case 0xC:
		case 0xD:
			e.n = ImpMidi.next();
		break;
		case 0xE:
			e.n = ImpMidi.nextInt16();
		break;			
	}
	switch(e.e){
			
		case 0xFF:
			e.e1 = ImpMidi.next();
		case 0xF0:
			var length = ImpMidi.nextVarInt();
			ImpMidi.EOFStack.push(ImpMidi.offset + length);
			e.v = ImpMidi.nextUntilEOF();
			ImpMidi.EOFStack.pop();
	}
	ImpMidi.out.tracks[tr].push(e);
	ImpMidi.msg("事件"+e.e.toString(16)+(e.e == 0xFF ? "-"+e.e1.toString(16):""));
}
ImpMidi.next = function(){
	if(ImpMidi.offset >= ImpMidi.EOFPos())return ImpMidi.EOF();
	return ImpMidi.data.getUint8(ImpMidi.offset++);
}
ImpMidi.nextUntilEOF = function(){
	var data = [];
	while (ImpMidi.EOFPos() != ImpMidi.offset){
		data.push(ImpMidi.next());
	}
	return data;
}
ImpMidi.nextVarInt = function(){
	var data = [];
	while(true){
		var bit = ImpMidi.next();
		if (bit & 0x80){
			data.unshift(bit & 0x7F);
		}else{
			data.unshift(bit);
			break;
		}
	}
	var num = 0;
	for(var i in data){
		num += data[i] << (7 * i);
	}
	return num;
}
ImpMidi.nextInt32 = function(){
	if(ImpMidi.offset+3 >= ImpMidi.EOFPos())return ImpMidi.EOF();
	ImpMidi.offset += 4;
	return ImpMidi.data.getUint32(ImpMidi.offset-4);
}
ImpMidi.nextInt16 = function(){
	if(ImpMidi.offset+1 >= ImpMidi.EOFPos())return ImpMidi.EOF();
	ImpMidi.offset += 2;
	return ImpMidi.data.getUint16(ImpMidi.offset-2);
}
//MIDI File Above//

ImpMidi.noteOn = 0x90;
ImpMidi.noteOff = 0x80;
ImpMidi.sustain = 64;
ImpMidi.volume = 7;
ImpMidi.changeInstrument = 0xC0;
ImpMidi.speed = 0x51;
ImpMidi.timeSig = 0x58;
ImpMidi.keySig = 0x59;
ImpMidi.getSF = function(instrument){
	var config = SoundfontConfigs["piano"];//par default
	if(1<=instrument && instrument<=8) config = SoundfontConfigs["piano"];
	if(41<=instrument && instrument<=48) config = SoundfontConfigs["cello"];
	if(25<=instrument && instrument<=32) config = SoundfontConfigs["guitar"];
	return config;
}
ImpMidi.loadToCtxt = function(out){
	var tracks = [];
	recorder.ctxt = [];
	recorder.channels = [];
	MIDI.channels = [];
	recorder.speed = [];
	out.speed = [];
	out.timeSig = [];
	var index = 0;
	for(var i in out.tracks){
		var isEmpty = ImpMidi.sum(out.tracks[i]);
		if(!isEmpty){
			ImpMidi.mergeOnOff(out.tracks[i]);
			panel.addSoundFont(ImpMidi.getSF(out.tracks[i].instrument),index);
		}
		//out.tracks[i].isEmpty = isEmpty;
		out.tracks[i].index = index;
		if(!isEmpty) {
			index++;
		};
	}
	for(var i in out.tracks){
		for(var e of out.tracks[i]){
			if(ImpMidi.is(e) == ImpMidi.noteOn){//一定非空
				recorder.ctxt.push({
					c: out.tracks[i].index,
					d: e.d ? ImpMidi.getDuration(e.t, e.t + e.d) : 0,
					n: e.n,
					t: ImpMidi.getDuration(0,e.t),
					v: e.v
				})
			};
			if(ImpMidi.is(e) == ImpMidi.sustain){
				recorder.channels[out.tracks[i].index].sustain.push({
					t: ImpMidi.getDuration(0,e.t),
					v: e.v == 0 ? false : true
				});
			}
			if(ImpMidi.is(e) == ImpMidi.volume){
				recorder.channels[out.tracks[i].index].volume.push({
					t: ImpMidi.getDuration(0,e.t),
					v: e.v
				});
			}
		}
	}
		
	//全局：
	for(var e of ImpMidi.out.speed){
		recorder.speed.push({
			t: ImpMidi.getDuration(0,e.t),
			q: e.t/ImpMidi.out.ticksPerNote,
			v: e.v
		});
	}
	for(var e of ImpMidi.out.timeSig){
		e.t = ImpMidi.getDuration(0,e.t);
	}
	view.draw();
}
ImpMidi.sum = function(e){
	var t = 0;
	var isEmpty = true;
	for(var i = 0; i < e.length; i++){
		t += e[i].dt;
		e[i].t = t;
		if(ImpMidi.is(e[i]) == ImpMidi.speed){
			e[i].v = (e[i].v[0]*256*256 + e[i].v[1]*256 + e[i].v[2])/1000;
			ImpMidi.out.speed.push(e[i]);
		}
		if(ImpMidi.is(e[i]) == ImpMidi.timeSig){
			e[i].v[1] = 1 << (e[i].v[1]-1);
			if(e[i].v[1]>128)e[i].v[1] = 1;
			ImpMidi.out.timeSig.push(e[i]);
		}
		if(ImpMidi.is(e[i]) == ImpMidi.noteOn){
			isEmpty = false;
		}
	}
	return isEmpty;
}
ImpMidi.getDuration = function(t1,t2){//tick to ms
	var sp = ImpMidi.out.speed;
	var currentSpeed = null;
	var prevT = t1;
	var duration = 0;
	
	for(var i=0; i<= sp.length; i++){
		if(i == sp.length){
			duration += (t2 - prevT) * currentSpeed;
			break;
		}
		if(sp[i].t > t1) {
			if(sp[i].t > t2) {
				duration += (t2 - prevT) * currentSpeed;
				break;
			}
			duration += (sp[i].t - prevT) * currentSpeed;
			prevT = sp[i].t;
		}
		currentSpeed = sp[i].v;
	}
	return duration/ImpMidi.out.ticksPerNote;
}
ImpMidi.mergeOnOff = function(tr){
	var noteE = [];
	var firstInstrument = true;
	for(var e of tr){
		if(firstInstrument && ImpMidi.is(e) == ImpMidi.changeInstrument){
			firstInstrument = false;
			tr.instrument = e.n;
		}
		if(ImpMidi.is(e) == ImpMidi.noteOn && !noteE[e.n]){//若On且之前不是按下状态
			noteE[e.n] = e;//记录是e按下了n
		}
		if(ImpMidi.is(e) == ImpMidi.noteOff && noteE[e.n]){//若Off且之前是按下状态
			noteE[e.n].d = e.t - noteE[e.n].t;
			noteE[e.n] = null;
		}
	}
}
ImpMidi.is = function(e){
	if (e.e >> 4 == 0x9 && e.n && e.v){
		return ImpMidi.noteOn;
	}
	if((e.e >> 4 == 0x8 && e.n) || (e.e >> 4 == 0x9 && e.n && e.v == 0)){
		return ImpMidi.noteOff;
	}
	if(e.e >> 4 == 0xB && e.n == 64){
		return ImpMidi.sustain;
	}
	if(e.e >> 4 == 0xB && e.n == 7){
		return ImpMidi.volume;
	}
	if(e.e >> 4 == 0xC){
		return ImpMidi.changeInstrument;
	}
	if(e.e == 0xFF && e.e1 == 0x51){
		return ImpMidi.speed;
	}
	if(e.e == 0xFF && e.e1 == 0x58){
		return ImpMidi.timeSig;
	}
	if(e.e == 0xFF && e.e1 == 0x50){
		return ImpMidi.keySig;
	}
}