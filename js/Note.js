/**
	from canvas_util.js
**/
{
	$ = function (obj){
		return document.getElementById(obj);
	}
	ctxt$ = function (obj){
		return $(obj).getContext("2d");
	}
	vec2 = function(x,y){
		this.x = x;
		this.y = y ? y :0;
	}
	p = function(x,y){
		return new vec2(x,y);
	}
}

/**
	MIDI
		load(soundfont: string[]);
		onsuccess();
		noteOn(channel, note: int, volume: number);
**/

MIDI = {
	trackBuffers : [],//bufferSource
	channels : [],//array of Channel objects
	keySToNote : {}, // As7  == 106
	keyFToNote : {}, // Bb7  == 106
	noteToKeyS : {}, // 106 ==  As7
	noteToKeyF : {}, // 106 ==  Bb7
	soundfonts : [],//array of [int note, float playBackRate, bufferSource]
	context : new AudioContext(),
	loadSound : function(file,cb1,cb2,cb3){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.responseType = 'arraybuffer';
		xmlhttp.onload = function (){
			MIDI.context.decodeAudioData(xmlhttp.response, function (buffer) {
				cb2(buffer);//uua decoder
			});
			cb1();//uua load
		}
		xmlhttp.onerror = function (){
			cb3();//uue load
		}
		xmlhttp.open("GET",file,true);
		xmlhttp.send();
	},
	loadSoundFont : function(config,onsuccess,id){
		id = id || (id === 0? 0: MIDI.trackBuffers.length);
		MIDI.trackBuffers[id] = [];
		var channel = MIDI.channels[id] = new Channel(MIDI.context, config);
		if(!recorder.channels[id]) recorder.initChannel(id,channel);//防重写cc
		if(config.loaded && config.loaded.success) return 0;
		config.loaded = {success: false, audioBuffers:[], playbackSettings: []}
		var ab = config.loaded.audioBuffers;
		var pbs = config.loaded.playbackSettings;
		if(config.notes == "b"){//生成代表从A0-C8全有，用降号命名的数组
			config.notes = [];
			for (var n = A0; n <= C8; n++) {
				var octave = (n - 12) / 12 >> 0;
				var namef = number2keyf[n % 12] + octave;
				config.notes.push(namef);
			}
		}else if(config.notes == "s"){//生成代表从A0-C8全有，用升号命名的数组
			for (var n = A0; n <= C8; n++) {
				var octave = (n - 12) / 12 >> 0;
				var namef = number2keys[n % 12] + octave;
				config.notes.push(namef);
			}
		}
		var total = config.notes.length;
		var d_loaded = c_loaded = 0;
		for(var noteName of config.notes){
			var note = MIDI.keySToNote[noteName] || MIDI.keyFToNote[noteName];
			pbs[note] = [note,1];//[note,playBackRate]
			MIDI.loadSound(config.baseURL+noteName+"."+config.type,function(noteName){
				MIDI.onprogress("下载音源："+noteName+"["+(++d_loaded)+"/"+total+"]");
			}.bind(0,noteName),function(noteName,note,buffer){
				MIDI.onprogress("解码音源："+noteName+"["+(++c_loaded)+"/"+total+"]");
				ab[note] = buffer;
				if(c_loaded >= total){
					config.loaded.success = true;
					!onsuccess || onsuccess();
				}
			}.bind(0,noteName,note),function(){
				MIDI.onprogress("哦豁，下载音源失败。。。");
			});
		}
		//插值：生成最近的目标音源和回放速率
		var lastNote = A0;
		//ascent
		for(var i = A0; i<= C8; i++){
			if(!pbs[i]){
				pbs[i] = [lastNote, Math.pow(2,(i - lastNote)/12)];
			}else{
				lastNote = i;
			}
		}
		//descent, and comparer avec ascent, choose the best
		var lastNote = C8;
		for(var i = C8; i>= A0; i--){
			if(pbs[i][1] > 1.001){
				var rate = Math.pow(2,(i - lastNote)/12);
				if(1/rate < pbs[i][1]){
					pbs[i][0] = lastNote;
					pbs[i][1] = rate;
				}
			}else{
				lastNote = i;
			}
		}
	},
	noteOn : function(channel, note, volume) {
		if(!MIDI.channels[channel].sound)return 0;//the channel is mute.
		var loaded = MIDI.channels[channel].soundfontConfig.loaded;
		var tB = MIDI.trackBuffers[channel];
		var pb = loaded.playbackSettings[note];//[targetNote, playbackRate]
		var buf = loaded.audioBuffers[pb[0]];
		var context = MIDI.context;
		var source = context.createBufferSource();
		source.buffer = buf;
		if(tB[note]){//若这个音符本来正在播放，切断它
			MIDI.noteOff(channel, note, MIDI.channels[channel].releaseSpeed,true);//true:忽略sustain强制关断
		}
		tB[note] = source;
		var gainNode = context.createGain();
		source.gainNode = gainNode;
		source.connect(gainNode);
		gainNode.connect(MIDI.channels[channel].gainNode);//source -> channelGain -> masterGain -> destination
		gainNode.gain.value = (volume || (volume === 0 ? 0 : 127))/127;
		source.playbackRate.value = pb[1];
		source.start(0);
		//console.log("on:"+channel+"-"+note);
		return MIDI.trackBuffers[channel][note][0];
	},
	noteOff : function(channel, note, hard) {//hard: 忽略sustain强制关断
		
		if(MIDI.channels[channel].sustain && !hard) return 0;
		var pb = MIDI.trackBuffers[channel][note];
		if(!pb) return 0;
		var tB = MIDI.trackBuffers[channel];
		var bufferSource = tB[note];
		var releaseSpeed = MIDI.channels[channel].releaseSpeed;
		//console.log("off:"+channel+"-"+note);
		if(bufferSource) {
			if(!releaseSpeed){
				bufferSource.stop(0);
				return 0;
			}
			var triggerRelease = function (bufSource, releaseSpeed){
				bufSource.gainNode.gain.value -= releaseSpeed;
				if(bufSource.gainNode.gain.value <= 0){
					bufSource.stop(0);
				}else{
					setTimeout(triggerRelease,1);
				}
			}.bind(undefined, bufferSource, releaseSpeed);
			triggerRelease();
		}
	},
	stop : function (channel, note){//hard stop
		var bufferSource = MIDI.trackBuffers[channel][note];
		if(bufferSource) {
			bufferSource.stop(0);
		}
	},
	onprogress: function(msg){
		console.log(msg);
	},
	cc_default:
	{
		"sustain": false,
		"volume": 100,
	}
}
var A0 = 0x15; // first note
var C8 = 0x6C; // last note
var number2keyf = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
var number2keys = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
for (var n = A0; n <= C8; n++) {
	var octave = (n - 12) / 12 >> 0;
	var namef = number2keyf[n % 12] + octave;
	var names = number2keys[n % 12] + octave;
	MIDI.keySToNote[names] = n;
	MIDI.keyFToNote[namef] = n;
	MIDI.noteToKeyS[n] = names;
	MIDI.noteToKeyF[n] = namef;
}
MIDI.masterGain = MIDI.context.createGain();
MIDI.masterGain.connect(MIDI.context.destination);

Channel = function(context, sfConfig){
	this.context = context;
	this.gainNode = context.createGain();
	this.gainNode.connect(MIDI.masterGain);
	this.sustain = false;
	this.releaseSpeed = 0.015;
	//for channel panel controller:
	this.view = true;
	this.sound = true;
	this.lock = false;
	this.soundfontConfig = sfConfig;
	this.onNote = {};
};
/**
	PLAYER
		volume: number;
		play(channel, note: int, [volume: number, delay: int, recorder: Recorder]);
		autoVolume(note: int): number;
**/

PLAYER = {
	autoVolume : function (note){
		var x1 = 20; var y1 = 100;
		var x2 = 110; var y2 = 110;
		if(note < x1) return y1;
		if(note > x2) return y2;
		return Math.round((y1 - y2)/(x1 - x2)*(note - x1)) + y1;
	},
	play : function (channel,note,volume,delay,duration,cb){
		if(!volume > 0) volume = PLAYER.autoVolume(note);
		if(!delay) {
			MIDI.noteOn(channel, note, volume);
			delay = 0;
			MIDI.channels[channel].onNote[note] = true;
		}else{
			setTimeout(function (){
				MIDI.noteOn(channel, note, volume);
				MIDI.channels[channel].onNote[note] = true;
				if(cb){cb()}
			},delay);
		}
		
		if(duration > 0){
			setTimeout(
				function (){
					MIDI.noteOff(channel, note);
					MIDI.channels[channel].onNote[note] = false;
				},
				duration + delay
			);
		}
	}
};

/**
	IN
		mode: string;
		keysig, tempsig: int;
		enable: bool;
		strSharp, strFlat,keySharp, keyFlat, presstr, pressnote: string;
		Eop, Ki: hashTable;
		ki(note: int, nonrecord: bool);
		on(keycode: int): bool;
**/

IN = {
	mode: "eop",  //input mode, choix disponible: [eop, ki, si]
	keysig: 0, tempsig: 0,
	keepfirsttemp: false,//等待临时变音记号作用于下个音符
	channel : 0,//current channel(all newly inputs will in this channel)
	setChannel :function(c){
		IN.channel = c;
		$(LAN.sus).className = (MIDI.channels[IN.channel].sustain)?"greenOn":"green";
	},
	enable: true,
	sustain: true,  //sustain
	sustainDelay: 50, // ms hqe release sustain key e hqet liah
	strSharp: "", strFlat: "", keySharp: "", keyFlat: "",
	on: {},  //store which keys are being pressed
	pressnote: [], //store which notes are being pressed(use to record duration of note)
	ki : function (note,d, mute){//note is the origin note from keyboard settings without b / #
		//just play a sound without writing on record ctxt
		var sig = IN.keysig + IN.tempsig;
		var N = [1,0,2,0,3,4,0,5,0,6,0,7][note % 12];
		if(N>0 && IN.keySharp.indexOf(N)!=-1) sig++;
		if(N>0 && IN.keyFlat.indexOf(N)!=-1) sig--;
		if(N>0 && IN.strSharp.indexOf(N)!=-1) sig++;
		if(N>0 && IN.strFlat.indexOf(N)!=-1) sig--;
		note += sig;
		//if(IN.onNote[note])MIDI.noteOff(IN.channel,note,releaseSpeed);
		if(!mute) PLAYER.play(IN.channel, note, null, null, d);
		return note;
	},
	toggleSus: function (record){
		MIDI.channels[IN.channel].sustain = !MIDI.channels[IN.channel].sustain;
		if(record){
			recorder.recordEvent(IN.channel,"sustain",MIDI.channels[IN.channel].sustain);
		}
		if(!MIDI.channels[IN.channel].sustain){
			var ns = {};
			for(var i of IN.pressnote){
				if(i) {
					ns[i.n] = true;
				}
			}
			for(var i=0;i<120;i++){
				if(!MIDI.channels[IN.channel].onNote[i]){
					MIDI.noteOff(IN.channel,i);
					//MIDI.channels[IN.channel].onNote[i] = false;
				}
			}
		}
		$(LAN.sus).className = (MIDI.channels[IN.channel].sustain)?"greenOn":"green";
		view.draw();
	},

	//keyboard Settings
	Eop: {
		90: 36, 88: 38, 67: 40, 86: 41, 66: 43, 78: 45, 77: 47, 188: 48, //190: 50, 
		65: 48, 83: 50, 68: 52, 70: 53, 71: 55, 72: 57, 74: 59, 75: 60, 76: 62, 186: 64, 222: 65, 13: 67, 
		81: 60, 87: 62, 69: 64, 82: 65, 84: 67, 89: 69, 85: 71, 73: 72, 79: 74, 80: 76, 219: 77, 221: 79, 220: 81, 
		49: 72, 50: 74, 51: 76, 52: 77, 53: 79, 54: 81, 55: 83, 56: 84, 57: 86, 48: 88, 189: 89, 187: 91, 8: 93
	},
	Ki: {
		192: 58, 49: 59, 81: 60, 50: 61, 87: 62, 51: 63, 69: 64, 82: 65, 53: 66, 84: 67, 54: 68, 89: 69, 
		55: 70, 85: 71, 73: 72, 57: 73, 79: 74, 48: 75, 80: 76, 219: 77, 187: 78, 221: 79, 8: 80, 220: 81, 
		90: 48, 83: 49, 88: 50, 68: 51, 67: 52, 86: 53, 71: 54, 66: 55, 72: 56, 78: 57, 74: 58, 77: 59, 
		188: 60, 76: 61, 190: 62, 186: 63, 191: 64, 16: 65
	}
}

/**
	Recorder
		ctxt: NoteJSON[];
		isRecord, isWait: bool;
		offset: int;
		record(channel, note: int, volume: number, time: int): noteObj;
		play();
		stop();
		sort();
**/

recorder = {
	ctxt: [],
	channels: [],
	//keySig: [],
	timeSig: [{t:0, v:[4,4]}],// 4/4拍
	speed: [{t:0, v:500}],//1q == 500 ms, bpm == 120
	isRecord: true,
	isPlaying: 0,//notes not played yet
	isWait: true,  // wait for pressing a key, then time start to run
	isQuantify: false,
	startSusTime: null,
	offset: new Date().getTime(),
	playbackSpeed: 1,
	record: function (channel, note, volume,d){
		var time = new Date().getTime();
		if(recorder.isWait) recorder.offset = Math.round(time - view.p);
		recorder.isWait = false;
		var noteObj = d ? {c: channel, n: note, v: volume, t: time - recorder.offset,d:d} :{c: channel, n: note, v: volume, t: time - recorder.offset};
		recorder.ctxt.push(noteObj);
		view.findP(time - recorder.offset);
		recorder.updateEvent(channel, "sustain", time - recorder.offset);
		return noteObj;
	},
	play: function (){
		recorder.stop();
		recorder.offset = Math.round(new Date().getTime() - view.p);
		recorder.isWait = false;
		
		var stor = recorder.ctxt;
		for(var i = 0; i < stor.length; i++){
			var dt = Math.round((stor[i].t - view.p)/recorder.playbackSpeed);
			if (dt < -0.01) continue;//希望不漏播t=0处的声音
			recorder.isPlaying++;
			//console.log("start");
			PLAYER.play(stor[i].c, stor[i].n, stor[i].v, dt, stor[i].d, function(){
				recorder.isPlaying--;
				if(recorder.isPlaying <= 0){
					recorder.isWait = true;
					recorder.isQuantify = false;
				}
			});
			//move View Pointer:
			setTimeout(
				function (i){
					view.moveP(stor[i].t);
				}.bind(undefined, i),
				dt
			);
		}
		for(var i in recorder.channels){
			var I = recorder.channels[i];
			for(var j in I){//i[j] <==> channel[name]
				for(var k of I[j]){
					var dt = Math.floor((k.t - view.p)/recorder.playbackSpeed);
					if (dt < -0.01) continue;
					var cb;
					switch(j){
						case "sustain":
							cb = function (k,target,i){
								target.sustain = k.v;
								$(LAN.sus).className = (MIDI.channels[IN.channel].sustain)?"greenOn":"green";
								view.moveP(k.t);
								if(!k.v){
									for(var n=A0;n<=C8;n++){
										if(target.onNote[n]===false){
											MIDI.noteOff(i,n);
										}
									}
								}
							};
							break;
						case "volume":
							cb = function (k,target,i){
								target.gainNode.gain.value = k.v/100;
								view.moveP(k.t);
							}
					}
					setTimeout(
						cb.bind(undefined, k, MIDI.channels[i],i),
						dt
					);
				}
			}
		}
	},
	stop: function (){
		//stop now
		//stop futur
		recorder.isPlaying = 0;
		recorder.isQuantify = false;
		for(var i = 0; i < 500000; i++){
			clearTimeout(i);
		}
		for(var c = 0; c < MIDI.channels.length; c++){
			for(var i = A0; i <= C8; i++){
				MIDI.stop(c,i);
			}
		}
	},
	goBack: function (){
		recorder.isWait = true;
		recorder.isQuantify = false;
		if(!recorder.ctxt.length) {
			view.moveP(0);
			return 0;
		}
		recorder.sort();
		view.moveP(recorder.ctxt[0].t);
	},
	q2ms: function(q1,q2){//quad to ms
		if(!q2>=0){q2 = q1; q1 = 0;}
		var sp = recorder.speed;
		var currentSpeed = null;
		var prevT = q1;
		var duration = 0;
		for(var i=0; i<= sp.length; i++){
			if(i == sp.length){
				duration += (q2 - prevT) * currentSpeed;
				break;
			}
			if(sp[i].q > q1) {
				if(sp[i].q > q2) {
					duration += (q2 - prevT) * currentSpeed;
					break;
				}
				duration += (sp[i].q - prevT) * currentSpeed;
				prevT = sp[i].q;
			}
			currentSpeed = sp[i].v;
		}
		return duration;
	},
	ms2q: function(t1,t2){//ms to quad
		if(!(t2>=0)){t2 = t1; t1 = 0;}
		var sp = recorder.speed;
		var currentSpeed = null;
		var prevQ = t1;
		var duration = 0;
		for(var i=0; i<= sp.length; i++){
			if(i == sp.length){
				duration += (t2 - prevQ) * currentSpeed;
				break;
			}
			if(sp[i].t > t1) {
				if(sp[i].t > t2) {
					duration += (t2 - prevQ) * currentSpeed;
					break;
				}
				duration += (sp[i].t - prevQ) * currentSpeed;
				prevQ = sp[i].t;
			}
			currentSpeed = 1/sp[i].v;
		}
		return duration;
	},
	calculeQ: function(){
		for(var i of recorder.ctxt){
			i.q = recorder.ms2q(i.t);
			i.dq = recorder.ms2q(i.t+i.d);
		}
		for(var i of recorder.speed){
			i.q = recorder.ms2q(i.t);
		}
		for(var i of recorder.timeSig){
			i.q = recorder.ms2q(i.t);
		}
		for(var i of recorder.channels){
			for(var j of i.sustain){
				j.q = recorder.ms2q(j.t);
			}
			for(var j of i.volume){
				j.q = recorder.ms2q(j.t);
			}
		}
		
	},
	calculeT: function(){
		for(var i of recorder.ctxt){
			i.t = recorder.q2ms(i.q);
			i.d = recorder.q2ms(i.dq) - i.t;
		}
		for(var i of recorder.speed){
			i.t = recorder.q2ms(i.q);
		}
		for(var i of recorder.timeSig){
			i.t = recorder.q2ms(i.q);
		}
		for(var i of recorder.channels){
			for(var j of i.sustain){
				j.t = recorder.q2ms(j.q);
			}
			for(var j of i.volume){
				j.t = recorder.q2ms(j.q);
			}
		}
	},
	sort: function (){
		recorder.ctxt.sort(function (a,b){
			return a.t - b.t;
		});
	},
	setSpeed: function(s){
		$("playSpeed").value = s;
		$("playSpeedBar").value = s*100;
		recorder.playbackSpeed = s;
	},
	scale: function(){
		var ss = 1/recorder.playbackSpeed;
		recorder.ctxt.forEach(function(e){
			e.t *= ss;
		});
		grid.gap *= ss;
		$("bpm").value = 60/grid.gap*1000;
		recorder.setSpeed(1);
	},
	initChannel: function(id){
		recorder.channels[id] = {
			volume:[],
			sustain:[]
		};
	},
	recordEvent: function(channel, name, value){
		var time = new Date().getTime();
		
		if(recorder.isWait) recorder.offset = Math.round(time - view.p);
		time -= recorder.offset;
		var rc = recorder.channels[channel][name];
		rc.push({t:time, v:value});
		recorder.updateEvent(channel, name, time);
	},
	updateEvent: function(channel, name, time){
		var rc = recorder.channels[channel][name]
		eventBar.sort(rc);
		for(var i=0; i < rc.length; i++){
			var r = rc[i];
			if(r.t > recorder.startSusTime && r.t < time - 0.0001){
				rc.splice(i,1);
				i--;
				continue;
			}if(r.t <= time){//别影响后面的
				if(i>0 && r.v == rc[i-1].v){
					rc.splice(i,1);
					i--;
					continue;
				}
				if(i<rc.length-1 && r.t == rc[i+1].t){
					rc.splice(i,1);
					i--;
					continue;
				}
			}
		}
		recorder.startSusTime = time;
	},
	getEventAt: function(channel, name, t){
		var c = recorder.channels[channel][name];
		if(!c.length) return MIDI.cc_default[name];
		var everBreak = false;
		for(var i in c){
			if(c[i].t > t) {
				if(i>0) return c[i-1].v;
				return MIDI.cc_default[name];
			}else if(c[i].t == t){
				return c[i].v;
			}
		}
		return c[i].v;
	},
	recordQuantify: function(){
		recorder.stop();
		view.moveP(recorder.q2ms(Math.round(recorder.ms2q(view.p))));
		recorder.offset = Math.round(new Date().getTime() - view.p);
		recorder.isWait = false;
		recorder.isQuantify = true;
		var loop = function(time){
			if(!(recorder.isQuantify && !recorder.isWait))return 0;
			var nextTime = recorder.q2ms((recorder.ms2q(view.p) + 1));
			view.moveP(time);
			recorder.offset = Math.round(new Date().getTime() - view.p);//防误差累计
			view.draw();
			MIDI.noteOn(0,92,100);
			setTimeout(MIDI.noteOff(0,92,100),200);
			
			var stor = recorder.ctxt;
			for(var i = 0; i < stor.length; i++){
				var dt = Math.round((stor[i].t - time));
				if (stor[i].t >= nextTime-0.01) continue;//希望不漏播t=0处的声音
				if (dt < -0.01) continue;//希望不漏播t=0处的声音
				PLAYER.play(stor[i].c, stor[i].n, stor[i].v, dt, stor[i].d);
			}
			
			
			setTimeout(loop.bind(null,nextTime),nextTime-time);//节拍器
		}
		loop(view.p);//对齐大拍子
	}
}

/**
	view
		ctxt: NoteJSON[];
		runAt$(div: DomNode);
		draw();
**/

view = {
	ctxt: {},
	p: 0, oldP: 0, oldPy: 0,
	min: -1000, max: 9000,//horizontal range(ms)
	nmin: 20, nmax: 110,//vertical range
	dx: 10,   //the length of the note{duration: 0}
	ismove: false,
	k: 0, nk: 0, delZoom: 0.005,// k is scale factor of x, nk is scale factor of y
	margin: 40, margout: 320,//result of finding pos automatically  , and margin of finding pos automatically
	sharplist: ["1","#1","2","#2","3","4","#4","5","#5","6","#6","7"],
	flatlist: ["1","b2","2","b3","3","4","b5","5","b6","6","b7","7"],
	list: ["1","#1","2","#2","3","4","#4","5","#5","6","#6","7"],//list can be pointed to sharp or flat list
	findP: function (view_p){ // to find view_p in the view
		if((view_p-view.min)*view.k > view.width - view.margin){
			var i = view_p + view.margout/view.k + (view.max - view.min)/2;
			view.min = i - (view.max - view.min);
			view.max = i;
		}else if((view_p-view.min)*view.k <  view.margin){
			var i = view_p - view.margout/view.k;
			view.max = i + (view.max - view.min);
			view.min = i;
		}
		view.draw();
	},
	moveP: function (view_p){ // to move pos to view_p and find it in the view
		view.setP(view_p);
		view.findP(view_p);
		
	},
	setP:function(view_p){
		view.p = view_p;
		MIDI.channels[IN.channel].gainNode.gain.value = recorder.getEventAt(IN.channel,"volume",view_p)/100;
		MIDI.channels[IN.channel].sustain = recorder.getEventAt(IN.channel,"sustain",view_p);
		$(LAN.sus).className = (MIDI.channels[IN.channel].sustain)?"greenOn":"green";
	},
	draw: function (){
		var storage = recorder.ctxt;
		var keysig = IN.keysig;
		var ctxt = view.ctxt;
		ctxt.clearRect(0, 0, view.width, view.height);
		select.drawRect(ctxt);
		grid.draw(ctxt);
		//Keyboard lines
		ctxt.strokeStyle = "#BBB";
		ctxt.lineWidth = 0.5;
		ctxt.beginPath();
		for(var i = view.nmin; i <= view.nmax; i++){
			var Y = (i-view.nmax)*view.nk;
			ctxt.moveTo(0, Y);
			ctxt.lineTo(view.width, Y);
		}
		ctxt.stroke();
		ctxt.beginPath();
		ctxt.strokeStyle = "#AAA";
		ctxt.lineWidth = 2;
		for(var i = view.nmin; i <= view.nmax; i++){
			if(i%12 == 1 || i%12 == 3 || i%12 == 6 || i%12 == 8 || i%12 == 10)
			var Y = (i-view.nmax+0.5)*view.nk;
			ctxt.moveTo(0, Y);
			ctxt.lineTo(view.width, Y);
		}
		ctxt.stroke();
		//Notes
		ctxt.font="20px Arial";
		for(var i = 0; i < storage.length; i++){
			var d = storage[i].d || 0;
			if (storage[i].t + d < view.min || storage[i].t > view.max) continue;
			var selected = select.test(storage[i]);
			if (!MIDI.channels[storage[i].c].view) continue; //this channel is not visible
			ctxt.fillStyle = velocity.getBoxColor(selected,storage[i].v);
			var X = (storage[i].t-view.min)*view.k;
			var Y = (storage[i].n-view.nmax)*view.nk;
			var dx = (storage[i].d) ? storage[i].d*view.k : undefined;
			ctxt.fillRect(X, Y, dx || view.dx, view.nk);
			if(view.max-view.min<100000){
				if(select.selectedArr.length){//draw velocity bar
					var X = (storage[i].t-view.min)*view.k;
					if(!selected){
						var ii = velocity.getBoxColor(false,storage[i].v);
						ctxt.fillStyle = "rgba"+ii.substring(3,ii.length-1)+",0.3)";
					}else{
						ctxt.fillStyle = velocity.getBoxColor(false,storage[i].v);
					}
					ctxt.fillRect(X, view.height, selected?view.dx/3:view.dx/4, -storage[i].v);
				}
				ctxt.fillStyle = velocity.getTextColor(selected,storage[i].v);
				
				ctxt.fillText(view.list[(storage[i].n - keysig) % 12],X-view.dx, Y);
			}
		}
		eventBar.draw(IN.channel,"sustain");
		eventBar.draw(IN.channel,"volume");
		speedTrack.draw(ctxt);
		//Start and Pos lines
		ctxt.beginPath();
		ctxt.lineWidth = 4;
		ctxt.strokeStyle = "rgba(255,0,0,0.5)";
		ctxt.moveTo(-view.min * view.k, 0);
		ctxt.lineTo(-view.min * view.k, view.height);
		ctxt.stroke();
		ctxt.lineWidth = 1;
		var xp = (view.p - view.min) * view.k;
		ctxt.beginPath();
		ctxt.strokeStyle = "#0E0";
		ctxt.moveTo(xp, 0);
		ctxt.lineTo(xp, view.height);
		ctxt.stroke();
	},
	runAt$: function (obj){
		panel.$();// initiate panel
		recorder.offset = new Date().getTime();
		view.width = $(obj).width = window.innerWidth-20;
		view.height = $(obj).height = window.innerHeight-20;
		view.ctxt = ctxt$(obj);
		view.k = view.width / (view.max - view.min);
		view.nk = view.height / (view.nmin - view.nmax);
		//registre evenements
		addEvent.viewMouse(obj);
		addEvent.INKey();
		view.draw();
	}
}
velocity = {
	getBoxColor: function (s,v){
		var rgb = velocity._HSB_to_RGB(270-v*2, s?0.5:1, s?1:0.7);
		return "rgb("+rgb.R+","+rgb.G+","+rgb.B+")";
	},
	getTextColor: function (s,v){
		var rgb = velocity._HSB_to_RGB(270-v*2, 1, s?0.6:0.2);
		return "rgb("+rgb.R+","+rgb.G+","+rgb.B+")";
	},
	_HSB_to_RGB: function(H, S, B) {
		var rgb = {R:0, G:0, B:0};
		H = (H >= 360) ? H%360 : H;
		if(S == 0) {
			rgb.R = B * 255;
			rgb.G = B * 255;
			rgb.B = B * 255;
		} else {
			var i = Math.floor(H / 60) % 6;
			var f = H / 60 - i;
			var p = B * (1 - S);
			var q = B * (1 - S * f);
			var t = B * (1 - S * (1 - f));
			switch(i) {
				case 0: rgb.R = B, rgb.G = t, rgb.B = p; break;
				case 1: rgb.R = q; rgb.G = B; rgb.B = p; break;
				case 2: rgb.R = p; rgb.G = B; rgb.B = t; break;
				case 3: rgb.R = p; rgb.G = q; rgb.B = B; break;
				case 4: rgb.R = t; rgb.G = p; rgb.B = B; break;
				case 5: rgb.R = B; rgb.G = p; rgb.B = q; break;
			}
			rgb.R = Math.floor(rgb.R * 255);
			rgb.G = Math.floor(rgb.G * 255);
			rgb.B = Math.floor(rgb.B * 255);
		}
		return rgb;
	}
}
eventBar = {
	color:{
		sustain: "rgb(0,0,255)",
		volume: "rgb(0,99,0)"
	},
	scaleY: {
		volume: 0.2,
		speed: -2
	},
	draw:function (channel, name){
		var evts = recorder.channels[channel][name];
		if(!volumeTrack.visible && name == "volume")return 0;
		if(select.sustain && select.sustain[0]!=select.sustain[1] && name == "sustain"){//鼠标正在拖动sustain
			select.sustainEvt = [];
			var value1 = recorder.getEventAt(channel,name,select.sustain[0]);
			var value2 = recorder.getEventAt(channel,name,select.sustain[1]);
			for(var i of evts){
				if(i.t<select.sustain[0] ^ i.t>select.sustain[1]){
					select.sustainEvt.push(i);
				}
			}
			var order = select.sustain[0]<select.sustain[1];
			if(order){
				select.sustainEvt.push({t:select.sustain[0], v: true});
				select.sustainEvt.push({t:select.sustain[1], v: value2});
			}else{
				select.sustainEvt.push({t:select.sustain[0], v: value1});
				select.sustainEvt.push({t:select.sustain[1], v: false});
			}
			evts = select.sustainEvt;
		}
		eventBar.sort(evts);
		var ctxt = view.ctxt;
		var ii = eventBar.color[name];
		if(name=="volume" && !(evts.length && evts[0].t == 0)){
			//initial value
			var X1 = 0;
			var X2 = (!evts.length)? (view.max-view.min)*view.k :(evts[0].t-view.min)*view.k;
			var Y = MIDI.cc_default["volume"]*eventBar.scaleY[name];
			Y *= view.nk;
			ctxt.fillStyle = "rgba"+ii.substring(3,ii.length-1)+",0.3)";
			ctxt.fillRect(X1,view.height,X2-X1,Y);
		}
		for(var i in evts){
			i = Number(i);
			if(i+1 < evts.length && evts[i+1].t < view.min) continue;
			if(evts[i].t > view.max) break;
			var X1 = (evts[i].t-view.min)*view.k;
			var X2 = (i+1 == evts.length)? (view.max-view.min)*view.k :(evts[i+1].t-view.min)*view.k;
			var Y = (evts[i].v === true)? 1 : (evts[i].v === false)? 0 : evts[i].v*eventBar.scaleY[name];
			Y *= view.nk;
			ctxt.fillStyle = "rgba"+ii.substring(3,ii.length-1)+",0.3)";
			ctxt.fillRect(X1,view.height,X2-X1,Y);		
			ctxt.fillStyle = ii;
			ctxt.fillRect(X1,view.height+Y-2,3,3);
		}
		if(name=="volume"){
			var Y1 =  100*eventBar.scaleY[name]*view.nk;
			var Y2 =  127*eventBar.scaleY[name]*view.nk;
			ctxt.lineWidth = 2;
			ctxt.strokeStyle = "#6F6";
			ctxt.beginPath();
			//ctxt.moveTo(0,view.height+Y1);
			//ctxt.lineTo(view.width,view.height+Y1);
			ctxt.moveTo(0,view.height+Y2);
			ctxt.lineTo(view.width,view.height+Y2);
			ctxt.stroke();
		}
	},
	sort: function(evts){
		for(var i of evts){
			if(i.t<0) i.t = 0;
		}
		evts.sort(function (a,b){
			return a.t - b.t;
		});
	}
}
volumeTrack = {
	visible: false//alt + v
}
speedTrack = {
	visible: false,//alt + t
	color: 'rgb(255,0,0)',
	draw: function (ctxt){
		if(!speedTrack.visible) return 0;
		var evts = recorder.speed;
		var ii = speedTrack.color;
		for(var i in evts){
			i = Number(i);
			if(i+1 < evts.length && evts[i+1].t < view.min) continue;
			if(evts[i].t > view.max) break;
			var X1 = (evts[i].t-view.min)*view.k;
			var X2 = (i+1 == evts.length)? (view.max-view.min)*view.k :(evts[i+1].t-view.min)*view.k;
			var Y = 60000/evts[i].v*eventBar.scaleY["speed"];
			ctxt.fillStyle = "rgba"+ii.substring(3,ii.length-1)+",0.3)";
			ctxt.fillRect(X1,view.height,X2-X1,Y);		
			var s = speedTrack.select;
			if(s && s.length == 2 && (s[0]<evts[i].t ^ s[1]<evts[i].t)){
				ctxt.fillStyle = "rgb(0,0,155)";
				ctxt.fillRect(X1,view.height+Y-2,5,5);
			}else{
				ctxt.fillStyle = ii;
				ctxt.fillRect(X1,view.height+Y-2,3,3);
			}
		}
		
	},
	toggle:function(){
		speedTrack.visible = !speedTrack.visible;
		view.draw();
	},
	select:null,//[start,end]
	toAppendPoint: null,
	finiSelect: function(){
		var remover = [];
		var s = speedTrack.select;
		recorder.calculeQ();
		for(var i=0; i < recorder.speed.length; i++){
			if(i && s && s.length == 2 && (s[0]<recorder.speed[i].t ^ s[1]<recorder.speed[i].t)){
				recorder.speed.splice(i,1);
				i--;
			}
		}
		speedTrack.select = null;
		recorder.calculeT();
	},
	toAppend: function(Pos){
		var X = Pos.x/view.k+view.min;
		if(grid.enable) X = grid.nearest(X);
		var Y = 60000/(Pos.y - view.height)*eventBar.scaleY["speed"];
		speedTrack.toAppendPoint.t = X<0?0:X;
		speedTrack.toAppendPoint.q = recorder.ms2q(X<0?0:X);
		speedTrack.toAppendPoint.v = Y;
	},
	append: function(){
		var e = speedTrack.toAppendPoint;
		if(e.t<=0){
			recorder.speed[0] = e;
			
			return e;
		}
		recorder.speed.push(e);
		eventBar.sort(recorder.speed);
		return e;
	},
	changeAppend: function(){
		eventBar.sort(recorder.speed);
		recorder.calculeT();
	},
	//live tempo record:
	record_start: null,
	record_time: null,
	record: function(){
		var now = new Date().getTime();
		if(speedTrack.record_time){
			var dt = now - speedTrack.record_time;
			if(dt/1000 < 5){//10s内没按视为终止录制
				var oldQ = recorder.ms2q(speedTrack.record_start);
				var nowQ = oldQ + 1/grid.detail;
				recorder.calculeQ();
				for(var e of recorder.speed){
					if(e.q >= oldQ && e.q <= nowQ){
						
					}
				}
				recorder.speed.push({q:oldQ,v:dt*grid.detail});
				recorder.speed.sort(function(a,b){
					return a.q - b.q
				});
				recorder.calculeT();
			}
		}
		speedTrack.record_time = now;
		if(dt/1000 < 5){
			view.moveP(grid.nearest(recorder.q2ms(nowQ)));
		}
		speedTrack.record_start = view.p;
	}
}
select = {
	rect: null, //selected range{xa:0,xb:0,ya:0,yb:0}
	selectedArr: [],
	clipboard: [],
	sustain: null,
	drawRect: function (ctxt){
		if(select.rect){
			ctxt.fillStyle = "#BFB";
			ctxt.fillRect((select.rect.xa-view.min)*view.k,
				(select.rect.ya-view.nmax)*view.nk,
				(select.rect.xb-select.rect.xa)*view.k,
				(select.rect.yb-select.rect.ya)*view.nk);
		}
	},
	testRect: function (n){
		var ch = MIDI.channels[n.c];
		if(!ch.view || ch.lock || !select.rect) return false;
		var temp = (n.t < select.rect.xa) ^ (n.t < select.rect.xb);
		return temp && (n.n < select.rect.ya) ^ (n.n < select.rect.yb);
	},
	test : function (n){
		var ch = MIDI.channels[n.c];
		if(!ch.view || ch.lock){
			select.selectedArr[select.selectedArr.indexOf(n)] = null;
			return false;
		}
		return select.testRect(n) ^ (select.selectedArr.indexOf(n) != -1);
	},
	fini: function (){
		var s = recorder.ctxt;
		var newselectedArr = [];
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) newselectedArr.push(s[i]);
		}
		$(LAN.edit).className = (newselectedArr.length)?"blueOn":"blueOff";
		select.selectedArr = newselectedArr;
		select.rect = null;
		if(select.selectedArr.length){
			recorder.isWait = true;
			recorder.offset = Math.round(new Date().getTime() - view.p);
			recorder.isQuantify = false;
		}
		view.draw();
	},
	all: function (){
		var c = recorder.ctxt;
		select.selectedArr = [];
		for(var n of c){
			if(MIDI.channels[n.c].view && !MIDI.channels[n.c].lock)
				select.selectedArr.push(n);
		}
		$(LAN.edit).className = (select.selectedArr.length)?"blueOn":"blueOff";
		view.draw();
		if(select.selectedArr.length){
			recorder.isWait = true;
			recorder.offset = Math.round(new Date().getTime() - view.p);
			recorder.isQuantify = false;
		}
	},
	del: function (){
		var s = recorder.ctxt;
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) {
				s.splice(i,1);
				i--;
			}
		}
		$(LAN.edit).className = "blueOff";
		select.selectedArr = [];
		view.draw();
	},
	up: function (){
		var s = recorder.ctxt;
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) s[i].n++;
		}
		view.draw();
	},
	down: function (){
		var s = recorder.ctxt;
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) s[i].n--;
		}
		view.draw();
	},
	scale: function (scale){
		var s = recorder.ctxt;
		var minQ = Infinity;
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) {
				if(!s[i].q) {
					s[i].q = recorder.ms2q(s[i].t);
					s[i].dq = recorder.ms2q(s[i].t+s[i].d);
				}
				minQ = Math.min(s[i].q,minQ);
			}
		}
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) {
				s[i].q = (s[i].q - minQ)*scale + minQ;
				s[i].t = recorder.q2ms(s[i].q);
				if(s[i].d){
					s[i].dq = (s[i].dq - minQ)*scale + minQ;
					s[i].d = recorder.q2ms(s[i].dq)-s[i].t;
				}
			}
		}
		view.draw();
	},
	copy: function (){
		recorder.sort();
		var s = recorder.ctxt;
		select.clipboard = [];
		for(var i = 0; i < s.length; i++){
			if(select.test(s[i])) select.clipboard.push({c:s[i].c,n:s[i].n,v:s[i].v,t:s[i].t,d:s[i].d});
		}
	},
	cut: function (){
		select.copy();
		select.del();
	},
	paste: function (){
		var s = select.clipboard;
		select.selectedArr = [];
		for(var i=0; i<s.length;i++){
			var newNote = {c:s[i].c,n:s[i].n,v:s[i].v,d:s[i].d,t:Math.round(s[i].t-s[0].t+view.p)};
			recorder.ctxt.push(newNote);
			select.selectedArr.push(newNote);
		}
		recorder.sort();
		$(LAN.edit).className = (select.selectedArr.length)?"blueOn":"blueOff";
		view.draw();
	},
	undo: function (){
		var n = recorder.ctxt.pop();
		view.moveP(n.t);
		view.draw();
	},
	redo:function(){
		
	}
}

/**
	Grid
		draw(ctxt: Ctxt);
		IN(note: int);
		nearest(vp: number);
		next();
**/

grid = {
	enable: false,
	visible: true,
	gap: 500,//gap = 60/x*1000 = 一大格的毫秒数, x is bpm
	detail: 1, //can be 1\2\3\4\6\8
	INdelay: 100,//threshod for "the sametime", for input chord
	draw: function (ctxt){
		if(!grid.visible) return 0;
		if(view.max-view.min>100000) return 0;
		ctxt.lineWidth = 1;
		ctxt.strokeStyle = "#AA6";
		ctxt.beginPath();
		for(var i=0; true; i += 1){
			var t = recorder.q2ms(i);
			if (t>view.max) break;
			if(t < view.min) continue;
			var xp = (t - view.min) * view.k;
			ctxt.moveTo(xp, 0);
			ctxt.lineTo(xp, view.height);
		}
		ctxt.stroke();
		
		ctxt.lineWidth = 0.5;
		ctxt.strokeStyle = "#AA6";
		ctxt.beginPath();
		for(var i=0; grid.detail > 1; i += 1/grid.detail){
			var t = recorder.q2ms(i);
			if (t>view.max) break;
			if(t < view.min) continue;
			var xp = (t - view.min) * view.k;
			ctxt.moveTo(xp, 0);
			ctxt.lineTo(xp, view.height);
		}
		ctxt.stroke();
		
		/*ctxt.lineWidth = 1;
		ctxt.strokeStyle = "#6AA";
		ctxt.beginPath();
		for(var i=Math.floor(view.min/grid.gap)*grid.gap; i<=view.max; i+=grid.gap){
			var xp = (i - view.min) * view.k;
			ctxt.moveTo(xp, 0);
			ctxt.lineTo(xp, view.height);
		}
		ctxt.stroke();*/
		
	},
	set: function(flag){
		grid.enable = flag;
		$(LAN.grid).className = (grid.enable)?"yellowOn":"yellow";
	},
	nearest: function (vp){
		return recorder.q2ms(Math.round(recorder.ms2q(vp)*grid.detail)/grid.detail);
		//return Math.round(vp/grid.gap*grid.detail)*grid.gap/grid.detail;
	},
	IN: function(note){
		if(recorder.isWait){
			recorder.isWait = false;
			setTimeout(function(){
				var nt = grid.next();
				if(note == 0 && !speedTrack.visible){//续不续duration: 0要续，null不续
					for(var n of recorder.ctxt){
						if(n.c==IN.channel && Math.abs(n.t+n.d-view.p)<1){
							n.d = nt - n.t;
						}
					}
				}
				view.moveP(nt);
				recorder.isWait = true;
				recorder.isQuantify = false;
				view.draw();
			}, grid.INdelay);
			if(note == 0 && speedTrack.visible){
				speedTrack.record(view.p);
			}
		}
		if(note){
			recorder.ctxt.push({c: IN.channel, n: note, v: PLAYER.autoVolume(note), t: view.p, d:grid.next()-view.p});
		}
	},
	next: function (){
		return recorder.q2ms(recorder.ms2q(view.p) + 1/grid.detail);
		//return view.p + grid.gap/grid.detail;
	},
	prev: function (){
		return recorder.q2ms(recorder.ms2q(view.p) - 1/grid.detail);
	}
}

/**
	AddEvent
		viewMouse(obj: Obj);
		INKey();
**/

addEvent = {
	viewMouse: function (obj){
		var p2p = function (obj,evt){
			var rect = $(obj).getBoundingClientRect(); 
			return p(
				evt.clientX - rect.left * ($(obj).width / rect.width),
				evt.clientY - rect.top * ($(obj).height / rect.height)
			);
		}
		$(obj).addEventListener("contextmenu", function (evt) {evt.preventDefault(); }, false);
		var mousefini = function (evt) {
			view.ismove = false;
			if(speedTrack.toAppendPoint && IN.on[18] && speedTrack.visible && evt.button == 2){
				speedTrack.toAppendPoint = null;		
			}else if(speedTrack.select && evt.button == 0 && speedTrack.visible){
				speedTrack.finiSelect();
			}
			if(evt.button == 0) select.fini();
			if(select.sustain){
				select.sustain = null;
				var rc = recorder.channels[IN.channel].sustain = select.sustainEvt;
				eventBar.sort(rc);
				for(var i=0; i < rc.length; i++){
					var r = rc[i];
					if(i>0 && r.v == rc[i-1].v){
						rc.splice(i,1);
						i--;
						continue;
					}
					if(i<rc.length-1 && r.t == rc[i+1].t){
						rc.splice(i,1);
						i--;
						continue;
					}
				}
				if(!rc[0].v)rc.shift();
				panel.refresh();
				view.draw();
			}
			if(IN.on[18] && grid.enable){
				select.selectedArr.forEach(function (e){
					var qt = recorder.ms2q(e.t);
					e.d = recorder.q2ms(Math.round((recorder.ms2q(e.t+e.d) - qt)*grid.detail)/grid.detail + qt)-e.t;
				});
				view.draw();
			}
		}
		$(obj).addEventListener("mouseup", mousefini);
		$(obj).addEventListener("mouseout", mousefini);
		$(obj).addEventListener("mousedown", function (evt) {
			panel.set(null);//close all the windows
			var Pos = p2p(obj,evt);
			if(evt.button == 2){
				if(!select.selectedArr.length && IN.on[18] && speedTrack.visible){
					speedTrack.toAppendPoint = {};
					eventBar.sort(recorder.speed);
					recorder.calculeQ();
					speedTrack.toAppend(Pos);
					speedTrack.append();
					speedTrack.changeAppend();
					
					view.ismove = true;
					view.draw();
				}
				if(IN.on[16]||IN.on[17]||IN.on[18]){
					//Ctrl+右键改sustain，shift+右键缩放音量，Alt+右键整体缩放音符
					view.oldPy = Pos.y;
					view.oldP = Pos.x/view.k+view.min;
					view.ismove = true;
				}else{
					view.setP(Pos.x/view.k+view.min);
					if(grid.enable) view.setP(grid.nearest(view.p));
					view.draw();
					recorder.isWait = true;
					recorder.isQuantify = false;
				}
			}else if(evt.button == 0){
				view.ismove = true;
				if(!select.selectedArr.length && IN.on[18] && speedTrack.visible){
					//不选中音符时，按Alt拖动选择控制点
					speedTrack.select = [Pos.x/view.k+view.min, Pos.x/view.k+view.min];
					return 0;
				}
				if(IN.on[16] || IN.on[18]){
				//hold alt: scale duration || hold shift: edit velocity
					view.oldP = Pos.x/view.k+view.min;
					return 0;
				}
				select.rect = {};
				if(!IN.on[17]){//not hold ctrl -> new select area 
					select.selectedArr = [];
				}
				select.rect.xa = select.rect.xb = Pos.x/view.k+view.min;
				select.rect.ya = select.rect.yb = Pos.y/view.nk+view.nmax;
				view.draw();
			}else {
				view.ismove = true;
				view.oldP = Pos.x/view.k+view.min;
			}
		});
		$(obj).addEventListener("mousemove", function (evt) { 
			var Pos = p2p(obj,evt);
			if(view.ismove){
				if(evt.buttons == 2 && IN.on[17]){//Ctrl+右键：sustain
					select.sustain = [view.oldP, Pos.x/view.k+view.min];
					view.draw();
				}else if(speedTrack.toAppendPoint && IN.on[18] && speedTrack.visible && evt.buttons == 2){//Alt+右键：speed
					speedTrack.toAppend(Pos);
					speedTrack.changeAppend();
					view.ismove = true;
					view.draw();
				}else if(evt.buttons == 2 && IN.on[16]){//shift+右键：力度缩放
					select.selectedArr.forEach(function (e){
						var scl = (view.height-Pos.y)/(view.height-view.oldPy);
						e.v = Math.min(e.v*scl,126);
					});
					view.draw();
					view.oldPy = Pos.y;
				}else if(speedTrack.select && evt.buttons == 1 && speedTrack.visible){//Alt+左键：speed
					//不选中音符时，按Alt拖动选择控制点
					speedTrack.select[1] = Pos.x/view.k+view.min;
					view.draw();
				}else if((evt.buttons==1 ||evt.buttons==2) && IN.on[18]){//alt+左右键：缩放时值
					var gap = Pos.x/view.k+view.min - view.oldP;
					select.selectedArr.forEach(function (e){
						e.d = e.d || 0;
						e.d += gap;
						if(e.d<=0)e.d = undefined;
					});
					view.oldP = Pos.x/view.k+view.min;
					view.draw();
				}else if(evt.buttons==1 && IN.on[16]){//shift+左键：力度绘制
					var gap = Pos.x/view.k+view.min;
					select.selectedArr.forEach(function (e){
						if(e.t<view.oldP ^ e.t<gap) e.v = Math.min(Math.round(view.height-Pos.y),127);
					});
					view.oldP = Pos.x/view.k+view.min;
					view.draw();
				}else if(evt.buttons!==4){
					select.rect.xb = Pos.x/view.k+view.min;
					select.rect.yb = Pos.y/view.nk+view.nmax;
					view.draw();
				}else if(evt.buttons===4){
					var gap = Pos.x/view.k+view.min - view.oldP;
					view.min -= gap;
					view.max -= gap;
					view.oldP = Pos.x/view.k+view.min;
					view.draw();
				}
			}
		});
		if(!Math.sign) Math.sign = function (x) { return typeof x === 'number' ? x ? x < 0 ? -1 : 1 : x === x ? 0 : NaN : NaN;}
		$(obj).addEventListener("mousewheel", function (evt) { 
			var Pos = p2p(obj,evt);
			var dx = Math.sign(event.wheelDelta) * (view.max - view.min)*0.1;
			if((view.max-view.min<50 && dx>0) || (view.max-view.min>5000000&& dx<0))return 0;
			var ddx = Pos.x/view.width;
			view.max -= dx*(1-ddx);
			view.min += dx*ddx;
			view.k = view.width / (view.max - view.min);
			view.nk = view.height / (view.nmin - view.nmax);
			view.draw();
		});
		window.addEventListener("resize", function () {
			view.width = $(obj).width = window.innerWidth-20;
			view.height = $(obj).height = window.innerHeight-20;
			view.k = view.width / (view.max - view.min);
			view.nk = view.height / (view.nmin - view.nmax);
			view.draw();
		}, false);
	},
	INKey: function (){
		document.addEventListener('keydown', function( ev ) {
			if(IN.on[ev.keyCode]||(!IN.enable))return 0 ;
			var note;
			IN.on[ev.keyCode] = true;
			var pressnote = null;//record note lig si synchronized con presstr //"\t";//0x08 initial empty note

			if(IN.on[27])recorder.stop();// press Esc to stop
			if(IN.on[17] && IN.on[191] && grid.enable){// press Ctrl+/? for prev grid
				view.moveP(grid.prev());
				recorder.isWait = true;
				recorder.isQuantify = false;
				view.draw();
			}
			if(ev.keyCode == 191||ev.keyCode == 190||ev.keyCode == 20){
				if(grid.enable){
					// press /?  .>  tab for next grid
					grid.IN(ev.keyCode == 191 ? 0:null);//续不续duration
				}else{
					//切分音
					IN.toggleSus(true);//true 代表recorder要记录
				}
			}
			if(IN.on[17]){// Ctrl + 
				switch(ev.keyCode){
					case 65://A
						select.all();
					break;
					case 90://Z
						select.undo();
					break;
					case 89://Y
						select.redo();
					break;
					case 88://X
						select.cut();
					break;
					case 67://C
						select.copy();
					break;
					case 86://V
						select.paste();
					break;
					case 66://Enter
						recorder.goBack();
					break;
					case 219://[
						select.scale(0.5);
					break;
					case 221://]
						select.scale(2);
					break;
					default:
						note = {37: 1, 38: 4, 39: 3, 40: 2}[ev.keyCode];
						//Ctrl + 方向键细分网格
						if(note){
							grid.detail = note;
							//新加入的同时按下获得更多细分
							if(IN.on[38] && IN.on[40]) grid.detail = 8;
							if(IN.on[39] && IN.on[40]) grid.detail = 6;
							//获得更粗的量化
							if(IN.on[37] && IN.on[38]) grid.detail = 1/4;
							if(IN.on[37] && IN.on[39]) grid.detail = 1/3;
							if(IN.on[37] && IN.on[40]) grid.detail = 1/2;
							view.draw();
							note = null;
						}
				}
			}else if (select.selectedArr.length){// modify mode
				switch(ev.keyCode){
					case 8: case 46: //del, backspace
						select.del();
					break;
					case 38://up
						select.up();
					break;
					case 40://down
						select.down();
					break;
				}
				note = null;
			}else if(IN.on[18] && ev.keyCode == 82){// alt + R
				recorder.recordQuantify();
			}else if(IN.on[18] && ev.keyCode == 84){// alt + T
				volumeTrack.visible = false;
				speedTrack.toggle();
			}else if(IN.on[18] && ev.keyCode == 68){// alt + W
				IN.keysig -= 6;
				panel.refresh();
				view.draw();
			}else if(IN.on[18] && ev.keyCode == 86){// alt + V
				speedTrack.visible = false;
				volumeTrack.visible = !volumeTrack.visible;
				view.draw();
			}else if(IN.on[18] && ev.keyCode == 69){// alt + E
				IN.keysig += 6;
				panel.refresh();
				view.draw();
			}else if(IN.on[16] && ev.keyCode == 192){// shift + ~
				IN.keysig++;
				panel.refresh();
				view.draw();
			}else if(IN.on[18] && ev.keyCode == 192){// alt + ~
				IN.keysig--;
				panel.refresh();
				view.draw();
			}else if(IN.on[18] && ev.keyCode >= 48 && ev.keyCode <= 100){// alt + [0-7]
				IN.keysig = 0; IN.keyFlat = ""; IN.keySharp = "";
				if(ev.keyCode <= 55){
					if(IN.on[192]){//// alt + ~` + [0-7]
						IN.keyFlat = "736251".slice(0,ev.keyCode-48);
					}else{
						IN.keySharp = "4152637".slice(0,ev.keyCode-48);
					}
				}
				panel.refresh();
				view.draw();
			}else if(IN.mode == "eop"){
				//方向键临时升降调：
				var temparr = (IN.on[192]||IN.on[16]) ? 
					{37: "2", 38: "3", 39: "7", 40: "6"} : 
					{37: "1", 38: "4", 39: "6", 40: "5"}; // hold key "~" o shift(code:192)
				note = temparr[ev.keyCode];
				if(note){
					if(IN.on[192]||IN.on[16]) {
						IN.strFlat += note;
					}else{ IN.strSharp += note;
						IN.keepfirsttemp = false;
					}
				}
				note = IN.Eop[ev.keyCode];
				if(!note){
					if(ev.keyCode == 16){ //shift 
						IN.strSharp = "";
						IN.strFlat = "";
						IN.keepfirsttemp = false;
						if(!(IN.on[32]||IN.on[192]))IN.tempsig = 0;
						//remove effect of space tempdig
					}else if(ev.keyCode == 32) {
						IN.tempsig = 1;
						IN.keepfirsttemp = true;
					}else if(ev.keyCode == 192) {
						IN.tempsig = -1;
						IN.keepfirsttemp = true;
					};
					panel.refresh();
					view.draw();
				}
			}else if(IN.mode == "ki"){
				note = IN.Ki[ev.keyCode];
			}
			if(IN.keyFlat!="")view.list = view.flatlist;
			else if(IN.keySharp!="")view.list = view.sharplist;
			else if(IN.strFlat!="")view.list = view.flatlist;
			else if(IN.strSharp!="")view.list = view.sharplist;
			else if(IN.tempsig<0)view.list = view.flatlist;
			else if(IN.tempsig>0)view.list = view.sharplist;
			if(note) {
				if(grid.enable && !MIDI.channels[IN.channel].sustain){
					note = IN.ki(note,grid.gap/grid.detail);
				}else{
					note = IN.ki(note);
				}
				IN.keepfirsttemp = false;
				if(!(IN.on[32]||IN.on[192]))IN.tempsig = 0;
				//remove effect of space tempdig
				if(grid.enable && !recorder.isQuantify){
					grid.IN(note);
				}else if(recorder.isQuantify && !(recorder.isRecord === false)){
					pressnote = recorder.record(IN.channel, note, PLAYER.autoVolume(note));
					var Q = recorder.ms2q(pressnote.t);
					pressnote.t = recorder.q2ms(Math.round(Q*grid.detail)/grid.detail);
					if(grid.enable){
						pressnote.d = recorder.q2ms((Math.round(Q*grid.detail)+1)/grid.detail)-pressnote.t;
					}
				}else if(!(recorder.isRecord === false)){
					pressnote = recorder.record(IN.channel, note, PLAYER.autoVolume(note));
				}
				IN.pressnote[ev.keyCode] = pressnote;
			}
			MIDI.channels[IN.channel].onNote[note] = true;
			ev.preventDefault();
		});
		document.addEventListener('keyup', function( ev ) {
			var key = String.fromCharCode(ev.keyCode);
			if(ev.keyCode == 32 || ev.keyCode == 192 ){
				if(!IN.keepfirsttemp){
					IN.tempsig = 0;
				}
			}else if((ev.keyCode == 191 ||ev.keyCode == 190||ev.keyCode == 20) && !grid.enable){
				IN.toggleSus(true);//true 代表recorder要记录
				view.draw();
			}
			var n = IN.pressnote[ev.keyCode];
			if(n){
				if(!MIDI.channels[IN.channel].sustain){
					MIDI.noteOff(IN.channel,n.n);
				}
				if(!(recorder.isQuantify && !(recorder.isRecord === false) && grid.enable)){
					n.d = new Date().getTime() - n.t - recorder.offset;
					view.draw();
				}
					MIDI.channels[IN.channel].onNote[n.n] = false;
				
			}
			IN.pressnote[ev.keyCode] = false;
			IN.on[ev.keyCode] = false;
		});
	}
}

/**
	Panel
		buttons: btnJSON[];
		$();
		refresh();
**/

langue = {
	di: function(){
		this.play = "ZEU";
		this.stop = "RET";
		this.save = "ANJ";
		this.edit = "CHH";
		this.open = "JA";
		this.close = "JE";
		this.midi = "EQETO";
		this.scale = "Scale";
		this.grid = "GRD";
		this.tempo = "FF";
		this.sus = "SUS";
		this.channel = "Channel";
		this.record = "RIE";
	},
	zh: function(){
		this.play = "&#x25b6;";
		this.stop = "&#x2586;";
		this.record = "&#x25CF;";
		this.save = "保存";
		this.edit = "编辑";
		this.open = "加载";
		this.close = "OK";
		this.midi = "下载Midi";
		this.scale = "缩放";
		this.grid = "网格";
		this.tempo = "速度";
		this.sus = "延音";
		this.channel = "通道";
	},
	en: function(){
		this.play = "&#x25b6;";
		this.stop = "&#x2586;";
		this.record = "&#x25CF;";
		this.save = "Save";
		this.edit = "Edit";
		this.open = "Load";
		this.close = "OK";
		this.midi = "Get Midi";
		this.scale = "Scale";
		this.grid = "Grid";
		this.tempo = "Tempo";
		this.sus = "Sus";
		this.channel = "Channel";
	},
}
LAN = new langue.zh();

panel = {
	buttons: [
		{name:LAN.play, className:"blue", action: recorder.play},
		{name:LAN.record, className:"blue", action: recorder.recordQuantify},
		{name:LAN.stop, className:"blue", action: recorder.stop},
		{name:LAN.edit, className:"blueOff", action: "disabled"},
		{name:"|<", className:"blue", action: recorder.goBack},
		{name:">|", className:"blue", action: function (){view.moveP(recorder.ctxt[recorder.ctxt.length-1].t)}},
		{name:"Keysig", className:"dis", action: "disabled"},
		{name:"strSharp", className:"dis", action: "disabled"},
		{name:"strFlat", className:"dis", action: "disabled"},
		{name:"keyTemp", className:"keytemp", action: "disabled"},
		{name:"EOP", className:"green", action: function (){
			IN.mode = (IN.mode=="eop")?"ki":"eop";
			$("EOP").innerHTML = IN.mode.toUpperCase();
		}},
		{name:LAN.sus, className:"green", action: IN.toggleSus},
		{name:"volume", className:"green", action: "disabled"},
		{name:LAN.channel, className:"green", action: function(){
			panel.set(LAN.channel);
		}},
		{name:LAN.save, className:"red", action: function (){
			recorder.sort();
			var needV = needD = false;
			recorder.ctxt.forEach(function(e){
				if(e.v)needV = true;
				if(e.d)needD = true;
			});
			var str = xcode.en(recorder.ctxt, grid.enable?grid.gap:0,needV,needD)
			panel.set(LAN.save);
			$("output").value = str;
			
		}},
		{name:LAN.open, className:"red", action: function (){
			panel.set(LAN.open);
			$("output").value = "";
		}},
		{name:LAN.grid, className:"yellow", action: function (){
			grid.set(!grid.enable);
			if(grid.enable){
				recorder.isWait = true;
				recorder.isQuantify = false;
				view.setP(grid.nearest(view.p));
			}
			view.draw();
			
		}},
		{name:LAN.tempo, className:"yellow", action: function (){
			panel.set(LAN.tempo);
		}},
		{name:"？", className:"white", action: function (){
			panel.set("？");
		}}
	],
	set: function (str){
		$("dialog").style.display = "none";
		$("tempo").style.display = "none";
		$("channel").style.display = "none";
		$("help").style.display = "none";
		switch(str){
			case LAN.save: 
				panel.btnJe.innerHTML = LAN.midi
				$("dialog").style.display = "block";
				panel.input_browse.style.display = "none";
			break;
			case LAN.open:
				panel.btnJe.innerHTML = LAN.open;
				$("dialog").style.display = "block";
				panel.input_browse.style.display = "block";
			break;
			case LAN.tempo:
				$("tempo").style.display = "block";
			break;
			case LAN.channel:
				$("channel").style.display = "block";
			break;
			case "？":
				$("help").style.display = "block";
			break;
		}
		panel.dialog = str;
	},
	$: function (){// initiate
		var Panel = document.createElement("DIV");
		var Dialog = document.createElement("DIV");
		var Tempo = document.createElement("DIV");
		var Channel = document.createElement("DIV");
		var Help = document.createElement("DIV");
		var TA = document.createElement("TEXTAREA");
		var BTN = document.createElement("BUTTON");
		var BROWSE = document.createElement("INPUT");
		BROWSE.type = "file";
		BROWSE.accept = ".midi,.mid";
		BTN.innerHTML = LAN.open;
		panel.btnJe = BTN;
		panel.input_browse = BROWSE;
		BROWSE.onchange = function (){
			ImpMidi.load(BROWSE);
		}
		BTN.onclick = function (){
			Dialog.style.display = "none";
			if(panel.dialog == LAN.open){
				recorder.ctxt = xcode.de($("output").value);
				view.draw();
			}else if(panel.dialog == LAN.save){
				ExpMidi.saveMIDIFile();
			}
			panel.dialog = null;
		}
		Panel.className = "panel";
		Channel.className = "channel";
		Tempo.className = "tempo";
		Help.className = "help";
		Dialog.className = "dialog";
		BTN.className = "dialog";
		TA.className = "dialog";
		Tempo.id = "tempo";
		Help.id = "help";
		Dialog.id = "dialog";
		TA.id = "output";
		Channel.id = "channel";
		TA.onfocus = function(){IN.enable = false};
		TA.onblur = function(){IN.enable = true};
		Dialog.appendChild(TA);
		Dialog.appendChild(BTN);
		Dialog.appendChild(BROWSE);
		panel.dialog = null;
		panel.buttons.forEach(function (e){
			var btn = document.createElement("BUTTON");
			btn.innerHTML = e.name;
			btn.id = e.name;
			btn.className = e.className;
			if(e.action == "disabled"){
				btn.disabled = "disabled";
			}
			btn.onclick = e.action;
			btn.onfocus = function (){this.blur();return false;};
			Panel.appendChild(btn);
			e.btn = btn;
		});
		document.body.appendChild(Panel);
		document.body.appendChild(Channel);
		document.body.appendChild(Dialog);
		document.body.appendChild(Tempo);
		document.body.appendChild(Help);
		var tempoHTML = 'x<input id="playSpeed" value="1" style="width:30px" onfocus="IN.enable = false" onblur="IN.enable = true" onchange="recorder.setSpeed(Number(this.value));"> <input onfocus="this.blur();return false;" style="width:70px; height:10px;" id="playSpeedBar" type="range" min="0" max="200" value="100" onchange="recorder.setSpeed(this.value/100);"> <button onclick="recorder.scale();view.draw();">'+LAN.scale+'</button><hr>&#9833; = <input id="bpm" value="120" style="width:30px" onfocus="IN.enable = false" onblur="IN.enable = true"> <button onclick="grid.gap=60/$(\'bpm\').value*1000;view.draw();">Set</button> <button onclick="recorder.setSpeed($(\'bpm\').value*grid.gap/60000);recorder.scale();view.draw();">'+LAN.scale+'</button>';
		var helpHTML = $('txthelp').innerHTML;
		Tempo.innerHTML = tempoHTML;
		Help.innerHTML = helpHTML;
		$("volume").innerHTML = '<input onfocus="this.blur();return false;" style="width:70px; height:10px;" type="range" min="0" max="200" value="100" onchange="MIDI.masterGain.gain.value = (this.value / 100);" onmousemove="MIDI.masterGain.gain.value = (this.value / 100);">';
		$("volume").style.width = "74px";
		panel.refreshChannelPanel();
		panel.refresh();
	},
	
	refresh: function (){
		var i = Math.floor(IN.keysig/12);
		$("Keysig").innerHTML = ['C','<i>#</i>C','D','<i>#</i>D/<i>b</i>E','E','F','<i>#</i>F/<i>b</i>G','G','<i>#</i>G/<i>b</i>A','A','<i>#</i>A/<i>b</i>B','B/<i>b</i>C'][(IN.keysig+120) % 12] + "<span class='small'>" + (i==0?"":i==1?"+":i==-1?"-":i) + "</span>";
		$("strSharp").innerHTML = "<i>#</i>"+IN.strSharp;
		$("strFlat").innerHTML = "<i>b</i>"+IN.strFlat;
		$("keyTemp").innerHTML = IN.keySharp.length?("<i>#</i>"+IN.keySharp):(IN.keyFlat.length?("<i>b</i>"+IN.keyFlat):"&#9838;");
		$(LAN.sus).className = (MIDI.channels[IN.channel].sustain)?"greenOn":"green";
	},
	writeSelectSF: function(name){
		var chooseSF = "";
		for(var i in SoundfontConfigs){
			selected = (name == i) ? " selected": "";
			chooseSF += '<option value="'+i+'"'+selected+'>'+i+'</option>';
		}
		chooseSF += '</select>';
		return chooseSF;
	},
	refreshChannelPanel: function(){
		var channelHTML = "";
		
		for(var i in MIDI.channels){
			var v = MIDI.channels[i].view ? " checked" : "";
			var s = MIDI.channels[i].sound ? " checked" : "";
			var l = MIDI.channels[i].lock ? " checked" : "";
			var INC = IN.channel == i ? " checked" : "";
			var volume = `<input onfocus="this.blur();return false;" style="width:70px; height:10px;" type="range" min="0" max="200" value="`+MIDI.channels[i].gainNode.gain.value*100+`" onchange="MIDI.channels[`+i+`].gainNode.gain.value = (this.value / 100);" onmousemove="MIDI.channels[`+i+`].gainNode.gain.value = (this.value / 100);">`;
			channelHTML += `
				<label><input onclick='IN.setChannel(`+i+`);view.draw()' type='radio' name='INChannel' id='radioINC`+i+`'`+INC+` value='`+i+`'/>`+i+`</label>
				<label><input onchange='MIDI.channels[`+i+`].view = this.checked;view.draw()' type='checkBox' id='checkV`+i+`'`+v+`/>View</label>
				<label><input onchange='MIDI.channels[`+i+`].sound = this.checked' type='checkBox' id='checkS`+i+`'`+s+`/>Sound</label>
				<label><input onchange='MIDI.channels[`+i+`].lock = this.checked;view.draw()' type='checkBox' id='checkL`+i+`'`+l+`/>Lock</label>`+volume+`<select onchange='panel.addSoundFont(SoundfontConfigs[this.value],`+i+`)'>` + panel.writeSelectSF(MIDI.channels[i].soundfontConfig.name)+`
				<br>
			`;
		}
		
		channelHTML += `<button onclick="panel.addSoundFont(SoundfontConfigs[$('sfadd').value])">Add</button><select id="sfadd">` + panel.writeSelectSF();
		channelHTML += '<br><span id="ChannelProgress"></span>';
		$("channel").innerHTML = channelHTML;
	},
	addSoundFont: function(sf,id){
		MIDI.onprogress = function(msg){
			$("ChannelProgress").innerHTML = msg;
		}
		MIDI.loadSoundFont(sf,function (){
			$("ChannelProgress").innerHTML = '';
		},id);
		IN.channel = 0;
		panel.refreshChannelPanel();
	}
}
