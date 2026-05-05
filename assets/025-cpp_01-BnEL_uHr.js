const n=`---
title: C++ Beginner Notes 01 - Stack and Heap
date: 2021-09-08
id: blog0025
tag: C++
intro: We write simple functions to understand cpp syntax, memory in stack and memory in heaps by using raw pointer.
toc: false
---

This is an exercise from udemy course in which I need to create a function \`apply_all\` which accepts parameters \`int* arr_1, size_t size_1, int* arr_2, size_t size_2\` such that \`arr_1\` of size \`size_1\` and \`arr_2\` of size \`size_2\` are multiplied to generate an array of size $\\text{size_1}\\times \\text{size_2}$.

For example, \`array_1=[1, 2, 3]\` and \`array_2=[10, 20]\` are multiplied to produce \`[10, 20, 30, 20, 40, 60]\`.

We first include the following standard library:

\`\`\`cpp
#include <iostream>
using namespace std;
\`\`\`

Next our \`apply_all\` will produce a pointer pointing to an array allocated in **_heap memory_**:

\`\`\`cpp
int* apply_all(int* arr_1, size_t size_1, int* arr_2, size_t size_2) {
	size_t total_size{ size_1 * size_2 };
	// when using new, we are allocating new memory in heap to store the integer array.
	int* new_arr = new int[total_size];

	int index{ 0 };
	for (size_t j{ 0 }; j < size_2; j++) {
		for (size_t i{ 0 }; i < size_1; i++) {
			*(new_arr + index) = arr_2[j] * arr_1[i];
			index++;
		}
	}
	return new_arr;
}
\`\`\`

**Warning to myself.** We cannot create a local variable inside \`apply_all\` and simply return the address of that variable. Since local variable are saved in **_stack memory_**, memory allocated in the function will be poped out/deallocated once the result is returned. The resulting address will point to garbage data.

Next we define a simple function to print arrays:

\`\`\`cpp
void print(int* const result, int const size) {
	cout << "Result: ";
	cout << "[ ";
	for (int i{ 0 }; i < size; i++) {
		cout << *(result + i) << " ";
	}
	cout << "]" << endl;
}
\`\`\`

Finally we combine the above result:

\`\`\`cpp
int main() {
	int array_1[5]{ 1,2,3,4,5 };
	int array_2[3]{ 10,20,30 };
	int* result = apply_all(array_1, 5, array_2, 3);

	cout << "Array1: ";
	print(array_1, 5);
	cout << "Array2: ";
	print(array_2, 3);
	print(result, 15);

	// raw pointer, deallocate memory:
	delete[] result;
}
\`\`\`

the output in console is:

\`\`\`text
Array1: Result: [ 1 2 3 4 5 ]
Array2: Result: [ 10 20 30 ]
Result: [ 10 20 30 40 50 20 40 60 80 100 30 60 90 120 150 ]
\`\`\`

**Remark.** The variable name of an raw array in C++ in fact stores an address to the first element of that array. Therefore the variable name of an array is interchangeable with pointers in many use case.
`;export{n as default};
