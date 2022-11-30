title: Array and Dynamic Array Class
date: 2022-11-29
id: blog0113
tag: C++
intro: We can avoid heap memory allocation by using C style array stored in stack memory, given that we don't need such a flexibility of dynamic array (the `std::vector` class) and the size of the target array is known beforehand.

#### Fixed Size Array

The following exmaple is very raw, it serves as the purpose of showing the importance why we need to overload `[]` twice with different signatures.

##### Definition

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

##### main()

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

- **line 9 to line 11** In order for assigment operator to work, the operator `[]` needs to be overloaded to return a value `T&` for each index.

The output of the code above:

```none
0
0
0
0
0
3
3
3
3
3
```

The initilization and assignment are working correctly.

#### Dynamically Sized Arrays

##### Definition

```cpp
template<typename T>
class Vector {
public:
	Vector() {
		reAlloc(2);
	}
	~Vector() {
		ClearByIndividualDestructor();
		::operator delete(m_Data, m_Capacity * sizeof(T));
	}

	size_t Size() {
		return m_Size;
	}
	T& operator [] (int index) {
		if (index >= m_Size) {
			__debugbreak();
		}
		return m_Data[index];
	}

	const T& operator [] (int index) const {
		return m_Data[index];
	}

	template<typename... Args>

	T& EmplaceBack(Args&&... args) {
		std::cout << "EmplaceBack\n";
		if (m_Size >= m_Capacity) {
			m_Capacity = (size_t)(m_Capacity * 1.5);
			reAlloc(m_Capacity);
		}

		//m_Data[m_Size] = T(std::forward<Args>(args)...);
		new(&m_Data[m_Size])T(std::forward<Args>(args)...);
		m_Size++;
		return m_Data[m_Size];
	}

	void PopBack() {
		if (m_Size > 0) {
			m_Size--;
			m_Data[m_Size].~T();
		}
	}

	void ClearByIndividualDestructor() {
		for (size_t i = 0; i < m_Size; i++) {
			m_Data[i].~T();
		}
		m_Size = 0;
	}


  // We avoid copying therefore we comment out the copy constructor.
  // Note that the following function does not implement how to copy the m_MemoryBlock inside a Vector3

	// void PushBack(const T& value) {
	// 	if (m_Size >= m_Capacity) {
	// 		m_Capacity = (size_t)(m_Capacity * 1.5);
	// 		reAlloc(m_Capacity);
	// 	}
	// 	m_Data[m_Size] = value;
	// 	m_Size++;
	// }

	void PushBack(T&& value) {
		if (m_Size >= m_Capacity) {
			m_Capacity = (size_t)(m_Capacity * 1.5);
			reAlloc(m_Capacity);
		}
		// when value (being a Rvalue) goes into this function, value itself become an Lvalue inside this function
		// we need to convert value into a temporary value by std::move
		m_Data[m_Size] = std::move(value);
		m_Size++;
	}

private:
	T* m_Data = 0;
	size_t m_Size = 0;
	size_t m_Capacity = 0;

	void reAlloc(size_t newCapacity) {
		T* newBlock = (T*)::operator new(newCapacity * sizeof(T));

		if (newCapacity < m_Size) {
			m_Size = newCapacity;
		}

		for (size_t i = 0; i < m_Size; i++) {
			newBlock[i] = std::move(m_Data[i]);
		}

		for (size_t i = 0; i < m_Size; i++) {
			m_Data[i].~T();
		}
		::operator delete(m_Data, m_Capacity * sizeof(T)); // this will call the destructor off all object inside the array

		m_Data = newBlock;
		m_Capacity = newCapacity;
	}
};
```

##### main()

We want to test our function within an additional level of scope to test whether mememory deallocation is done correctly.

```cpp
int main(){
	{
		Vector<Vector3> vectors;

		//Vector3 vec_1(1);
		//Vector3 vec_2 = vec_1;

		vectors.EmplaceBack(5);
		vectors.EmplaceBack();
		//Vector3 vec(3, 3, 1);
		vectors.PushBack(Vector3(3, 3, 1));
		vectors.EmplaceBack(5, 5, 1);
		vectors.EmplaceBack(6);
		vectors.EmplaceBack(7);
		vectors.EmplaceBack(5, 5, 2);
		vectors.EmplaceBack(2, 2, 1);
		vectors.PopBack();
		vectors.PopBack();
		PrintVector(vectors);
	}
}
```

No copy constructor as been called (in fact if it where called we get an error as we have commented the copy constructor out):

```text
EmplaceBack
EmplaceBack
Move
Move
Destroy
Destroy
Move
Destroy
EmplaceBack
Move
Move
Move
Destroy
Destroy
Destroy
EmplaceBack
Move
Move
Move
Move
Destroy
Destroy
Destroy
Destroy
EmplaceBack
EmplaceBack
Move
Move
Move
Move
Move
Move
Destroy
Destroy
Destroy
Destroy
Destroy
Destroy
EmplaceBack
Destroy
Destroy
(5, 5, 5)
(0, 0, 0)
(3, 3, 1)
(5, 5, 1)
(6, 6, 6)
(7, 7, 7)
---------------------------
Destroy
Destroy
Destroy
Destroy
Destroy
Destroy
```
