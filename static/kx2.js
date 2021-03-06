// https://github.com/duo-labs/webauthn
var ws = null;

function a2b64(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)));
}

function b642a(b) {
    var ret = new ArrayBuffer(64);
    var v = new Uint8Array(ret);
    var s = atob(b);
    for (var c = 0; c < s.length; c++) {
        v[c] = s.charCodeAt(c);
    }
    return ret;
}

function format_frequency(f) {
    let m = f.match(/00(\d{3})(\d{3})(\d{3})/);
    return parseInt(m[1]) + "." + m[2] + "." + m[3];
}

function blink() {
    setTimeout(() => {
        //console.log("blink on");
        setTimeout(() => {
            //console.log("blink off");
            blink();
        }, 1000);
    }, 100);
}

function tq(s) {
    if (s == "0") {
	document.getElementById("title").classList.add("green");
	document.getElementById("title").classList.remove("red");
    } else {
	document.getElementById("title").classList.add("red");
	document.getElementById("title").classList.remove("green");
    }
}

function update_element(el, val) {
    let o = document.getElementById(el);
    if ((o.value === val) && (o.value !== 0)) {
	return;
    }
    if (document.activeElement == o) {
	return;
    }
    o.value = val;
}

function update_text_element(el, val) {
    let o = document.getElementById(el);
    if (o.innerText == ("" + val).trimStart().trimEnd()) {
	return;
    }
    o.innerText = val;
}

document.getElementById("audio-stream").addEventListener("click", (event) => {
    start_audio_stream();
});

document.getElementById("power").addEventListener("click", (event) => {
    send("PS0");
});

document.getElementById("cmd").addEventListener("keyup", (event) => {
    if (event.keyCode != 13) {
	return;
    }
    send(event.target.value);
});

document.getElementById("cw").addEventListener("keyup", (event) => {
    if (event.keyCode != 13) {
	return;
    }
    send("KY " + event.target.value);
    event.target.value = "";
});

var do_toggle_pa = false;
function toggle_pa() {
    do_toggle_pa = true;
    send("PA");
}

var do_toggle_att = false;
function toggle_att() {
    do_toggle_att = true;
    send("RA");
}

// Togglers.
var do_toggle = {};
[["vx", "VX"], ["lk", "LK"], ["lkb", "LK$"]].forEach((item, index) => {
    let el = item[0];
    let key = item[1];
    document.getElementById(el).addEventListener("click", (event) => {
	do_toggle[key] = true;
	send(key);
    });
});

// Pure buttons.
[
    ["ofsb", "SWT35"],
    ["clr", "SWH35"],
    ["data", "SWT26"],
    ["text", "SWH26"],
    ["spot", "SWT34"],
    ["store", "SWH14"],
    ["nr", "SWH19"],
    ["fil", "SWT27"],
    ["apf-an", "SWH27"],
    ["pfn", "SWH20"],
    ["xmit", "SWT16"],
    ["tune", "SWH16"],
    ["rate", "SWT41"],
    ["freq", "SWH41"],
    ["ab", "SWT44"],
    ["a-to-b", "SWH44"],
    ["rit", "SWT18"],
    ["split", "SWH18"],
    ["disp", "SWT09"],
    ["menu", "SWH09"],
    ["rcl", "SWH08"],
    ["nb", "SWH32"],
    ["up", "UP"],
    ["down", "DN"],
    ["upb", "UPB"],
    ["downb", "DNB"],
    ["is", "IS 9999"],
    ["bw", "BW0270"],
    ["atu-off", "MN023;MP001;MN255"],
    ["atu-on", "MN023;MP002;MN255"],
].forEach((item, index) => {
    let el = item[0];
    let cmd = item[1];
    document.getElementById(el+"-button").addEventListener("click", (event) => {
	send(cmd);
    });
});

// Dropdowns
["md", "bn"].forEach((item, index) => {
    document.getElementById(item).addEventListener("change", (event) => {
	send(item + event.target.value);
    });
});

// 3 digit text entries
["ag", "mg", "ks", "ml", "cp"].forEach((item, index) => {
    document.getElementById(item).addEventListener("keyup", (event) => {
	if (event.keyCode != 13) {
	    return;
	}
	let v = event.target.value;
	v = v.replace(/[^0-9]/g, "");
	v = ('00000000000' + v).slice(-3);
	send(item + v);
    });
});

// Power is special, since it's a fraction.
document.getElementById("pc").addEventListener("keyup", (event) => {
    if (event.keyCode != 13) {
	return;
    }
    let v = parseInt(parseFloat(event.target.value)*10);
    v = ('00000000000' + v).slice(-3);
    send("PC" + v);
});

// Filter is also special, since it's a fraction.
document.getElementById("bw").addEventListener("keyup", (event) => {
    if (event.keyCode != 13) {
	return;
    }
    let v = parseInt(parseFloat(event.target.value)*100);
    v = ('00000000000' + v).slice(-4);
    send("BW" + v);
});

// Filter is also special, since it's a fraction.
document.getElementById("is").addEventListener("keyup", (event) => {
    if (event.keyCode != 13) {
	return;
    }
    let v = parseInt(parseFloat(event.target.value)*1000);
    v = ('00000000000' + v).slice(-4);
    send("IS " + v);
});

// 11 digit text entries (frequency fields)
["fa", "fb"].forEach((item, index) => {
    document.getElementById(item).addEventListener("keyup", (event) => {
	if (event.keyCode != 13) {
	    return;
	}
	let v = event.target.value;
	v = v.replace(/[^0-9]/g, "");
	v = ('00000000000' + v).slice(-11);
	send(item + v);
    });
});

function send(cmd) {
    try {
        ws.send(cmd);
    } catch(e) {
        console.log("Failed to send command: " + e);
    }
}

// Some settings don't stream automatically.
function periodic_refresh() {
    setTimeout(() => {
	let a = [
	    "ML",  // Monitor Level
	    "TQ",  // Transmit Query
	    "DS",  // Display A
	    "SW",  // Get SWR
	    "DB",  // Get bar
	    "BG",  // Bar graph
	    "VX",  // Vox status
	    "IF",  // Display
	    "IS",  // Filter center
	    "BW",  // Filter width
	    "K30;FW;K31",  // Filter width & number
	    "CP", // Speech compression
	    "PC",  // Power
	];
	a.forEach((item, index) => {
	    send(item);
	});
	periodic_refresh();
    }, 1000);
}

function att_display(v) {
    switch (v) {
    case 0:
    case false:
	document.getElementById("att-button").classList.remove("green");
	document.getElementById("att-button").classList.add("red");
	break;
    case 1:
    case true:
	document.getElementById("att-button").classList.remove("red");
	document.getElementById("att-button").classList.add("green");
	break;
    default:
	console.log("Invalid value for RA: " + v);
    }
}

function recolor(e, on) {
    let o = document.getElementById(e);
    if (on) {
	o.classList.remove("grey");
	o.classList.add("green");
    } else {
	o.classList.remove("green");
	o.classList.add("grey");
    }
}

function pre_display(v) {
    switch (v) {
    case 0:
    case false:
	document.getElementById("pa-button").classList.remove("green");
	document.getElementById("pa-button").classList.add("red");
	break;
    case 1:
    case true:
	document.getElementById("pa-button").classList.remove("red");
	document.getElementById("pa-button").classList.add("green");
	break;
    default:
	console.log("Invalid value for PA: " + v);
    }
}

function start_streaming() {
    let modemap = {
	"1": "LSB",
	"2": "USB",
	"3": "CW",
	"4": "FM",
	"5": "AM",
	"6": "DATA",
	"7": "CW-REV",
	"9": "DATA-REV"
    };
    ws = new WebSocket("ws://"+window.location.host+"/stream/ui");
    ws.onopen = (evt) => {
        console.log("WS Connected");
	// Initial initialization.
	send("K22"); // Extended commands
	send("K31"); // Extended commands
	send("ai2"); // Stream updates
	send("PC"); // Read power
	send("el1"); // Error logging on.
	send("fw"); // Filter status.
	send("ml"); // Mon level
	send("BW"); // Filter bandwidth
	send("MG"); // Min gain
	send("ds"); // Display A
	send("db"); // Dispaly B
	send("ag"); // AF Gain
	send("fb"); // VFO B
	send("ft"); //
	send("ks"); // Key speed
	send("tq"); // Transmit status query
	send("fa"); // VFO A
	send("md"); // Mode
	send("PA"); // Preamp status
	send("BN"); // Preamp status
	send("RA"); // Attenuator status
	send("VX"); // Vox status
	send("LK"); // Lock A
	send("LK$"); // Lock B
	periodic_refresh();
    };
    ws.onclose = (evt) => {
        console.log("WS Closed");
	console.log(evt);
    };
    ws.onerrar = (evt) => {
        console.log("WS Error");
	console.log(evt);
    };
    ws.onmessage = (evt) => {
        //console.log("WS Message");
	//console.log(evt);

	//console.log("Data: " + reader.result + " (" + reader.result.length + " was " + evt.data.blob.size + ")");
	let s = atob(evt.data);
	bar = s;
	//console.log(evt.data);
	//console.log(s);

	let m;

	m = s.match(/AG(\d{3})[$]?/);
	if (m) {
	    update_element("ag", parseInt(m[1]));
	    return;
	}

	// Bar graph
	m = s.match(/BG(\d{2})/);
	if (m) {
	    update_element("bg", parseInt(m[1]));
	    update_text_element("bg-text", parseInt(m[1]));
	    return;
	}

	// Monitor level
	m = s.match(/ML(\d{3})[$]?/);
	if (m) {
	    update_element("ml", parseInt(m[1]));
	    return;
	}

	// Mic gain
	m = s.match(/MG(\d{3})[$]?/);
	if (m) {
	    update_element("mg", parseInt(m[1]));
	    return;
	}

	// Mic gain
	m = s.match(/CP(\d{3})$/);
	if (m) {
	    update_element("cp", parseInt(m[1]));
	    return;
	}

	//             disp ico flash
	m = s.match(/DS(.{8})(.)(.)/);
	if (m) {
	    // TODO: handle icon data
	    // Bits:
	    //  7: Always 1
	    //  6: NB
	    //  5: ANT2 selected
	    //  4: PRE
	    //  3: ATT
	    //  2: VFO
	    //  1: RIT
	    //  0: XIT
	    let icon = m[2].charCodeAt(0);
	    recolor("nb-enable", icon & 64);
	    //recolor("ant2-enable", icon & 32);
	    
	    pre_display(!!(icon & 16));
	    recolor("pre-enable", icon & 16);

	    att_display(!!(icon & 8));
	    recolor("att-enable", icon & 8);
	    
	    if (icon & 4) {
		console.log("VFO B selected");
	    }
	    recolor("rit-enable", icon & 2);
	    recolor("xit-enable", icon & 1);
	    // TODO: handle flash data
	    // Bits:
	    //  7: Always 1
	    //  6: SUB on
	    //  5: RX ANT on
	    //  4: ATU
	    //  3: CWT
	    //  2: NR
	    //  1: NTCH
	    //  0: MAN NOTCH
	    let flash = m[3].charCodeAt(0);
	    recolor("sub-enable", flash & 64);
	    if (flash & 32) {
		console.log("RX ANT on");
	    }
	    // ATU
	    document.getElementById("atu").disabled = !(flash & 16);
	    //console.log(flash);
	    recolor("atu-enable", flash & 16);
	    recolor("cwt-enable", flash & 8);
	    recolor("nr-enable", flash & 4);
	    recolor("ntch-enable", flash & 2);
	    //recolor("mon-notch-enable", flash & 1);
	    
	    let out = "";
	    for (let i = 0; i < m[1].length; i++) {
		let b = m[1].charCodeAt(i);
		if (b & 128) {
		    out += ".";
		    b &= 127;
		}
		let b2 = {
		    '>': '-',
		    '<': 'l',
		    '@': ' ',
		    'K': 'H',
		    'M': 'N',
		    'Q': 'O',
		    'V': 'U',
		    'W': 'I',
		    'X': '?', // c-bar
		    'Z': 'c',
		    '[': '?', // r-bar
		    '\\': '?', // lambda
		    ']': '?', // RX/TX eq level 4
		    '^': '?', // RX/TX eq level 4
		}[String.fromCharCode(b)]
		if (b2 !== undefined) {
		    b = b2.charCodeAt(0);
		}
		if (b > 0) {
		    out += String.fromCharCode(b);
		}
	    }
	    update_text_element("ds", out);
	    return;
	}

	m = s.match(/MD(\d)[$]?/);
	if (m) {
	    update_text_element("mode", modemap[m[1]]);
	    document.querySelector('#md [value="' + m[1] + '"]').selected = true;
	    return;
	}

	m = s.match(/BN(\d+)[$]?/);
	if (m) {
	    document.querySelector('#bn [value="' + m[1] + '"]').selected = true;
	    return;
	}

	m = s.match(/DB(.*)/);
	if (m) {
	    update_text_element("db", m[1]);
	    return;
	}

	m = s.match(/FA(\d{11})/);
	if (m) {
	    update_element("fa", format_frequency(m[1]));
	    return;
	}

	m = s.match(/FB(\d{11})/);
	if (m) {
	    update_element("fb", format_frequency(m[1]));
	    return;
	}

	// Filter bandwidth.
	m = s.match(/BW(\d{2})(\d{2})/);
	if (m) {
	    update_element("bw", parseInt(m[1]) + "." + m[2]);
	    return;
	}

	// Redundant FW in K3 format.
	m = s.match(/FW(\d{2})(\d{2})$/);
	if (m) {
	    update_element("bw", parseInt(m[1]) + "." + m[2]);
	    return;
	}

	// FW in K2 format including filter number.
	m = s.match(/FW(\d{4})([1-4])([0-2])/);
	if (m) {
	    // filter in hz, n is the filter number, and m is the filter mode.
	    // FL1 light comes from here.
	    // KX2 only has FL1
	    recolor("fl1-enable", m[2] == "1");
	    recolor("fl2-enable", m[2] == "2");
	    recolor("fl3-enable", m[2] == "3");
	    recolor("fl4-enable", m[2] == "4");
	    // update_element("bw", parseInt(m[1]) + "." + m[2]);
	    return;
	}

	// Filter shift.
	m = s.match(/IS (\d{1})(\d{3})/);
	if (m) {
	    update_element("is", parseInt(m[1]) + "." + m[2]);
	    return;
	}


	if (s.match(/PC\d{3}$/)) {
	    // Ignore non-extended PC. It doesn't have fractional watts.
	    console.log(s);
	    return;
	}

	// TX Power.
	m = s.match(/PC(\d{2})(\d)(\d)/);
	if (m) {
	    update_element("pc", parseInt(m[1]) + "." + m[2]);
	    recolor("pa-enable", m[3] == "1");
	    return;
	}

	// TX VFO assignment.
	m = s.match(/FT(\d)/);
	if (m) {
	    if (m[1] == "0") {
		update_text_element("ft0", "x");
		update_text_element("ft1", "");
	    } else {
		update_text_element("ft0", "");
		update_text_element("ft1", "x");
	    }
	    return;
	}

	// RX VFO assignment.
	m = s.match(/FR(\d)/);
	if (m) {
	    return;
	}

	// Transmitting.
	m = s.match(/TQ(\d)/);
	if (m) {
	    tq(m[1]);
	    return;
	}

	// Send CW.
	m = s.match(/KY(\d)/);
	if (m) {
	    if (m[1] == "1") {
		console.log("CW BUFFER FULL!");
	    } else {
		console.log("CW buffer not full");
	    }
	    return;
	}

	// CW Key speed
	m = s.match(/KS(\d+)/);
	if (m) {
	    update_element("ks", parseInt(m[1]));
	    return;
	}

	// PreAmp
	m = s.match(/PA(\d)/);
	if (m) {
	    let v = parseInt(m[1]);
	    pre_display(v);
	    if (do_toggle_pa) {
		send("PA" + (v ? 0 : 1));
		do_toggle_pa = false;
	    }
	    return;
	}

	// ATT
	m = s.match(/RA0(\d)/);
	if (m) {
	    let v = parseInt(m[1]);
	    att_display(v);
	    if (do_toggle_att) {
		send("RA0" + (v ? 0 : 1));
		do_toggle_att = false;
	    }
	    return;
	}

	let handled = false;
	[
	    ["LK", "fa"],
	    ["LK$", "fb"],
	].forEach((t, index) => {
	    let cmd = t[0];
	    let vfo = t[1];
	    let re = cmd.replace("$", "\\$");
	    m = s.match(new RegExp(re + "(\\d)"));
	    if (m) {
		let v = parseInt(m[1]);
		document.getElementById(vfo).disabled = v;
		if (do_toggle[cmd]) {
		    send(cmd + (v ? 0 : 1));
		    do_toggle[cmd] = false;
		}
		handled = true;
	    }
	});
	if (handled) {
	    return;
	}

	// VOX
	m = s.match(/VX(\d)/);
	if (m) {
	    let v = parseInt(m[1]);
	    switch (v) {
	    case 0:
		document.getElementById("vx").classList.remove("green");
		document.getElementById("vx").classList.add("red");
		break;
	    case 1:
		document.getElementById("vx").classList.remove("red");
		document.getElementById("vx").classList.add("green");
		break;
	    default:
		console.log("Invalid value for VX: " + m[1]);
	    }
	    if (do_toggle["VX"]) {
		send("MN152;UP;MN255");
		do_toggle["VX"] = false;
	    }
	    return;
	}

	// Data:
	//   0 DATA A
	//   1 AFSK A
	//   2 FKS D
	//   3 PSK D
	//                1             2          3     4        5   6    7     8     9     10    11
	//              Freq            RIT freq   RIT   XIT      TX? Mode RxVFO PScan Split Bchg  Data
	m = s.match(/IF([0-9]{11})     ([+-]\d{4})([01])([01]) 00([01])(.)([01])([01])([01])([01])([0-3])1* /);
	if (m) {
	    //console.log(s);
	    update_element("fa", format_frequency(m[1]));
	    update_text_element("rit-ofs", m[2]);
	    recolor("rit-enable", m[3] == "1");
	    recolor("xit-enable", m[4] == "1");
	    tq(m[5]);
	    update_text_element("mode", modemap[m[6]]);
	    // TODO: 7,8
	    recolor("split-enable", m[9] == "1");
	    // TODO: 10,11
	    return;
	}

	// Extended mode change responses.
	if (s.match(/K[23][012]/)) {
	    return;
	}

	// RF input gain.
	if (s.match(/RG\d{3}/)) {
	    // TODO: display somewhere?
	    return;
	}

	console.log("Unhandled message: " + s + " length " + s.length);
    };
    blink();
}
var bar = null;

function register() {
    // sample arguments for registration
    var createCredentialDefaultArgs = {
        publicKey: {
            // Relying Party (a.k.a. - Service):
            rp: {
                name: "KX2"
            },

            // User:
            user: {
                id: new Uint8Array(16),
                name: "john.p.smith@example.com",
                displayName: "John P. Smith"
            },

            pubKeyCredParams: [{
                type: "public-key",
                alg: -7
            }],

            attestation: "direct",

            timeout: 60000,

            // TODO: generate challenge on the server.
            challenge: new Uint8Array([
                0x8C, 0x0A, 0x26, 0xFF, 0x22, 0x91, 0xC1, 0xE9, 0xB9, 0x4E, 0x2E, 0x17, 0x1A, 0x98, 0x6A, 0x73,
                0x71, 0x9D, 0x43, 0x48, 0xD5, 0xA7, 0x6A, 0x15, 0x7E, 0x38, 0x94, 0x52, 0x77, 0x97, 0x0F, 0xEF
            ]).buffer
        }
    };

    // register / create a new credential
    navigator.credentials.create(createCredentialDefaultArgs)
        .then((cred) => {
            //console.log("NEW CREDENTIAL", cred);
            let rawID = a2b64(cred.rawId);
            console.log("Raw ID:");
            console.log(rawID);
            console.log(cred);
            foo = cred;
            window.localStorage.setItem("authblob", rawID);
            // normally the credential IDs available for an account would come from a server
            // but we can just copy them from above...
            return true;
        })
        .then((assertion) => {
            console.log("ASSERTION", assertion);
        })
        .catch((err) => {
            console.log("ERROR", err);
        });
}
var foo = null;
function login() {
    // sample arguments for login
    var ids = b642a(window.localStorage.getItem("authblob"));
    console.log("login with ids:");
    console.log(ids);
    var idList = [{
        id: ids,
        transports: ["usb", "nfc", "ble"],
        type: "public-key"
    }];
    var getCredentialDefaultArgs = {
        publicKey: {
            allowCredentials: idList,
            timeout: 60000,
            // allowCredentials: [newCredential] // see below
            // TODO: generate challenge on the server.
            challenge: new Uint8Array([ // must be a cryptographically random number sent from a server
                0x79, 0x50, 0x68, 0x71, 0xDA, 0xEE, 0xEE, 0xB9, 0x94, 0xC3, 0xC2, 0x15, 0x67, 0x65, 0x26, 0x22,
                0xE3, 0xF3, 0xAB, 0x3B, 0x78, 0x2E, 0xD5, 0x6F, 0x81, 0x26, 0xE2, 0xA6, 0x01, 0x7D, 0x74, 0x50
            ]).buffer
        },
    };
    return navigator.credentials.get(getCredentialDefaultArgs).then((blah) => {
        console.log(blah);
    });
}

var player = null;
function start_audio_stream() {
    let ctx = new AudioContext();
    let channels = 1;
    let rate = 44100;
    let length = 44100;

    let wsa = new WebSocket("ws://"+window.location.host+"/stream/audio")
    wsa.onopen = (evt) => {
	console.log("Audio WS connected");
    };
    wsa.onclose = (evt) => {
        console.log("Audio WS closed");
	console.log(evt);
    };
    wsa.onerrar = (evt) => {
        console.log("Audio WS error");
	console.log(evt);
    };
    var audio_chunks = [];
    wsa.onmessage = (evt) => {
	// Set up player.
	//console.log("Audio WS message");
	//console.log(evt);
	evt.data.arrayBuffer().then(buffer => {
	    //console.log(buffer);

	    // Convert the data to an audio buffer and put it on the stack.
	    let view = new Int16Array(buffer);
	    let buf = ctx.createBuffer(channels, view.length, ctx.sampleRate);
	    let t = buf.getChannelData(0);
	    for (var i = 0; i < view.length; i++) {
		t[i] = view[i] / 32768;
	    }
	    audio_chunks.push(buf);

	    // Define how to start playing.
	    // This is actually not working that great. I still hear audio glitches.
	    let start_playing = () => {
		let buf = audio_chunks.shift();
		if (buf === undefined) {
		    //console.log("No more audio to play. Killing player.");
		    player = null;
		    return;
		}
		player = ctx.createBufferSource();
		player.buffer = buf;
		player.connect(ctx.destination);
		player.start();
		player.onended = () => {
		    //console.log("Ended");
		    start_playing();
		};
	    };
	    // Start first player.
	    if (player == null) {
		//console.log("Player starting...");
		start_playing();
		player.start();
		//console.log(player);
	    }
	    // TODO: connect an FFT:
	    // https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
	});
    };
}

start_streaming();
