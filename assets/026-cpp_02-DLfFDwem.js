const t=`---
title: C++ Beginner Notes 02 - Shallow Copy, Deep Copy and Move Semantics
date: 2021-09-09
id: blog0026
tag: C++
wip: false
intro: We list some potential problem of using shallow copy and how to avoid them by deep copy. We can also improve computation efficiency when a variable is never reused but needed to be passed into a function/class attribute. We achieve this by using move constructor.
---

### Shallow Copy and Trouble

We first define a class of objects for which we will do a shallow copy:

\`\`\`cpp
class Shallow {
private:
	int* data;
public:
	void set_data(int d) {
		*data = d;
	};
	int  get_data() {
		return *data;
	};
	Shallow(int d);
	Shallow(const Shallow& source);
	~Shallow();
};

Shallow::Shallow(int d) {
	data = new int;
	*data = d;
	cout << "1-arg constructor called" << endl;
}
Shallow::Shallow(const Shallow& source) :
	data{ source.data }
{
	cout << "copy constructor called" << endl;
};
Shallow::~Shallow() {
	delete data;
	cout << "destructor called to free memory";
};
\`\`\`

We will be doing a shallow copy using copy constructor above. The destructor defined above is legit, but then a problem will be raised when any instance of \`Shallow\` is out of scope of some function, say:

\`\`\`cpp
void display_object(Shallow  s) {
	// error still occurs even the following line is commented out:
	cout << s.get_data() << endl;
}
\`\`\`

The reason is that our copy constructor just copy the address of the object's data just passed in. But when a destructor of a shallow copy is called, the original object will have \`data\` pointing to an invalid data, compiler will then throw an error.

Let's simulate this problem below:

\`\`\`cpp
int main() {
	Shallow obj_1{ 100 };
	Shallow obj_2{ obj_1 };
	// since pointing to the same data (originally 100) in heap,
	// both obj_1.data and obj_2.data become 1000:
	obj_2.set_data(1000);
	// when obj_2 is out of scope, destructor is called:
	display_object(obj_2);
	// obj_1.data points to invalid data, error occurs and we fail to return status code 0:
	return 0;
}
\`\`\`

<center>
<img src="/assets/tech/012.png"/>
</center>
<br/>

### Deep Copying Instead

Since pointing to the same allocated memory is a trouble. All data of any new instance of a class through copy constructor should point to the new allocated memory instead. This is easily adjustable by modifying the copy constructor as below:

\`\`\`cpp
Shallow::Shallow(const Shallow& source) :
	Shallow{ *source.data }
{
	cout << "copy constructor called" << endl;
};
\`\`\`

In other words, we delegate our copy constructor to our 1-argument constructor which is designed originally to allocate new memory in heap.

Now with exactly the same code, our \`main\` can run faultlessly.

### Further Discussion with l-value

As another observation:

\`\`\`cpp
int main() {
	int x{ 100 };
	// or int y = x;
	int y{ x };
	y = 1000;
	cout << x << ' ' << y << endl;
	return 0;
}
\`\`\`

We can observe that the output is

\`\`\`text
100 1000
\`\`\`

Therefore the copy constructor of \`int\` is indeed a deep copy (always allocate a new memory).

But then how to make a new variable \`y\` that really makes a reference to \`x\`? We will need a concept called \`l-value\` reference, which is done by calling

\`\`\`cpp
int main() {
	int x{ 100 };
	int& y = x;
	y = 1000;
	cout << x << ' ' << y << endl;
	return 0;
}
\`\`\`

and this time the output is

\`\`\`text
1000 1000
\`\`\`

The \`l-value\` concept is usually introduced before we witness the definition of function prototypes like \`int func(type &variable)\`. Yes the \`&\` operator here indeed indicates we want a \`l-value\` variable to be passed in.

### Move-Semantics

#### Use Case

The opposite of \`l-value\` is \`r-value\` and this kind of reference is indicated by \`&&\`. The concept of \`r-value\` becomes very useful when it comes to move-semantics. Loosely speaking the most easily understandable use cases are:

- When a data is to be constructed and passed into an \`l-value\`. For example, we may assign a large object as a member of a class, and this object is not going to be reused **_anywhere else_**.
- When we want to pass a large object into a function which is not going to be reused **_anywhere else_**.

The main problem to solve is

> Creating an temp object and copying it for another object/function is inefficient.

We would like to implement a move contructor which can reduce the number of times calling the copy constructor. The move constructor usually accepts an \`r-value\` for initiallization.

There are two ways to construct \`r-value\`:

- Return value of a function without assigning it to any \`l-value\`.
- Object initialization without variable name.

#### Code Implementation of Move Constructor

We rename the \`Shallow\` class above to \`Data\` as we do not focus on shallow copy anymore. Now the whole implementation of the \`Data\` class is (we haved just added additionally one constrctor below and changed the logging in destructor):

\`\`\`cpp
#include <iostream>
using namespace std;

class Data {
private:
	int* data;
public:
	int  get_data() {
		return *data;
	};
	Data(int d);
	Data(const Data& source);
	Data(Data&& source);
	~Data();
};

Data::Data(int d) {
	data = new int;
	*data = d;
	cout << "1-arg constructor called" << endl;
}

Data::Data(const Data& source) :
	Data{ *source.data }
{
	cout << "copy constructor called" << endl;
};

Data::Data(Data&& source) {
	data = source.data;
	source.data = nullptr;
	cout << "move constructor called" << endl;
}

Data::~Data() {
	if (data != nullptr) {
		cout << "destructor called to free memory" << endl;
	}
	delete data;
};

void display_object(Data  s) {
	cout << "Shallow.data: " << s.get_data() << endl;
}

Data create_data() {
	Data new_shallow{ 100 };
	return new_shallow;
}

int main() {
	// This call the move constructor:
	display_object(create_data());

	// This does not:
	// display_object(Data{ 123 });

	// This does:
	// display_object(std::move(Data{ 123 }));
}
\`\`\`

We can observe that the **_unreused_** (we assume this is the case) variable returned from \`create_data()\` does not trigger the copy constructor, for which the copy constructor is supposed to allocate new memory to store our temporary object.

Now the function call will be way more efficient if the object to pass into the function is very large.

### References

- https://www.youtube.com/watch?v=IOkgBrXCtfo
`;export{t as default};
