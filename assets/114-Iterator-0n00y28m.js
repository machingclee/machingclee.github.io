const t=`---
title: Iterator
date: 2022-11-30
id: blog0114
tag: C++
intro: We try to implement iterator that iterates elements inside our vector class in the [PREVIOUS BLOG](/blog/article/Array-and-Dynamic-Array-Class).
---

### Repo

- https://github.com/machingclee/cpp-study/blob/main/study/Study/Vector.h

### Iterator

By comparing the old and modern form of iterator we will understand which functions are required to be implemented.

#### Original form of Iterator

\`\`\`cpp
for (Vector<int>::Iterator it = values.begin();
	it != values.end();
	it++
) {
		std::cout << *it << std::endl;
}
\`\`\`

#### Modern Simplified form of Iterator

\`\`\`cpp
for (int value : values) {
	std::cout << value << std::endl;
}
\`\`\`

#### Defining Iterator Class

Therefore we need to

- define an iterator object (which is to be instantiated inside \`Vector\` class) that has defined:

  - \`++\`
  - \`*\` (dereference)
  - \`==\`
  - \`!=\`

- define methods \`begin()\` and \`start()\` to output \`Iterator\`.

Next, a specific classname cannot be used as a template parameter, but a generic class that is parametrized by a typename:

\`\`\`cpp
template<typename T>
class Vector {
	...
}
\`\`\`

can as well be used as a template parameter as follow:

\`\`\`cpp
template<typename Vector>
class VectorIterator {
public:
	using ValueType = typename Vector::ValueType;
	using PointerType = ValueType*;
	using ReferenceType = ValueType&;

public:
	VectorIterator(PointerType ptr) : m_Ptr(ptr) {
	}
	// prefix ++
	VectorIterator& operator++() {
		m_Ptr++;
		return *this;
	}
	ReferenceType operator*() {
		return *m_Ptr;
	}
	bool operator ==(const VectorIterator& other) const {
		return m_Ptr == other.m_Ptr;
	}
	bool operator !=(const VectorIterator& other) const {
		return !(*this == other);
	}
private:
	PointerType m_Ptr;
};
\`\`\`

Some important takeaway:

- Here \`using\` are all used to give various alias to types.
- The **_scoped-alias_** created by \`using\` can be accessed by \`VectorIterator::PointerType\`.
- In order to let compiler distinguish between types and static members, we add \`typename\` keyword when defining \`ValueType\`, this \`Vector::ValueType\` will be added in the next section.

### Expand our Vector Class that Returns Iterator

A lot of hard work has been done in the \`VectorIterator\` class above. In our original \`Vector\` class we just point out the additional code that bring \`VectorIterator\` into play.

\`\`\`cpp
template<typename T>
class Vector {
public:
	using ValueType = T;
	using Iterator = VectorIterator<Vector<T>>;
	...
\`\`\`

and

\`\`\`cpp
public:
	Iterator begin() {
		return Iterator(m_Data);
	}

	Iterator end() {
		return Iterator(m_Data + m_Size);
	}
\`\`\`

### Test our Iterator in main()

Now we can test our iterator by:

\`\`\`cpp
int main(){
	Vector<Vector3> vectors;

	vectors.EmplaceBack(5);
	vectors.EmplaceBack();
	vectors.PushBack(Vector3(3, 3, 1));
	vectors.PushBack(new Vector3(1, 5, 5));
	vectors.EmplaceBack(5, 5, 1);
	vectors.EmplaceBack(6);
	vectors.EmplaceBack(7);
	vectors.EmplaceBack(5, 5, 2);
	vectors.EmplaceBack(2, 2, 1);
	vectors.PopBack();
	vectors.PopBack();
	//PrintVector(vectors);

	for (Vector3& vector : vectors) {
		std::cout << vector << std::endl;
	}
}
\`\`\`

and the output is the same as before:

\`\`\`none
EmplaceBack
EmplaceBack
Move
Move
Destroy
Destroy
Move
Destroy
Move
Move
Move
Destroy
Destroy
Destroy
Copy
Move
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
EmplaceBack
Destroy
Destroy
(5, 5, 5)
(0, 0, 0)
(3, 3, 1)
(1, 5, 5)
(5, 5, 1)
(6, 6, 6)
(7, 7, 7)
Destroy
Destroy
Destroy
Destroy
Destroy
Destroy
Destroy
\`\`\`
`;export{t as default};
