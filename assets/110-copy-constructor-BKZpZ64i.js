const n=`---
title: Copy Constructor
date: 2022-11-23
id: blog0110
tag: C++
intro: We implement our string class and demonstrate how to create a copy constructor for deep copying a string.
---

### Our String Class

\`\`\`cpp-1
#include <iostream>

using std::cout;
using std::cin;
using std::endl;
using std::ostream;

class String {
private:
	size_t m_size;
	char* m_buffer;

public:
	String(const char* string) {
		m_size = strlen(string);
		m_buffer = new char[m_size + 1];
		memcpy(m_buffer, string, m_size);
		m_buffer[m_size] = 0;
	}
	~String() {
		delete[] m_buffer;
	}
	String(const String& other)
		: m_size(other.m_size)
	{
		m_buffer = new char[m_size + 1];
		memcpy(m_buffer, other.m_buffer, m_size);
		m_buffer[m_size] = 0;
	}

	char& operator[](int index) {
		return m_buffer[index];
	}

	friend ostream& operator<<(ostream& stream, const String& string);
};
\`\`\`

We also define our own \`<<\` for printing our \`String\` object.

\`\`\`cpp
ostream& operator<<(ostream& stream, const String& string) {
	stream << string.m_buffer;
	return stream;
}
\`\`\`

### Why Copy Constructor is Always of this Signature? The Implicit Conversion

The function started at line 23, \`String(const String& other)\`, is called the **_copy constructor_** of \`String\`. In fact, when we do the assignment:

\`\`\`cpp
String name("James");
String name2 = name;
\`\`\`

The second line undergoes the following processes:

1. Compiler will determine whether \`name\` can be fed into one of the overloadings of our constructors.
2. If yes, it will do an **_implicit conversion_** and fed that parameter into that constructor, which is the copy constructor in our case.

Btw, anytime we see \`=\` we are always copying something unless we are doing \`auto& a = b\`, i.e., creating an alias.

Note that even a function returns a reference \`T& some_function()\` doesn't mean \`auto a = some_function()\` will store it as a reference, it keeps copying everything and create \`a\` in the copy constructor.

### Problem Without our own Copy Constructor

- By default the compiler will copy all the member variables, including the pointer \`m_buffer\` without copying the heap-allocated array. That's what we call **_shallow copy_**.
- Exception will be caught when both \`name\` and \`name2\` are our of the scope they live since \`~String()\` will be called twice but both \`name.m_buffer\` and \`name2.m_buffer\` point to the same heap-allocated array.

### Test our String Class in main()

\`\`\`cpp
int main() {
	{
		String name("James");
		cout << name << endl;
		String name2 = name;
		name2[3] = 's';
		cout << name2 << endl;
	}
	cin.get();
}
\`\`\`
`;export{n as default};
