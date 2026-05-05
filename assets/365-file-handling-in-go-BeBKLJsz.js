const n=`---
title: "Golang Simple yet Useful Knowledge"
date: 2025-03-02
id: blog0365
tag: go
toc: true
intro: "Record useful tricks in golang"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Read the list of files

\`\`\`go
files, err := os.ReadDir(dir)
\`\`\`

### Read a file

\`\`\`go
const FILES_DIR = "./files"
\`\`\`

\`\`\`go
content, err := os.ReadFile(FILES_DIR + "/" + file.Name())
text := string(content)
words := strings.Fields(text) // this split the content string by /\\s+/g
\`\`\`

### Await for all Goroutines by Unbuffered Channel Trick

Assume that we have the following project structure:

![](/assets/img/2025-02-27-03-37-02.png)

Let's dispatch 8 goroutines to count the number of words in each file:

#### Read a set of large files concurrently

\`\`\`go{11,27}
func main() {
	start := time.Now()
	files := getFilesDirs(FILES_DIR)
	intChannel := make(chan int)

	for _, file := range files {
		go printCountOfWords(file, intChannel)
	}

	for i := 0; i < len(files); i++ {
		<-intChannel
	}

	elapsed := time.Since(start)
	fmt.Println("Time Taken:", elapsed)
}

func printCountOfWords(file fs.FileInfo, intChannel chan int) {
	content, err := os.ReadFile(FILES_DIR + "/" + file.Name())
	if err != nil {
		fmt.Println(err)
	}

	words := strings.Fields(string(content))
	numOfWords := len(words)
	fmt.Printf("%s has %d words \\n", file.Name(), numOfWords)
	intChannel <- 0
}
\`\`\`

Here is the trick:

- By default \`make(chan int)\` creates an **_unbuffered_** channel. Which means that every receive-operation \`<-intChannel\` is blocking until a value is received.
- Therefore each of \`<-intChannel\`'s will be unblocked once a value is received, thus we can unblock all receivers by enough number of send operations \`intChannel <- 0\`.

### Concurrency Limit by Buffered Channel and Await Coroutines by sync.WaitGroup

#### Download a set of large files

##### Structs for Decoding an XML

We define the following \`struct\` in an attemp to decode the XML file from this link:

- https://feeds.simplecast.com/qm_9xx0g

\`\`\`go
type Rss struct {
	Channel Channel \`xml:"channel"\`
}

type Channel struct {
	Title       string \`xml:"title"\`
	Description string \`xml:"description"\`
	Link        string \`xml:"link"\`
	Items       []Item \`xml:"item"\`
}

type Item struct {
	Title       string    \`xml:"title"\`
	Description string    \`xml:"description"\`
	Enclosure   Enclosure \`xml:"enclosure"\`
}

type Enclosure struct {
	URL    string \`xml:"url,attr"\`
	Length int    \`xml:"length,attr"\`
	Type   string \`xml:"type,attr"\`
}
\`\`\`

##### Main Program

First we define two constants:

\`\`\`go
const (
	maxDoanloads = 20
	maxRoutines  = 5
)
\`\`\`

We will be downloading 20 audios by at most 5 tasks concurrently.

\`\`\`go-1{19,20,25,42,45}
func main() {
	rssURL := "https://feeds.simplecast.com/qm_9xx0g"
	res, err := http.Get(rssURL)
	if err != nil {
		fmt.Println("Error: ", err)
		return
	}
	defer res.Body.Close()
	var rss Rss
	decoder := xml.NewDecoder(res.Body)
	err = decoder.Decode(&rss)
	if err != nil {
		fmt.Println("Error decoding RSS feed:", err)
		return
	}

	start := time.Now()

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, maxRoutines)
\`\`\`

- Here we define a wait group \`wg\`, we will add a counter by \`wg.Add(1)\` **_right before_** we dispatch **_a_** coroutine.
- We intentionally create a \`semaphore\` with empty struct \`struct{}\`, which therefore pre-allocates no memory to our channel since this is not a meaningful data type.

\`\`\`go-21{25,27,29,35,38}
	for index, item := range rss.Channel.Items {
		if index >= maxDoanloads {
			break
		}
		wg.Add(1)
		go func(item Item) {
			semaphore <- struct{}{}

			defer wg.Done()
			filename := item.Title + ".mp3"
			fmt.Println("Downloading ...:", filename)
			downloadPodcast(item.Enclosure.URL, filename)
			fmt.Println("Download Complete:", filename)

			<-semaphore
		}(item)
	}
	wg.Wait()
\`\`\`

- Here we \`wg.Done()\` in coroutine to deduct the counter
- We \`wg.Wait()\` to block the main thread from running
- We use a pair of \`semaphore <- struct{}{}\` and \`<-semaphore\` to rate limit the operations. The send action \`semaphore <-\` is blocking when the capacity of the channel is full, resulting in a rate limit.
- Note that here we **_cannot_** simply define the closure \`go func(){ ... }()\` with \`item\` being captured from the parent scope. It is because the order of execution of the closures is not determined by the sequential order we define it.

  If they refer to the same variable, then a **_race condition_** occurs since the value of the reference \`item\` (an auto-derefereneced pointer) is ever changing.

We wrap up by counting the duration of execution:

\`\`\`go-39
	elapsed := time.Since(start)
	fmt.Printf("This code took %s to run.", elapsed)
}
\`\`\`

### Atomic Operations by Mutex Lock

We simply assign the target variable a lock by wrapping it into a new struct with mutex:

\`\`\`go
type AtomicTotalWordCount struct {
	lock  sync.Mutex
	count int
}

func (a *AtomicTotalWordCount) Add(count int) {
	a.lock.Lock()
	defer a.lock.Unlock()
	tmpTotalWordCount := a.count + count
	a.count = tmpTotalWordCount
}
\`\`\`

Then each \`Add\` operation is atomic, no two threads can perform the same operation which causes dirty read and write.
`;export{n as default};
