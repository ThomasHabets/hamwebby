package main

import (
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	// None of these worked.
	// Portaudio can't find the audio card.
	// The alsa ones don't even compile.
	//
	//"github.com/gordonklaus/portaudio"
	//"github.com/HardWareGuy/portaudio-go"
	//alsa "github.com/Narsil/alsa-go"
	//"github.com/cocoonlife/goalsa"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	log "github.com/sirupsen/logrus"

	"github.com/ThomasHabets/hamwebby/pkg/audio"
)

var (
	speed    = flag.Int("speed", 38400, "Serial port speed")
	audioDev = flag.String("audio", "hw:1,0", "Audio input from radio.")
	dev      = flag.String("dev", "/dev/ttyUSB0", "Serial port")
	debug    = flag.Bool("debug", false, "Enable debug output")

	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	port *Port
	au   *audio.Audio
)

func rootHandler(w http.ResponseWriter, r *http.Request) {
	t := template.Must(template.ParseFiles("templates/kx2.html"))
	if err := t.Execute(w, &struct{}{}); err != nil {
		log.Errorf("Failed to execute root handler: %v", err)
	}
}

// Handler for streaming down audio using websockets.
func audioStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Errorf("Establishing audio stream websocket: %v", err)
		return
	}

	rd := au.AddReader(44100)
	defer rd.Close()

	log.Infof("Audio stream running...")
	for {
		data, err := rd.Get()
		if err != nil {
			log.Errorf("Failed to get audio data from card: %v", err)
			return
		}
		if len(data) == 0 {
			log.Errorf("Got 0 bytes from audio reader. That shouldn't happen")
			continue
		}
		log.Debugf("Got %d bytes of audio data", len(data))
		if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
			log.Warningf("Failed to write audio message to client: %v", err)
			return
		}
	}
}

// uiStream is the HTTP handler for streaming commands and responses for the serial interface.
func uiStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Errorf("Establishing websocket: %v", err)
		return
	}

	log.Infof("Websocket running...")
	var wg sync.WaitGroup
	wg.Add(1)
	done := make(chan bool)
	go func() {
		// goroutine read from serial, write to net.
		defer wg.Done()
		for {
			select {
			case m := <-port.msgs:
				if err := conn.WriteMessage(websocket.TextMessage, []byte(base64.StdEncoding.EncodeToString(m))); err != nil {
					log.Errorf("Failed to write message to the client: %v", err)
					return
				}
			case <-done:
				log.Info("Time for serial reader to end")
				return
			}
		}
	}()
	defer func() {
		close(done)
		wg.Wait()
		log.Infof("websocket turned off")
	}()
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		if len(p) == 0 {
			log.Warningf("Got empty message from websocket")
			continue
		}
		log.Debugf("Got message %v %v", messageType, string(p))
		// TODO: check that messageType is websocket.TextMessage
		if _, err := port.f.Write([]byte(fmt.Sprintf("%s;", string(p)))); err != nil {
			log.Fatalf("Failed to write command to serial: %v", err)
		}
	}
}

// command sends a command to the serial port, and returns the response.
func command(f io.ReadWriter, cmd string, reply bool) (string, error) {
	if _, err := f.Write([]byte(cmd)); err != nil {
		return "", err
	}
	if !reply {
		return "", nil
	}
	var ss []string
	for {
		b := make([]byte, 64, 64)
		n, err := f.Read(b)
		if err != nil {
			return "", err
		}
		s := string(b[:n])
		ss = append(ss, s)
		if s[len(s)-1] == ';' {
			return strings.Join(ss, ""), nil
		}
	}
}

// Port is a serial port wrapper.
type Port struct {
	m    sync.Mutex
	msgs chan []byte
	f    *os.File
}

func (p *Port) Run(ctx context.Context) {
	var ss string
	for {
		b := make([]byte, 1, 1)
		n, err := p.f.Read(b)
		if err != nil {
			log.Fatalf("Failed to read from serial: %v", err)
			continue
		}
		s := string(b[:n])
		if s == ";" {
			log.Debugf("From serial: %q", ss)
			if len(ss) == 0 {
				log.Warningf("Got message of length 0 from serial")
			} else {
				select {
				case p.msgs <- []byte(ss):
				default:
					log.Infof("Dropped message on the floor")
				}
			}
			ss = ""
		} else {
			ss += s
		}
	}
}

func main() {
	flag.Parse()
	if flag.NArg() > 0 {
		log.Fatalf("Stray command args: %q", flag.Args())
	}

	if *debug {
		log.SetLevel(log.DebugLevel)
	}

	ctx := context.Background()

	log.Infof("Opening audio...")
	au = audio.New(*dev)
	au.Run(ctx)

	log.Printf("Opening serial port...")
	f, err := os.OpenFile(*dev, os.O_RDWR|os.O_SYNC, 0)
	if err != nil {
		log.Fatalf("Opening serial port: %v", err)
	}
	defer f.Close()

	if true {
		log.Printf("Setting speed etc")
		if err := exec.CommandContext(ctx,
			"stty", "-F", *dev,
			fmt.Sprint(*speed),
			"cs8",
			"-cstopb",
			"-parenb",
			"-parodd",
			"ignbrk",
			"-icrnl",
			"-ixon",
			"-ixoff",
			"-opost",
			"-isig",
			"-icanon",
			"-iexten",
			"-echo",
			"-echoe",
			"-echok",
			"-echoctl",
			"-echoke",
		).Run(); err != nil {
			log.Fatalf("Setting terminal settings: %v", err)
		}
	}

	port = &Port{
		f:    f,
		msgs: make(chan []byte, 10),
	}

	log.Printf("Initializing...")
	// Confirm we're using the right protocol.
	if id, err := command(f, "ID;", true); err != nil {
		log.Fatalf("Command failed: %v", err)
	} else if id != "ID017;" {
		log.Fatalf("Not protocol 17: %q", id)
	}
	log.Printf("Correct protocol")

	// Confirm we have a KX2.
	if id, err := command(f, "OM;", true); err != nil {
		log.Fatalf("Command failed: %v", err)
	} else if !strings.HasSuffix(id, "01;") {
		log.Fatalf("Not a KX2. OM: %q", id)
	}
	log.Printf("Detected KX2")

	r := mux.NewRouter()
	r.HandleFunc("/", rootHandler)
	r.HandleFunc("/stream/ui", uiStream)
	r.HandleFunc("/stream/audio", audioStream)
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	log.Printf("Starting...")
	go port.Run(ctx)
	s := &http.Server{
		Addr:           ":8080",
		Handler:        r,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	log.Fatal(s.ListenAndServe())
}
