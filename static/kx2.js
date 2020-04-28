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
        }, 100);
    }, 1000);
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

// Dropdowns
["md", "bn"].forEach((item, index) => {
    document.getElementById(item).addEventListener("change", (event) => {
	send(item + event.target.value);
    });
});

// 3 digit text entries
["ag", "mg", "ks", "ml"].forEach((item, index) => {
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
	    "ml",  // Monitor Level
	    "tq",  // Transmit Query
	    "tq",  // Transmit Query
	    "ds",  // Display A
	    "SW",  // Get SWR
	    "DB",  // Get SWR
	    "BG",  // Bar graph
	    "VX",  // Vox status
	];
	a.forEach((item, index) => {
	    send(item);
	});
	periodic_refresh();
    }, 1000);
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
	send("K22"); // Extended commands
	send("ai2"); // Stream updates
	send("pc"); // Read power
	send("el1"); // Error logging on.
	send("ml"); // Mon level
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
	    document.getElementById("ag").value = parseInt(m[1]);
	    return;
	}

	m = s.match(/BG(\d{2})/);
	if (m) {
	    document.getElementById("bg").value = parseInt(m[1]);
	    document.getElementById("bg-text").innerText = parseInt(m[1]);
	    return;
	}

	m = s.match(/ML(\d{3})[$]?/);
	if (m) {
	    document.getElementById("ml").value = parseInt(m[1]);
	    return;
	}

	m = s.match(/MG(\d{3})[$]?/);
	if (m) {
	    document.getElementById("mg").value = parseInt(m[1]);
	    return;
	}

	m = s.match(/DS(.*)/);
	if (m) {
	    document.getElementById("ds").innerText = m[1];
	    return;
	}

	m = s.match(/MD(\d)[$]?/);
	if (m) {
	    document.getElementById("mode").innerText = modemap[m[1]];
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
	    document.getElementById("db").innerText = m[1];
	    return;
	}

	m = s.match(/FA(\d{11})/);
	if (m) {
	    document.getElementById("fa").value = format_frequency(m[1]);
	    return;
	}

	m = s.match(/FB(\d{11})/);
	if (m) {
	    document.getElementById("fb").value = format_frequency(m[1]);
	    return;
	}

	m = s.match(/PC(\d{2})(\d)(\d)/);
	if (m) {
	    document.getElementById("pc").value = parseInt(m[1]) + "." + m[2];
	    // TODO: PA status m[3]
	    return;
	}

	m = s.match(/FT(\d)/);
	if (m) {
	    if (m[1] == "0") {
		document.getElementById("ft0").innerText = "x";
		document.getElementById("ft1").innerText = "";
	    } else {
		document.getElementById("ft0").innerText = "";
		document.getElementById("ft1").innerText = "x";
	    }
	    return;
	}

	m = s.match(/FR(\d)/);
	if (m) {
	    // TODO: RX VFO assignment
	    return;
	}

	m = s.match(/IS (\d{4})/);
	if (m) {
	    return;
	}

	m = s.match(/TQ(\d)/);
	if (m) {
	    tq(m[1]);
	    return;
	}

	m = s.match(/KY(\d)/);
	if (m) {
	    if (m[1] == "1") {
		console.log("CW BUFFER FULL!");
	    } else {
		console.log("CW buffer not full");
	    }
	    return;
	}

	m = s.match(/KS(\d+)/);
	if (m) {
	    document.getElementById("ks").value = parseInt(m[1]);
	    return;
	}

	m = s.match(/PA(\d)/);
	if (m) {
	    let v = parseInt(m[1]);
	    switch (v) {
	    case 0:
		document.getElementById("pa-button").classList.remove("green");
		document.getElementById("pa-button").classList.add("red");
		break;
	    case 1:
		document.getElementById("pa-button").classList.remove("red");
		document.getElementById("pa-button").classList.add("green");
		break;
	    default:
		console.log("Invalid value for PA: " + m[1]);
	    }
	    if (do_toggle_pa) {
		send("PA" + (v ? 0 : 1));
		do_toggle_pa = false;
	    }
	    return;
	}

	m = s.match(/RA0(\d)/);
	if (m) {
	    let v = parseInt(m[1]);
	    switch (v) {
	    case 0:
		document.getElementById("att-button").classList.remove("green");
		document.getElementById("att-button").classList.add("red");
		break;
	    case 1:
		document.getElementById("att-button").classList.remove("red");
		document.getElementById("att-button").classList.add("green");
		break;
	    default:
		console.log("Invalid value for RA: " + m[1]);
	    }
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
	m = s.match(/IF([0-9]{11})     ([+-]\d{4})([01])([01]) 00([01])(.)([01])([01])([01])([01])([01])1* /);
	if (m) {
	    console.log(s);
	    document.getElementById("mode").innerText = modemap[m[6]];
	    document.getElementById("fa").value = format_frequency(m[1]);
	    tq(m[5]);
	    return;
	}
	console.log("Unhandled message: " + s);
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
start_streaming();
