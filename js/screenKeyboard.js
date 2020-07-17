var screenKeyboard = {
    config: {
        name: [
            ["`~","1!","2@","3#","4$","5%","6^","7&","8*","9(","0)","-_","=+","Backspace"],
            ["Tab     ","Q","W","E","R","T","Y","U","I","O","P","[{","]}","\\|  "],
            ["CapsLock  ","A","S","D","F","G","H","J","K","L",";:","'\"","    Enter"],
            ["LShift       ","Z","X","C","V","B","N","M",",<",".>","/?","       RShift"],
            ["Ctrl  ","Alt  ","                                             Space   ","←","↑","↓","→"],
        ],
        key:[
            [192,49,50,51,52,53,54,55,56,57,48,189,187,8],
            [9,81,87,69,82,84,89,85,73,79,80,219,221,220],
            [20,65,83,68,70,71,72,74,75,76,186,222,13],
            [16,90, 88, 67, 86, 66, 78, 77, 188,190,191,16],
            [17,18,32,37,38,40,39],
        ],
        range:[]
    },
    draw: function(init){
		if($("ioorpon").style.display=="none") return 0;
        var ctxt = ctxt$("ioorpon");
        ctxt.clearRect(0,0,2000,2000);
        var s = screenKeyboard.size;
        ctxt.font = (s*0.3)+"px Georgia";
        var line = 0;
        var gap = screenKeyboard.gap*s;
        var maxX = 0;
        for(var ioorlilen = 0; ioorlilen < screenKeyboard.config.name.length; ioorlilen++){
            var y = line*(s+gap)+screenKeyboard.margin;
            var x = screenKeyboard.margin;
            var ioorl = screenKeyboard.config.name[ioorlilen];
            if(init) screenKeyboard.config.range.push([]);
            for(var ioo = 0; ioo < ioorl.length; ioo++){
                var i = ioorl[ioo];
                var dx = (Math.max(0.15,(i.length-2)*0.15) + 0.85)*s;
                var key = screenKeyboard.config.key[ioorlilen][ioo];
                ctxt.fillStyle = IN.on[key]?"#6F9":"#DDD";
                ctxt.fillRect(x,y,dx,s);
                if(init){
                    var ranl = screenKeyboard.config.range[ioorlilen];
                    ranl.push(x/s,(x+dx)/s);
                }
                ctxt.fillStyle = "#222";
                ctxt.fillText(i,x+6,y+s*0.5);
                x += dx+gap;
                var note = null;
                var fnkey = key==20?"Pedal":null;
                if(IN.on[17]){
                    fnkey = {192:"SigInv",65:"All",68:"Resel",90:"Undo",89:"Redo",88:"Cut",67:"Copy",86:"Paste",79:"Open",83:"Save",37:"1/1",38:"1/4",40:"1/2",39:"1/3",77:"Track",219:"|←",221:"|→"}[key];
                }else if(IN.on[18]&&!select.selectedArr.length){
                    fnkey = {81:"♮",69:"Sig++",68:"Sig--",192:"Sig-",49:"#",50:"##",51:"###",52:"####",53:"#5",54:"#6",55:"#7",84:"Speed",83:"Sustn"}[key];
                    if(IN.on[192]) fnkey = fnkey || {49:"b",50:"bb",51:"bbb",52:"bbbb",53:"b5",54:"b6",55:"b7"}[key];
                }else if(IN.mode=="eop"){
                    if(!select.selectedArr.length){
                        if(IN.on[16]){
                            fnkey = {192:"Sig+"}[key];
                            fnkey = fnkey||((!IN.inverseTempsig)?{16:"♮",32:"b",192:"#",37:"b2",38:"b3",40:"b6",39:"b7",191:"b5"}:{16:"♮",32:"#",192:"b",37:"#1",38:"#4",40:"#5",39:"#6",191:"#2"})[key];
                        }
                        fnkey = fnkey||((IN.inverseTempsig^IN.on[192])?{190:"Pedal",16:"♮",32:"b",192:"#",37:"b2",38:"b3",40:"b6",39:"b7",191:"b5"}:{190:"Pedal",16:"♮",32:"#",192:"b",37:"#1",38:"#4",40:"#5",39:"#6",191:"#2"})[key];
                        if(IN.Eop[key]){
                            note = IN.Eop[key];
                            note = IN.ki(note,0,true);
                            var key = ((view.list == view.flatlist)?MIDI.noteToKeyF:MIDI.noteToKeyS)[note];
                            if(key){
                                note -= IN.keysig;
                                ctxt.fillStyle = "#F00";
                                ctxt.fillText(key.replace(/(.)s/g,"#$1").replace(/(.)b/g,"b$1"),x-s*0.7,y+s*0.3);
                            }else{note = null;}
                        }
                    }
                }else if(IN.mode=="ki" && !select.selectedArr.length){
                    note = IN.Ki[key];
                    if(IN.on[16]) fnkey = fnkey||({192:"Sig+"}[key]);
                    if(note){
                        note += IN.keysig;
                        var key = ((view.list == view.flatlist)?MIDI.noteToKeyF:MIDI.noteToKeyS)[note];
                        if(key){
                            ctxt.fillStyle = "#F00";
                            ctxt.fillText(key.replace(/(.)s/g,"#$1").replace(/(.)b/g,"b$1"),x-s*0.7,y+s*0.3);
                            note -= IN.keysig;
                        }else{note = null;}
                    }
                }
                if(select.selectedArr.length){
                    fnkey = {20:" ", 38:"  ↑",40:"  ↓",8:"Del",16:"Vel",18:"Dur"}[key]||fnkey;
                }
                if(note){
                    note += Math.floor((IN.keysig+4)/12)*12;
                    var Nsf = (view.list == view.flatlist)?['1','b2','2','b3','3','4','b5','5','b6','6','b7','7']:['1','#1','2','#2','3','4','#4','5','#5','6','#6','7'];
                    var octave = ['.....','....','...','..','.','','\'','\'\'','\'\'\'','\'\'\'\''][Math.floor(note/12)];
                    var N = Nsf[note % 12]+octave;
                    ctxt.fillStyle = "#00F";
                    ctxt.fillText(N,x-s*0.9,y+s*0.8);
                }
                if(grid.enable){
                    fnkey = {190:">",191:">-"}[key]||fnkey;
                }
                if(fnkey){
                    ctxt.fillStyle = "#407";
                    ctxt.fillText(fnkey,x-s*0.9,y+s*0.3);
                }
            }
            maxX = Math.max(x,maxX);
            line++;
        }
        if(init) screenKeyboard.maxX = maxX / s;
    },
    size: 40,
    margin: 4,
    gap: 2/40,
    resize: function(w,h){
        if(!screenKeyboard.maxX) screenKeyboard.draw(true);//init flag
        w -= 90;
        screenKeyboard.size = Math.min(1000,w)/screenKeyboard.maxX;
        var ioor = $("ioorpon");
        ioor.width = Math.min(1000,w) + screenKeyboard.margin;
        ioor.height = screenKeyboard.size*(1+2/40)*5 + screenKeyboard.margin*2 + 10;
        screenKeyboard.draw();
    },
    currentDown: {0:null},
    hitTest: function(e,index){
        var iobj = $('ioorpon');
        var p2p = function (obj,evt){
			var rect = obj.getBoundingClientRect(); 
			return p(
				evt.clientX - rect.left * (obj.width / rect.width),
				evt.clientY - rect.top * (obj.height / rect.height)
			);
		}
        var s = screenKeyboard.size;
        var mp = p2p(iobj,e.clientX?e:e.changedTouches[index||0]);
        mp.x /= screenKeyboard.size;
        mp.y /= screenKeyboard.size;
        var margins = screenKeyboard.margin/s;
        var gaps = screenKeyboard.gap;
        var yRange = [
            margins, margins+1, margins+gaps+1, margins+gaps+2, margins+2*gaps+2, margins+2*gaps+3, margins+3*gaps+3, margins+3*gaps+4, margins+4*gaps+4, margins+4*gaps+5
        ]
        var xRange = screenKeyboard.config.range;
        var order = function(x,list){
            var i = 0;
            while(x > list[i] && i<list.length){
                i++;
            }
            return i;
        }
        var yder = order(mp.y,yRange);
        if(yder%2){
            var yindex = (yder-1)/2;
            var xder = order(mp.x,xRange[yindex]);
            if(xder%2){
                var xindex = (xder-1)/2;
                //$("progress").innerHTML="start: "+yindex+','+xindex+":"+"<br>";
                return [yindex,xindex];
                
            }
        }
        return false;
    },
    dragging: false,
    ismousedown: {0:false},
    init: function(){
        var iobj = $('ioorpon');
        iobj.style.position = 'absolute';
        iobj.style.left = window.innerWidth*0.2+" px";
        iobj.style.top = window.innerHeight-40+" px";
        screenKeyboard.resize(window.innerWidth,window.innerHeight);
        var p2p = function (obj,evt){
			var rect = obj.getBoundingClientRect(); 
			return p(
				evt.clientX - rect.left * (obj.width / rect.width),
				evt.clientY - rect.top * (obj.height / rect.height)
			);
        }
        var mstart = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            var Force = (e.changedTouches?e.changedTouches[index].force:null);
            Force = Force || (e.changedTouches? (e.changedTouches[index].radiusX+e.changedTouches[index].radiusY)/100-0.4:null);
            //$("progress").innerHTML=Force||"";
            var keyindex = screenKeyboard.hitTest(e,index);
            if(keyindex){
                screenKeyboard.currentDown[num] = screenKeyboard.config.key[keyindex[0]][keyindex[1]];
                //$("progress").innerHTML="start: "+JSON.stringify(screenKeyboard.currentDown)+"<br>";
                IN.onkeydown({force:Force,keyCode: screenKeyboard.currentDown[num], preventDefault:function(){}});
                screenKeyboard.ismousedown[num] = isNaN(e.button)?1:(e.button+1);
                
            }else if((!e.changedTouches)||e.touches.length==1){
                screenKeyboard.dragging = true;
                screenKeyboard.oldx = iobj.offsetLeft;
                screenKeyboard.oldy = iobj.offsetTop;
                screenKeyboard.moldx = e.clientX || e.changedTouches[0].clientX;
                screenKeyboard.moldy = e.clientY || e.changedTouches[0].clientY;
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mstart(e,++index);
            }
            e.preventDefault();
        };
        var mmove = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            if((!screenKeyboard.dragging) && screenKeyboard.ismousedown[num] == 1){
                var keyindex = screenKeyboard.hitTest(e,index);
                
                if(!keyindex){
                    IN.onkeyup({keyCode: screenKeyboard.currentDown[num], preventDefault:function(){}});
                    screenKeyboard.currentDown[num] = null;
                }else{
                    var ckey = screenKeyboard.config.key[keyindex[0]][keyindex[1]];
                    if(ckey != screenKeyboard.currentDown[num]){
                        if(screenKeyboard.currentDown[num])
                        IN.onkeyup({keyCode: screenKeyboard.currentDown[num], preventDefault:function(){}});
                        var Force = (e.changedTouches?e.changedTouches[index].force:null);
                        Force = Force || (e.changedTouches? (e.changedTouches[index].radiusX+e.changedTouches[index].radiusY)/100-0.4:null);
                        IN.onkeydown({force:Force, keyCode: ckey, preventDefault:function(){}});
                        screenKeyboard.currentDown[num] = ckey;
                    }
                }
            }else if(screenKeyboard.dragging && ((!e.touches) || e.touches.length==1)){
                if(e.clientX){
                    iobj.style.left = e.clientX - screenKeyboard.moldx + screenKeyboard.oldx + 'px';
                    iobj.style.top = e.clientY - screenKeyboard.moldy + screenKeyboard.oldy + 'px';
                }else{
                    iobj.style.left = e.changedTouches[0].clientX - screenKeyboard.moldx + screenKeyboard.oldx + 'px';
                    iobj.style.top = e.changedTouches[0].clientY - screenKeyboard.moldy + screenKeyboard.oldy + 'px';
                }
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mmove(e,++index);
            }
            try{e.preventDefault();}catch(e){}
        };
        var mup = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            //$("progress").innerHTML="up: "+num+"<br>";
            screenKeyboard.ismousedown[num] = false;
            if(!screenKeyboard.dragging && (isNaN(e.button)||e.button == 0)){
                var keyindex = screenKeyboard.hitTest(e,index);
                if(keyindex && screenKeyboard.config.key[keyindex[0]][keyindex[1]] == screenKeyboard.currentDown[num]){
                    IN.onkeyup({keyCode: screenKeyboard.currentDown[num], preventDefault:function(){}});
                    screenKeyboard.currentDown[num] = null;
                }else{

                }
            }else{
                screenKeyboard.dragging = false;
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mup(e,++index);
            }
        };
        iobj.addEventListener("touchstart",mstart)
        iobj.addEventListener("mousedown",mstart);
        document.addEventListener("mousemove",mmove);
        document.addEventListener("touchmove",mmove);
        document.addEventListener("mouseup",mup);
        document.addEventListener("touchend",mup);
        iobj.addEventListener("contextmenu", function (evt) {evt.preventDefault(); }, false);
    }
};
var kipon = {
    draw: function(init){
        if($("kiboard").style.display=="none") return 0;
        var ki = $("kiboard");
        var ctxt = ctxt$("kiboard");
        ctxt.clearRect(0,0,2000,2000);
        var w = ki.width, h = ki.height-kipon.ioorSize*0.4, s = kipon.ioorSize;
        ctxt.font = (s*0.3)+"px Georgia";
        ctxt.strokeStyle = "#000";
        var y = kipon.margin;
        var dh = h/kipon.rows;
        for(var r = 0; r < kipon.rows; r++,y+=dh){
            var x = kipon.xpos[r];
            ctxt.fillStyle = "#000";
            for(var n = A0; n<= C8; n++){
                var black = [0,3,0,0,1,0,3,0,0,1,0,2][(n-A0)%12];
                //0: hqer, 1-3: hqo: 1 ane 2 cne 3 dne offset
                if(black){
                    var xp = x+s*(-0.54+black*(2*0.56-1));
                    if(x>-100&&x<w+200) ctxt.fillRect(xp,y,s*0.58,dh*kipon.bw_lengthRatio);//0.58:7/12
                    if(init&&!r){
                        kipon.xbwRange.push((xp-kipon.xpos[r])/s-kipon.hitDelta);
                        kipon.xbwRange.push((xp-kipon.xpos[r])/s+0.58+kipon.hitDelta);
                    }
                }else{
                    if(x>-100&&x<w+200){
                        ctxt.strokeRect(x,y,s,dh);
                        ctxt.fillText(MIDI.noteToKeyS[n],x+s*0.4,y+dh*4/5);
                    }
                    if(init&&!r){
                        if((n-A0)%12==3||(n-A0)%12==8){//BC EF
                            kipon.xbwRange.push((x-kipon.xpos[r])/s);
                        }
                        kipon.xwRange.push((x-kipon.xpos[r])/s);
                    }
                    x += s;
                }
                
            }
            ctxt.fillStyle = "#AAA";
            ctxt.fillRect(0,y,s*kipon.sideSize,dh);
            ctxt.fillRect(w-s*kipon.sideSize,y,s*kipon.sideSize,dh);
            ctxt.fillStyle = "#CDDEEC";
            ctxt.fillRect(0,y,s*kipon.sideSize,dh*kipon.bw_lengthRatio);
            ctxt.fillRect(w-s*kipon.sideSize,y,s*kipon.sideSize,dh*kipon.bw_lengthRatio);
            ctxt.fillStyle = "#055";
            ctxt.fillText("<<",s*0.1,y+dh*2/5);
            ctxt.fillText(">>",w-s*kipon.sideSize+s*0.1,y+dh*2/5);
        }
    },
    ioorSize: 80,
    sideSize: 0.5,//side btn relative to key
    hitDelta: 0.15,//黑键hitTest要比实际显示胖delta个白键宽
    xbwRange: [],//an initial hitTest xRange for bw area
    xwRange: [],//an initial hitTest xRange for w area
    bw_lengthRatio: 0.58,
    xpos: [-700,-350,0,-350,-350,-350,-350,-350],
    channels: [0,0,0],
    rows: 1,
    margin: 4,
    gap: 2/40,
    resize: function(w,h){
        w -= 60;
        var ioor = $("kiboard");
        ioor.width = w;
        ioor.height = h - 80;
        kipon.draw();
    },
    currentDown: {0:null},
    hitTest: function(e,index){
        //$("progress").innerHTML="hittest<br>";
        var iobj = $('kiboard');
        var p2p = function (obj,evt){
			var rect = obj.getBoundingClientRect(); 
			return p(
				evt.clientX - rect.left * (obj.width / rect.width),
				evt.clientY - rect.top * (obj.height / rect.height)
			);
        }
        var mp = p2p(iobj,e.clientX?e:e.changedTouches[index||0]);
        var w = iobj.width, h = iobj.height-kipon.ioorSize*0.4, s = kipon.ioorSize, margin = kipon.margin;
        var dh = h/kipon.rows;
        var yRange = [margin];
        for(var i=1; i<=kipon.rows; i++){
            yRange.push(i*dh-dh*(1-kipon.bw_lengthRatio)+margin,i*dh+margin);
        }
        var xRange = screenKeyboard.config.range;
        var order = function(x,list){
            var i = 0;
            while(x > list[i] && i<list.length){
                i++;
            }
            return i;
        }
        var yder = order(mp.y,yRange);
        //$("progress").innerHTML="y: "+yder+"<br>";
        if(yder>kipon.rows*2){

        }else if(yder%2){
            var yindex = (yder-1)/2;
            var xder = order((mp.x-kipon.xpos[yindex])/s,kipon.xbwRange);
            if(mp.x<kipon.sideSize*s) {
                return [-1,yindex];
            }else if(mp.x>w-kipon.sideSize*s){
                return [1,yindex];
            }else{
                //$("progress").innerHTML="n: "+MIDI.noteToKeyS[xder+A0]+"<br>";
                return [xder+A0,yindex];
            }
        }else{
            var yindex = yder/2-1;
            var xder = order((mp.x-kipon.xpos[yindex])/s,kipon.xwRange)-1;
            if(mp.x>kipon.sideSize*s && mp.x<w-kipon.sideSize*s) {
                var octave = Math.floor(xder/7);
                var cent = xder%7;
                xder = octave*12 + [0,2,3,5,7,8,10][cent];
                //$("progress").innerHTML="n: "+MIDI.noteToKeyS[xder+A0]+"<br>";
                return [xder+A0,yindex];
            }
        }
        return false;
    },
    dragging: false,
    ismousedown: {0:false},
    slide: function(r,dist){
        var dt = 2;
        var dx = dist - kipon.xpos[r];
        if((kipon.xpos[r]>0 && dx>0) || (kipon.xpos[r]<-(C8-A0)*kipon.ioorSize*0.6+$("kiboard").width && dx<0)){
            window.requestAnimationFrame(function(){kipon.sliding[r] = false;}) ;
            return 0;
        }
        if(Math.abs(dx)<1){
            kipon.xpos[r] = dist;
            kipon.draw();
            kipon.sliding[r] = false;
            return 0;
        }
        kipon.xpos[r] += Math.sqrt(Math.abs(dx))*dt*Math.sign(dx);
        kipon.draw();
        window.requestAnimationFrame(kipon.slide.bind(null,r,dist)) ;
    },
    sliding:[false],
    init: function(){
        var iobj = $('kiboard');
        kipon.draw(true);
        iobj.style.position = 'absolute';
        iobj.style.left = 12+" px";
        iobj.style.top = 80+" px";
        kipon.resize(window.innerWidth,window.innerHeight);
        var p2p = function (obj,evt){
			var rect = obj.getBoundingClientRect(); 
			return p(
				evt.clientX - rect.left * (obj.width / rect.width),
				evt.clientY - rect.top * (obj.height / rect.height)
			);
        }
        var mstart = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            var Force = (e.changedTouches?e.changedTouches[index].force:null);
            Force = Force || (e.changedTouches? (e.changedTouches[index].radiusX+e.changedTouches[index].radiusY)/100-0.4:null);
            var keyindex = kipon.hitTest(e,index);
            if(keyindex){
                //$("progress").innerHTML=keyindex[0];
                kipon.currentDown[num] = keyindex;
                IN.onkeydown({kipon:true, channel:kipon.channels[keyindex[1]], force:Force, keyCode: kipon.currentDown[num][0], preventDefault:function(){}});
                kipon.ismousedown[num] = isNaN(e.button)?1:(e.button+1);
                if(keyindex[0]==-1||keyindex[0]==1){
                    if(!kipon.sliding[keyindex[1]])
                    kipon.slide(keyindex[1],kipon.xpos[keyindex[1]]-keyindex[0]*kipon.ioorSize*2);
                    kipon.sliding[keyindex[1]] = true;
                }
            }else if((!e.changedTouches)||e.touches.length==1){
                kipon.dragging = true;
                kipon.oldx = iobj.offsetLeft;
                kipon.oldy = iobj.offsetTop;
                kipon.moldx = e.clientX || e.changedTouches[0].clientX;
                kipon.moldy = e.clientY || e.changedTouches[0].clientY;
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mstart(e,++index);
            }
            e.preventDefault();
        };
        var mmove = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            if((!kipon.dragging) && kipon.ismousedown[num] == 1){
                var keyindex = kipon.hitTest(e,index);
                
                if(!keyindex && kipon.currentDown[num]){
                    IN.onkeyup({kipon:true, channel:kipon.channels[kipon.currentDown[num][1]], keyCode: kipon.currentDown[num][0], preventDefault:function(){}});
                    kipon.currentDown[num] = null;
                }else{
                    var ckey = keyindex;
                    if((!kipon.currentDown[num]) || (ckey[0] != kipon.currentDown[num][0] || ckey[1] != kipon.currentDown[num][1])){
                        if(kipon.currentDown[num])
                        IN.onkeyup({kipon:true, channel:kipon.channels[kipon.currentDown[num][1]], keyCode: kipon.currentDown[num][0], preventDefault:function(){}});
                        var Force = (e.changedTouches?e.changedTouches[index].force:null);
                        Force = Force || (e.changedTouches? (e.changedTouches[index].radiusX+e.changedTouches[index].radiusY)/100-0.4:null);
                        IN.onkeydown({kipon:true, channel:kipon.channels[ckey[1]], force:Force, keyCode: ckey[0], preventDefault:function(){}});
                        kipon.currentDown[num] = ckey;
                    }
                }
            }else if(kipon.dragging && ((!e.touches) || e.touches.length==1)){
                if(e.clientX){
                    iobj.style.left = e.clientX - kipon.moldx + kipon.oldx + 'px';
                    iobj.style.top = e.clientY - kipon.moldy + kipon.oldy + 'px';
                }else{
                    iobj.style.left = e.changedTouches[0].clientX - kipon.moldx + kipon.oldx + 'px';
                    iobj.style.top = e.changedTouches[0].clientY - kipon.moldy + kipon.oldy + 'px';
                }
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mmove(e,++index);
            }
            try{e.preventDefault();}catch(e){}
        };
        var mup = function(e,index){
            index = index || 0;
            num = e.changedTouches?e.changedTouches[index].identifier:0;
            //$("progress").innerHTML="up: "+num+"<br>";
            kipon.ismousedown[num] = false;
            if(!kipon.dragging && (isNaN(e.button)||e.button == 0)){
                var keyindex = kipon.hitTest(e,index);
                if(keyindex && kipon.currentDown[num] && keyindex[0] == kipon.currentDown[num][0] && keyindex[1] == kipon.currentDown[num][1]){
                    IN.onkeyup({kipon:true, channel:kipon.channels[kipon.currentDown[num][1]], keyCode: kipon.currentDown[num][0], preventDefault:function(){}});
                    kipon.currentDown[num] = null;
                }else{

                }
            }else{
                kipon.dragging = false;
            }
            if(e.changedTouches && index<e.changedTouches.length-1){
                mup(e,++index);
            }
        };
        iobj.addEventListener("touchstart",mstart)
        iobj.addEventListener("mousedown",mstart);
        document.addEventListener("mousemove",mmove);
        document.addEventListener("touchmove",mmove);
        document.addEventListener("mouseup",mup);
        document.addEventListener("touchend",mup);
        iobj.addEventListener("contextmenu", function (evt) {evt.preventDefault(); }, false);
    }
};