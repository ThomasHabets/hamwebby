package audio

import (
	"container/list"
	"context"
	"io"
	"os"
	"os/exec"
	"sync"

	log "github.com/sirupsen/logrus"
)

const (
	DefaultLimit = 44100 * 10 // 10 seconds, or about half a MB
)

type byteQueue struct {
	list *list.List
}

func (q *byteQueue) len() int64 {
	return int64(q.list.Len())
}

func (q *byteQueue) front() []byte {
	return q.list.Front().Value.([]byte)
}

func (q *byteQueue) pop() {
	q.list.Remove(q.list.Front())
}

func (q *byteQueue) push(bs []byte) {
	q.list.PushBack(bs)
}

func (q *byteQueue) get(index int) []byte {
	e := q.list.Front()
	for i := 0; i < index; i++ {
		e = e.Next()
	}
	return e.Value.([]byte)
}

type Audio struct {
	mu    sync.Mutex
	dev   string
	queue byteQueue
	size  int64
	Limit int64 // Do not write after calling Run().

	id      uint64
	readers map[uint64]chan []byte
}

type Reader struct {
	au *Audio
	id uint64
	ch chan []byte
}

func (r *Reader) Get() ([]byte, error) {

	return <-r.ch, nil
}

func New(dev string) *Audio {
	return &Audio{
		dev:     dev,
		readers: make(map[uint64]chan []byte),
		queue: byteQueue{
			list: list.New(),
		},
		Limit: DefaultLimit,
	}
}

// only call this with mutex held
func (a *Audio) trimLock() {
	if a.size <= a.Limit {
		return
	}
	cut := a.Limit - a.size
	for cut > int64(a.queue.len()) {
		a.size -= int64(len(a.queue.front()))
		a.queue.pop()
	}
	// TODO: bother trimming partial chunks?
}

func (a *Audio) addSamples(samples []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.queue.push(samples)
	a.size += int64(len(samples))
	if a.size > a.Limit {
		a.trimLock()
	}
}

func (a *Audio) Run(ctx context.Context) {
	ch := a.readAudio(ctx)
	go func() {
		for {
			select {
			case samples := <-ch:
				a.addSamples(samples)
				for _, rch := range a.readers {
					select {
					case rch <- samples:
					default:
						// drop packet
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (a *Audio) AddReader(samples int) *Reader {
	a.mu.Lock()
	defer a.mu.Unlock()
	chunk := 0
	ofs := 0
	seen := 0
	if samples > 0 {
		for i := int(a.queue.len() - 1); i >= 0; i-- {
			chunk++
			seen += len(a.queue.get(i))
			if seen >= samples {
				ofs = seen - samples
				break
			}
		}
	}
	ch := make(chan []byte, chunk+1)
	for i := int(a.queue.len()) - chunk; i < int(a.queue.len()); i++ {
		part := a.queue.get(i)[ofs:]
		log.Infof("Pre-sending %d bytes", len(part))
		ch <- part
		ofs = 0
	}
	a.id++
	a.readers[a.id] = ch
	return &Reader{
		au: a,
		id: a.id,
		ch: ch,
	}
}

func (r *Reader) Close() {
	r.au.mu.Lock()
	defer r.au.mu.Unlock()
	delete(r.au.readers, r.id)
	close(r.ch)
}

func (a *Audio) readAudio(ctx context.Context) <-chan []byte {
	ch := make(chan []byte)
	go func() {
		cmd := exec.CommandContext(ctx, "arecord", "-c", "1", "-D", "hw:1", "-f", "S16_LE", "-r", "44100", "-")
		cmd.Env = []string{
			"AUDIODEV=hw:1",
		}
		pipeReader, pipeWriter := io.Pipe()
		cmd.Stdout = pipeWriter
		cmd.Stderr = os.Stderr
		log.Printf("Streaming audio...")
		go func() {
			for {
				data := make([]byte, 44100)
				n, err := pipeReader.Read(data)
				if err != nil {
					log.Errorf("Reading from sound card: %v", err)
					return
				}
				//log.Infof("Got %d bytes", n)
				select {
				case ch <- data[0:n]:
				default:
					log.Infof("dropped data")
				}
			}
		}()
		if err := cmd.Run(); err != nil {
			log.Errorf("Failed to stream from audio dev: %v", err)
		}
		log.Printf("audio stream ended")
	}()
	return ch
}
