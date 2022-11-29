title: Custom Array Class
date: 2022-11-29
id: blog0113
tag: C++
intro: We can avoid heap memory allocation by using C style array stored in stack memory, given that we don't need such a flexibility of dynamic array (the `std::vector` class) and the size of the target array is known beforehand.

#### Our own Array Class

```cpp
template<typename T, size_t N>
class Array {
private:
	T m_data[N];

public:
	Array() {
		//signature: memset(T*, int value, int (size of the array))
		//memset(data(), 0, size() * sizeof(T));
		//or
		memset(&data()[0], 0, size() * sizeof(T));
		//as C style arrays are always continguous in memory
	}
	constexpr size_t size() const {
		return N;
	}

	T& operator[](size_t index) {
		if (index >= N) {
			LOG("hey??");
			__debugbreak();
		}
		return m_data[index];
	}
	const T& operator[]  (size_t index) const {
		if (index >= N) {
			__debugbreak();
		}
		return m_data[index];
	}

	T* data() {
		return m_data;
	}
};
```

#### main()

We test it out by our own `main` function below:

```cpp-1
int main(){
	const Array<int, 5> arr;
	for (int i = 0; i < arr.size(); i++) {
		cout << arr[i] << endl;
	}

	Array<int, 5> arr2;

	for (int i = 0; i < arr2.size(); i++) {
		arr2[i] = 3;
	}
	for (int i = 0; i < arr2.size(); i++) {
		cout << arr2[i] << endl;
	}
}
```

Thera are two overloadings for the `[]` operator on `Array` class.

- **line 2 to line 5.** Since we declare `const Array<int, 5>`, the operator `[]` needs to be overloaded with output `const T&`.

- **line 9 to line 11** In order for assigment operator to work, we need to return a value `T&` for each index.
