const n=`---
title: "Channel and WaitGroup"
date: 2024-03-23
id: blog0248
tag: go
intro: "Study how to share a SINGLE channel to all goroutines and how to close it properly."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### findPrimes

We study finding the number of primes in a specific range and how to break down this task by goroutines:

\`\`\`go
var wg sync.WaitGroup

func findPrime(start int, end int, primeChannel chan int) {
	defer wg.Done()
	for num := start; num <= end; num++ {
		if num == 1 {
			continue
		}

		isPrime := true

		for k := 2; k < num; k++ {
			if num%k == 0 {
				isPrime = false
				break
			}
		}

		if isPrime {
			primeChannel <- num
		}
	}
}
\`\`\`

It takes \`1263ms\` for \`start=2\` and \`end=120000\` in a single goroutine.

### Goroutines and Waitgroup
#### Method 1 (Read Data in Main Goroutine)

Let's break down this into 24 goroutines:

\`\`\`go
func main() {
	start := time.Now().UnixMilli()
	numOfTask := 24
	patchSize := 120000 / numOfTask

	primeChannel := make(chan int)

	for i := 0; i < numOfTask; i++ {
		wg.Add(1)
		start := i*patchSize + 1
		end := (i + 1) * patchSize
		go findPrime(start, end, primeChannel)
	}

	go func() {
		wg.Wait()
		close(primeChannel)
	}()

	numOfPrimes := 0

	for range primeChannel {
		numOfPrimes++
	}

	end := time.Now().UnixMilli()
	fmt.Println("Time Taken:", fmt.Sprintf("%vms", end-start))
	fmt.Println("Number of Primes", numOfPrimes)
}
\`\`\`
- Here we use \`WaitGroup\` to count the number of completed goroutines.

- We craete one additional goroutine to keep track of the completeness.

- We close the channel when all goroutines are done.

- ***Without*** this addtional goroutine we will get:
  \`\`\`text
  fatal error: all goroutines are asleep - deadlock!
  \`\`\`
  because the compiler has detected there is no attempt to close the channel.

Now our execution time is reduced significantly: 
\`\`\`text
Time Taken: 100ms
Number of Primes 11301
\`\`\`
Of course this number is still not optimal because all the large numbers accumulate at the later goroutines. We can further improve it by redistributing the numbers into 24 bins evenly.

#### Method 2 (Read Data in Another Goroutine)
We can also run the "data-reading/processing pipeline" in another goroutine:

\`\`\`go
func countPrimes(numOfPrimes *int, primeChannel chan int) {
	for range primeChannel {
		*numOfPrimes++
	}
}
\`\`\`
\`\`\`go
func main() {
	start := time.Now().UnixMilli()
	numOfTask := 24
	patchSize := 120000 / numOfTask

	primeChannel := make(chan int)

	for i := 0; i < numOfTask; i++ {
		wg.Add(1)
		start := i*patchSize + 1
		end := (i + 1) * patchSize
		go findPrime(start, end, primeChannel)
	}

	numOfPrimes := 0
	go countPrimes(&numOfPrimes, primeChannel)

	wg.Wait()
	close(primeChannel)

	end := time.Now().UnixMilli()
	fmt.Println("Time Taken:", fmt.Sprintf("%vms", end-start))
	fmt.Println("Number of Primes", numOfPrimes)
}
\`\`\`

- Note that we cannot add \`wg.Add(1)\` for \`go countPrimes(&numOfPrimes, primeChannel)\` because the for loop inside \`countPrimes\` only ends when the channel is closed.

- That means it will automatically ends when the channel is closed. 

- Additionally \`wg.Add(1)\` will dead-lock indefinitely.

- Add count and remove count to the \`WaitGroup\` ***only*** for the goroutine ***that you want to wait***.


#### Method 3 (Distribute Data by Channel in one Goroutine and Process Data in Other Goroutines)

Previously we need to partition our input manually, but we can also distribute data to data-processing goroutines ***by one single channel***:

\`\`\`go
func findPrime(intChannel chan int, primeChannel chan int) {
	defer findPrime_wg.Done()
	for num := range intChannel {
		if num == 1 {
			continue
		}

		isPrime := true
		for k := 2; k < int(math.Floor(float64(math.Sqrt(float64(num)))))+1; k++ {
			if num%k == 0 {
				isPrime = false
				break
			}
		}

		if isPrime {
			primeChannel <- num
		}
	}
}

var distribute_wg sync.WaitGroup
var findPrime_wg sync.WaitGroup

func initNumbers(intChannel chan int, upperBound int) {
	defer distribute_wg.Done()

	for i := 2; i <= upperBound; i++ {
		intChannel <- i
	}
}

func countPrimes(numOfPrimes *int, primeChannel chan int) {
	for range primeChannel {
		*numOfPrimes++
	}
}

func main() {
	start := time.Now().UnixMilli()

	intChannel := make(chan int, 1000)
	primeChannel := make(chan int)

	distribute_wg.Add(1)
	go initNumbers(intChannel, 120000)

	for i := 0; i < 24; i++ {
		findPrime_wg.Add(1)
		go findPrime(intChannel, primeChannel)
	}

	numOfPrimes := 0
	go countPrimes(&numOfPrimes, primeChannel)

	go func() {
		distribute_wg.Wait()
		close(intChannel)
	}()

	findPrime_wg.Wait()
	close(primeChannel)

	end := time.Now().UnixMilli()
	fmt.Println("Time Taken:", fmt.Sprintf("%vms", end-start))
	fmt.Println("Number of Primes", numOfPrimes)
}
\`\`\`
Here we have made the following improvement:

- \`intChannel := make(chan int, 1000)\` is set to be buffered because we don't need to wait one goroutine to consume the task, we can let all goroutines consume tasks simultaneously.
- We set upper bound \`int(math.Floor(float64(math.Sqrt(float64(num)))))+1\` for finding the factor because for every decomposition $a\\cdot b= k$, with $a\\leq b$, we have $a^2\\leq k$, i.e., $a\\leq \\sqrt{k}$, which implies $a\\leq \\lfloor \\sqrt{k}\\rfloor +1$.


The result is better!
\`\`\`text
Time Taken: 19ms
Number of Primes 11301
\`\`\``;export{n as default};
